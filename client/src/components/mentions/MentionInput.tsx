"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { fetcher } from "@/lib/api";
import { toDisplay, toValue, type EntityType, type MentionRef } from "@/lib/mentions";

/**
 * A textarea where typing @ opens a picker of people who can open the item (max 8, filtered as
 * you type). A picked person shows as a highlighted @Name chip; underneath, the value is stored
 * as @[Name](userId), which is what onChange gets and what the server reads.
 *
 * The chips are a highlight layer drawn behind a transparent textarea, so typing, selecting,
 * undo and spellcheck all behave like a normal text box.
 */

export type MentionSource = { entityType: EntityType; entityId: string } | { company: string | null };
export type Person = { id: string; name: string; email: string; company: string | null; role: string };
export type MentionInputHandle = { focus: () => void };

type Props = {
  value: string;
  onChange: (value: string) => void;
  source: MentionSource;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Ctrl/Cmd + Enter. */
  onSubmit?: () => void;
  /** Where the picker opens: below the box (default) or above it, for boxes at the bottom of a panel. */
  pickerPlacement?: "below" | "above";
  className?: string;
  "aria-label"?: string;
};

// Shared by the textarea and the highlight layer so their text lines up exactly.
const BOX = "w-full rounded-lg border px-3 py-2 text-sm leading-relaxed font-[inherit] whitespace-pre-wrap break-words";
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sourceQuery = (s: MentionSource) =>
  "entityType" in s ? `entityType=${s.entityType}&entityId=${s.entityId}` : `company=${encodeURIComponent(s.company ?? "")}`;

// The @query right before the caret, if the caret is inside one. Names can have a space or two.
function activeQuery(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|\s)@([^@\n]{0,30})$/.exec(text.slice(0, caret));
  if (!m) return null;
  const query = m[2];
  if ((query.match(/ /g) ?? []).length > 2 || query.startsWith(" ")) return null;
  return { start: caret - query.length - 1, query };
}

export const MentionInput = forwardRef<MentionInputHandle, Props>(function MentionInput(
  { value, onChange, source, placeholder, rows = 3, disabled, autoFocus, onSubmit, pickerPlacement = "below", className, ...rest },
  ref,
) {
  const listId = useId();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => taRef.current?.focus() }), []);

  const [text, setText] = useState(() => toDisplay(value).text);
  const [mentions, setMentions] = useState<MentionRef[]>(() => toDisplay(value).mentions);
  const [picker, setPicker] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);

  // Follow outside changes (e.g. the box being cleared after sending).
  useEffect(() => {
    if (toValue(text, mentions) === value) return;
    const d = toDisplay(value);
    setText(d.text);
    setMentions(d.mentions);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const srcKey = sourceQuery(source);
  const { data: people = [], isFetching } = useQuery<Person[]>({
    queryKey: ["mentionable", srcKey, picker?.query ?? ""],
    queryFn: () => fetcher(`/comments/mentionable?${srcKey}&q=${encodeURIComponent(picker?.query ?? "")}`),
    enabled: !!picker && !disabled,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
  const open = !!picker && (people.length > 0 || isFetching);

  // A name with a space that matches nobody means they weren't mentioning anyone: stop looking.
  useEffect(() => {
    if (picker && !isFetching && people.length === 0 && picker.query.includes(" ")) setPicker(null);
  }, [picker, isFetching, people.length]);
  useEffect(() => { setActive(0); }, [picker?.query]);

  const emit = (t: string, m: MentionRef[]) => {
    // Forget chips whose @Name is gone, so the stored value stays tidy.
    const kept = m.filter((x) => new RegExp(`@${escapeRe(x.name)}(?![\\w])`).test(t));
    setText(t);
    setMentions(kept);
    onChange(toValue(t, kept));
  };

  const detect = () => {
    const ta = taRef.current;
    if (!ta || ta.selectionStart !== ta.selectionEnd) { setPicker(null); return; }
    setPicker(activeQuery(ta.value, ta.selectionStart));
  };

  const pick = (p: Person) => {
    const ta = taRef.current;
    if (!ta || !picker) return;
    const caret = ta.selectionStart;
    const insert = `@${p.name} `;
    const next = text.slice(0, picker.start) + insert + text.slice(caret);
    const nextMentions = mentions.some((m) => m.id === p.id) ? mentions : [...mentions, { id: p.id, name: p.name }];
    emit(next, nextMentions);
    setPicker(null);
    const pos = picker.start + insert.length;
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(pos, pos); });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && people.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % people.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + people.length) % people.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(people[Math.min(active, people.length - 1)]); return; }
    }
    if (picker && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setPicker(null); return; }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) { e.preventDefault(); onSubmit(); }
  };

  // The highlight layer: the same text, with each chosen @Name on a tinted pill.
  const layer = useMemo(() => {
    if (!mentions.length) return [text];
    const names = [...new Set(mentions.map((m) => m.name))].sort((a, b) => b.length - a.length).map(escapeRe);
    const re = new RegExp(`(@(?:${names.join("|")}))(?![\\w])`, "g");
    return text.split(re).map((part, i) => (i % 2 === 1
      ? <mark key={i} className="rounded bg-accent/15 text-transparent shadow-[0_0_0_1px] shadow-accent/25">{part}</mark>
      : part));
  }, [text, mentions]);

  const activeId = open && people[active] ? `${listId}-${people[active].id}` : undefined;

  // The picker is drawn on top of the page (a portal), so a scrolling panel can't clip it. It
  // opens on the side of the box with more room and scrolls inside itself when space is tight.
  const listRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const r = taRef.current?.getBoundingClientRect();
      if (!r) return;
      const gap = 4, edge = 8, want = 360;
      const vw = window.innerWidth, vh = window.innerHeight;
      const width = Math.min(Math.max(r.width, 240), 384, vw - edge * 2);
      const left = Math.min(Math.max(r.left, edge), vw - width - edge);
      const below = vh - r.bottom - gap - edge, above = r.top - gap - edge;
      // Prefer the requested side, unless the other one has clearly more room.
      const useAbove = pickerPlacement === "above" ? above >= Math.min(want, below) : below < Math.min(want, above);
      setPos(useAbove
        ? { left, width, bottom: vh - r.top + gap, maxHeight: Math.min(want, above) }
        : { left, width, top: r.bottom + gap, maxHeight: Math.min(want, below) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true); // capture: any scrolling parent moves the box
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, pickerPlacement, people.length]);

  // Keep the highlighted person visible while moving with the arrow keys.
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  return (
    <div className={clsx("relative", className)}>
      <div
        ref={layerRef}
        aria-hidden
        className={clsx(BOX, "pointer-events-none absolute inset-0 overflow-hidden border-transparent text-transparent")}
      >
        {layer}{"\n "}
      </div>
      <textarea
        ref={taRef}
        value={text}
        rows={rows}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={rest["aria-label"]}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        onChange={(e) => { emit(e.target.value, mentions); setPicker(activeQuery(e.target.value, e.target.selectionStart)); }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) detect(); }}
        onClick={detect}
        onBlur={() => setTimeout(() => setPicker(null), 120)}
        onScroll={(e) => { if (layerRef.current) layerRef.current.scrollTop = e.currentTarget.scrollTop; }}
        className={clsx(
          BOX,
          "relative block resize-none border-border bg-transparent text-foreground placeholder:text-muted/70",
          "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 disabled:opacity-60",
        )}
      />

      {open && pos && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="People you can mention"
          // Keep focus in the textarea when the list (or its scrollbar) is pressed.
          onMouseDown={(e) => e.preventDefault()}
          style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          className="z-[70] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface py-1 shadow-pop"
        >
          {people.length === 0 && <li className="px-3 py-2 text-sm text-muted">Looking…</li>}
          {people.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${p.id}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: picking must happen before the textarea loses focus.
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setActive(i)}
              className={clsx("flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm", i === active ? "bg-accent/10" : "hover:bg-foreground/5")}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-semibold text-foreground/70">
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{p.name}</span>
                <span className="block truncate text-xs text-muted">{p.email}</span>
              </span>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
});
