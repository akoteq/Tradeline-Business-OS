"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

export const inputClass = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-60";
export const selectClass = inputClass + " pr-8";
export const btnPrimary = "px-5 py-2.5 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity";
export const btnSecondary = "px-4 py-2.5 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-foreground/5 transition-colors";
export const btnGhost = "px-3 py-2.5 text-sm text-muted hover:text-foreground transition-colors";

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-foreground mb-1.5">
      {children}
      {hint && <span className="text-muted font-normal"> {hint}</span>}
    </label>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="text-sm text-red-600">{message}</p>;
}

// One-tap choice, replaces a dropdown when there are only a handful of options.
export function Chips<T extends string>({ value, options, onChange, label }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([v, text]) => (
        <button
          key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={clsx(
            "px-3.5 py-2 rounded-full border text-sm transition-colors",
            value === v ? "border-accent bg-accent/10 text-foreground font-medium" : "border-border text-muted hover:border-foreground/30 hover:text-foreground",
          )}
        >{text}</button>
      ))}
    </div>
  );
}

// Bigger option with a one-line explanation, for choices that need a sentence of context.
export function ChoiceCard({ selected, title, text, onClick }: {
  selected: boolean; title: string; text: string; onClick: () => void;
}) {
  return (
    <button
      type="button" role="radio" aria-checked={selected} onClick={onClick}
      className={clsx(
        "text-left rounded-xl border p-3.5 transition-colors",
        selected ? "border-accent bg-accent/5 ring-1 ring-accent/30" : "border-border hover:border-foreground/30",
      )}
    >
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs text-muted mt-0.5 leading-snug">{text}</div>
    </button>
  );
}

// Keeps rarely-needed fields out of the way without removing them.
export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border pt-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-sm text-muted hover:text-foreground transition-colors">
        {title}
        <ChevronDown size={16} className={clsx("transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-4 pt-4">{children}</div>}
    </div>
  );
}
