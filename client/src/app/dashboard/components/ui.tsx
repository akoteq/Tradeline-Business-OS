"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { motion } from "framer-motion";
import { ArrowRight, Globe2, Lock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Built on the tokens in globals.css: the type scale only (text-xs · text-sm · text-base), `type-kpi`
// for big numbers, `type-colhead` for small labels, rounded-xl cards, solid 1px border-border,
// bg-subtle for heads and hovers. Terracotta (accent) = needs attention. Emerald = good. Sky = in motion.

export const card = "rounded-xl border border-border bg-surface";
/** Terracotta icon chip, used wherever an icon sits beside a label. */
export const chip = "grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent/10 text-accent";
export const TONE = { good: "text-emerald-600", info: "text-sky-600", warn: "text-accent" } as const;
export const RING = { good: "text-emerald-500", info: "text-sky-500", warn: "text-accent" } as const;

// ---- Text helpers ------------------------------------------------------

// "PROPOSAL_SENT" / "Proposal Sent" -> "Proposal sent". Sentence case everywhere.
export const label = (v: string) => {
  const s = v.replace(/_/g, " ").trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GH", { month: "short", day: "numeric" });

/** Whole days from today: -2 is two days ago. */
export function daysFrom(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today.getTime()) / 86_400_000);
}
/** "3 days overdue", "Due today", or the date. */
export function dueText(iso: string, status: string) {
  if (status === "COMPLETED") return fmtDate(iso);
  const d = daysFrom(iso);
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return fmtDate(iso);
}

// ---- Tags (accent = needs attention, muted = neutral) ------------------

export const FLAG_WORDS = ["risk", "overdue", "off", "unpaid"];
export const isFlagged = (v: string) => FLAG_WORDS.some((w) => v.toLowerCase().includes(w));

export function Tag({ value }: { value: string }) {
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium", isFlagged(value) ? "bg-accent/10 text-accent" : "bg-foreground/5 text-foreground/70")}>
      {label(value)}
    </span>
  );
}

export function VisibilityTag({ visibility }: { visibility: "private" | "public" }) {
  const Icon = visibility === "private" ? Lock : Globe2;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground/70">
      <Icon size={11} /> {label(visibility)}
    </span>
  );
}

// ---- Page furniture ----------------------------------------------------

export function SectionHeader({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={chip}><Icon size={14} strokeWidth={2.25} /></span>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>
        {hint && <p className="mt-1 max-w-2xl text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:underline">
      {children} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90">
      {children} <ArrowRight size={14} />
    </Link>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** The one card shell for side-by-side content: same title, header and body padding, same height. */
export function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={clsx(card, "flex h-full flex-col")}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {aside}
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

// ---- Ring: a share of something, with the percentage inside -------------

export function Ring({ value, className, size = 52 }: { value: number; className?: string; size?: number }) {
  const stroke = 5, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <span className={clsx("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={`${Math.round(v * 100)} percent`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-foreground/10" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-current"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <span className="text-xs font-medium tabular-nums text-foreground">{Math.round(v * 100)}%</span>
    </span>
  );
}

// ---- Tiles -------------------------------------------------------------

export function MoneyTile({ icon: Icon, label: title, amount, display, hint, flag = false }: {
  icon: LucideIcon; label: string; amount: number | null; display: string; hint?: string; flag?: boolean;
}) {
  const empty = (amount === null || amount === 0) && !flag;
  return (
    <div className={clsx(card, "relative p-4")}>
      {flag && <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
      <div className="flex items-center gap-2">
        <span className={chip}><Icon size={14} strokeWidth={2.25} /></span>
        <span className="type-colhead">{title}</span>
      </div>
      <div className={clsx("mt-3 font-display text-2xl font-semibold tabular-nums", flag ? "text-accent" : empty ? "text-muted" : "text-foreground")}>{display}</div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function MiniStat({ label: title, value, flag = false }: { label: string; value: number; flag?: boolean }) {
  const empty = value === 0 && !flag;
  return (
    <div className="p-4 text-center">
      <div className={clsx("font-display text-2xl font-semibold tabular-nums", flag ? "text-accent" : empty ? "text-muted" : "text-foreground")}>{value}</div>
      <div className="type-colhead mt-2">{title}</div>
    </div>
  );
}

// ---- Tabs --------------------------------------------------------------

export type TabItem = { id: string; label: string; icon: LucideIcon; count?: number; flag?: boolean };

export function TabSwitcher({ items, activeId, onSelect }: { items: TabItem[]; activeId: string; onSelect: (id: string) => void }) {
  return (
    <nav aria-label="Company dashboard sections" className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/85 px-4 backdrop-blur-md md:-mx-6 md:px-6">
      <ul className="flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button" onClick={() => onSelect(item.id)} aria-current={active ? "page" : undefined}
                className={clsx(
                  "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm transition-colors",
                  active ? "border-accent font-semibold text-foreground" : "border-transparent font-medium text-foreground/60 hover:text-foreground",
                )}
              >
                <item.icon size={15} className={active ? "text-accent" : undefined} />
                {item.label}
                {typeof item.count === "number" && item.count > 0 && (
                  <span className={clsx(
                    "min-w-5 rounded-full px-1.5 text-center text-xs font-medium tabular-nums",
                    item.flag ? "bg-accent/15 text-accent" : active ? "bg-accent/10 text-accent" : "bg-foreground/[0.06] text-foreground/60",
                  )}>{item.count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const tabFade = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

export function TabPanel({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <motion.div key={id} initial="hidden" animate="visible" exit="exit" variants={tabFade} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}
