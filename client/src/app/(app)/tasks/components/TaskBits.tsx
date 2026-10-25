"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { Check, CheckCircle2, ChevronDown, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  OUTCOME_COLORS,
  OUTCOME_LABEL,
  PRIORITY_LABEL,
  PRIORITY_STYLES,
  STATUSES,
  STATUS_LABEL,
  STATUS_STYLES,
} from "./task-utils";

// The colour dot beside each status in the "Change status" menu.
const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-amber-500",
  IN_PROGRESS: "bg-blue-500",
  COMPLETED: "bg-green-600",
  CANCELLED: "bg-muted",
};

/* Small presentational pieces shared by the Assign tasks page and its rows. */

export const OutcomeBadge = ({ value }: { value: string }) => (
  <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-medium", OUTCOME_COLORS[value] ?? "bg-subtle text-muted")}>
    {OUTCOME_LABEL[value] ?? value}
  </span>
);

export function PriorityPill({ value }: { value: string }) {
  return (
    <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-medium", PRIORITY_STYLES[value] ?? "bg-subtle text-muted")}>
      {PRIORITY_LABEL[value] ?? value}
    </span>
  );
}

export function StatusPill({ value }: { value: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", STATUS_STYLES[value] ?? "bg-subtle text-muted")}>
      {value === "COMPLETED" && <CheckCircle2 size={12} />}
      {STATUS_LABEL[value] ?? value}
    </span>
  );
}

/**
 * The status pill that you can click. It opens a short menu so progress can be updated in one
 * tap, without opening the full edit form.
 *   value   what the pill shows (this can be Overdue or Blocked, which the server works out)
 *   current the status that is actually saved, so the menu ticks the right one
 */
export function StatusMenu({ value, current, busy, onChange }: {
  value: string;
  current: string;
  busy?: boolean;
  onChange: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const pick = (s: string) => {
    setOpen(false);
    if (s !== current) onChange(s);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change status"
        className={clsx(
          "inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap transition-shadow hover:ring-2 hover:ring-foreground/10 disabled:opacity-70",
          STATUS_STYLES[value] ?? "bg-subtle text-muted"
        )}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : value === "COMPLETED" && <CheckCircle2 size={12} />}
        {STATUS_LABEL[value] ?? value}
        <ChevronDown size={12} className={clsx("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div role="menu" aria-label="Change status" className="absolute left-0 top-full mt-1 w-44 bg-surface border border-border rounded-xl shadow-pop py-1 z-30">
          <div className="type-colhead px-3 pt-2 pb-1.5">Change status</div>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={s === current}
              onClick={() => pick(s)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-primary/5"
            >
              <span className={clsx("w-2 h-2 rounded-full shrink-0", STATUS_DOT[s])} />
              <span className="flex-1 text-left">{STATUS_LABEL[s]}</span>
              {s === current && <Check size={14} className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Ring({ pct, ringClass, trackClass }: { pct: number; ringClass: string; trackClass: string }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="23" cy="23" r={r} fill="none" strokeWidth="5" className={trackClass} />
      {pct > 0 && (
        <circle
          cx="23" cy="23" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(pct, 100) / 100)}
          className={ringClass}
        />
      )}
    </svg>
  );
}

export function RingStat({ value, label, pct, ringClass, trackClass, labelClass }: {
  value: string; label: string; pct: number; ringClass: string; trackClass: string; labelClass: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl shadow-card px-3.5 py-3 flex items-center gap-3 min-w-[168px] shrink-0 sm:min-w-0">
      <Ring pct={pct} ringClass={ringClass} trackClass={trackClass} />
      <div className="min-w-0">
        <div className="text-xl font-semibold text-foreground leading-tight tabular-nums whitespace-nowrap">{value}</div>
        <div className={clsx("text-sm font-medium truncate", labelClass)}>{label}</div>
      </div>
      <div className="ml-auto self-end text-xs text-muted tabular-nums">{pct}%</div>
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone: "green" | "blue" }) {
  const styles = {
    green: "bg-green-50 border-green-200 text-green-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
  };
  return (
    <div className={clsx("border rounded-xl px-4 py-2.5 text-center", styles[tone])}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function FilterSelect({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: ReactNode }) {
  return (
    <div className="relative w-full sm:w-auto">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="appearance-none h-9 w-full sm:w-auto bg-surface border border-border rounded-lg pl-3 pr-8 text-sm text-foreground sm:min-w-[140px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative justify-self-end">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More actions"
        aria-expanded={open}
        title="More actions"
        className="p-1.5 rounded-lg text-muted hover:bg-primary/5 hover:text-foreground transition-colors"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-surface border border-border rounded-xl shadow-pop py-1 z-30">
          <button onClick={() => { setOpen(false); onEdit(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-primary/5">
            <Pencil size={14} /> Edit details
          </button>
          <button onClick={() => { setOpen(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

/** Replaces the browser's confirm() box so deleting looks and reads like the rest of Trunqo. */
export function ConfirmDialog({ title, body, confirmLabel, busy, onConfirm, onCancel }: {
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border rounded-2xl shadow-pop w-full max-w-sm p-5"
      >
        <h2 className="font-serif text-lg text-foreground">{title}</h2>
        <p className="text-sm text-muted mt-1.5">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-xl border border-border bg-surface text-foreground hover:bg-primary/5 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}