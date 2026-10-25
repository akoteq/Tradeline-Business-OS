"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { clsx } from "clsx";

/**
 * Our replacement for the browser's confirm() and prompt(). Await it anywhere:
 *
 *   if (!(await confirmAction({ title: "Delete this lead?", body: "…", confirmLabel: "Delete" }))) return;
 *   const reason = await promptAction({ title: "Reverse this payment?", inputLabel: "Reason (optional)" });
 *
 * `danger` (on by default for confirm) paints the button red. Esc / Cancel / clicking outside resolves
 * false (or null for a prompt); Enter confirms. <ConfirmHost /> sits once in the AppShell.
 */

type Base = { title: string; body?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type ConfirmOpts = Base;
type PromptOpts = Base & { inputLabel?: string; placeholder?: string; defaultValue?: string; required?: boolean };

type Request =
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOpts; resolve: (v: string | null) => void };

let current: Request | null = null;
const queue: Request[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function open(r: Request) {
  if (current) queue.push(r); else current = r;
  emit();
}
function settle(value: boolean | string | null) {
  const r = current;
  if (!r) return;
  if (r.kind === "confirm") r.resolve(value === true || typeof value === "string");
  else r.resolve(typeof value === "string" ? value : null);
  current = queue.shift() ?? null;
  emit();
}

export function confirmAction(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => open({ kind: "confirm", opts: { danger: true, ...opts }, resolve }));
}

export function promptAction(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => open({ kind: "prompt", opts, resolve }));
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function ConfirmHost() {
  const req = useSyncExternalStore(subscribe, () => current, () => null);
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {req && <Dialog key={req.opts.title + req.kind} req={req} reduce={!!reduce} />}
    </AnimatePresence>
  );
}

function Dialog({ req, reduce }: { req: Request; reduce: boolean }) {
  const { title, body, confirmLabel, cancelLabel = "Cancel", danger } = req.opts;
  const prompt = req.kind === "prompt" ? req.opts : null;
  const [value, setValue] = useState(prompt?.defaultValue ?? "");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blocked = !!prompt?.required && !value.trim();

  const ok = () => { if (!blocked) settle(prompt ? value : true); };
  const cancel = () => settle(prompt ? null : false);

  useEffect(() => {
    (prompt ? inputRef.current : confirmRef.current)?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); cancel(); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Icon = danger ? AlertTriangle : HelpCircle;
  return (
    <motion.div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-primary/40 p-4 backdrop-blur-[2px]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      onMouseDown={cancel}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={body ? "confirm-body" : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-pop"
      >
        <form onSubmit={(e) => { e.preventDefault(); ok(); }}>
          <div className="flex items-start gap-3">
            <span className={clsx("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", danger ? "bg-red-50 text-red-600" : "bg-accent/10 text-accent")}>
              <Icon size={18} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="confirm-title" className="font-serif text-lg leading-snug text-foreground">{title}</h2>
              {body && <p id="confirm-body" className="mt-1.5 text-sm text-muted">{body}</p>}
            </div>
          </div>

          {prompt && (
            <label className="mt-4 block">
              {prompt.inputLabel && <span className="mb-1 block text-xs font-medium text-muted">{prompt.inputLabel}</span>}
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={prompt.placeholder}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40 focus:ring-2 focus:ring-accent/20"
              />
            </label>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={cancel} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:bg-primary/5">
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="submit"
              disabled={blocked}
              className={clsx(
                "rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                danger ? "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500" : "bg-primary text-background hover:bg-primary/90 focus-visible:ring-primary"
              )}
            >
              {confirmLabel ?? (danger ? "Delete" : "Continue")}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
