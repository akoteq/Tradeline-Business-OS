"use client";

import { clsx } from "clsx";
import { ArrowRight, Search, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

// The pieces the projects pages share with Leads and Clients: the page header, the ring stat
// cards, the text tabs with counts, the filter bar and the grouped sections.

export const selectClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40";

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-3xl text-foreground md:text-4xl">{title}</h1>
        {sub && <div className="mt-1 max-w-2xl text-base text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PrimaryButton({ onClick, icon: Icon, children }: { onClick: () => void; icon?: LucideIcon; children: ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90">
      {Icon && <Icon size={16} />} {children}
    </button>
  );
}

export function OutlineButton({ onClick, icon: Icon, children, danger }: { onClick: () => void; icon?: LucideIcon; children: ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} className={clsx("inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-foreground/5", danger ? "text-red-600" : "text-foreground")}>
      {Icon && <Icon size={15} />} {children}
    </button>
  );
}

function Ring({ share, className }: { share: number; className: string }) {
  const r = 16, c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className={clsx("-rotate-90 shrink-0", className)} aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-foreground/10" />
      <circle
        cx="20" cy="20" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-current"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, share)))} style={{ transition: "stroke-dashoffset 600ms ease" }}
      />
    </svg>
  );
}

export type Stat = { key: string; label: string; value: number; share: number; ring: string; text: string; note?: string };

// One card per group: how many, and its share of the whole. Tap to filter when onSelect is given.
export function StatCards({ stats, active, onSelect }: { stats: Stat[]; active?: string; onSelect?: (key: string) => void }) {
  return (
    <div className={clsx("grid grid-cols-2 gap-3 sm:grid-cols-3", stats.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
      {stats.map((s) => {
        const on = active === s.key;
        const body = (
          <>
            <Ring share={s.share} className={s.ring} />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-2xl font-semibold leading-none tabular-nums text-foreground">{s.value.toLocaleString()}</span>
              <span className={clsx("mt-1 block truncate text-sm font-medium", s.text)}>{s.label}</span>
              {s.note && <span className="block truncate text-[11px] text-muted">{s.note}</span>}
            </span>
            <span className="self-end text-xs tabular-nums text-muted">{Math.round(s.share * 100)}%</span>
          </>
        );
        const cls = clsx("flex items-center gap-3 rounded-xl border bg-surface p-3 text-left transition-colors", on ? "border-accent ring-1 ring-accent" : "border-border", onSelect && !on && "hover:border-foreground/30");
        return onSelect
          ? <button key={s.key} onClick={() => onSelect(on ? "" : s.key)} aria-pressed={on} className={cls}>{body}</button>
          : <div key={s.key} className={cls}>{body}</div>;
      })}
    </div>
  );
}

export type TabDef<T extends string> = { id: T; label: string; count?: number; flag?: boolean };

export function TextTabs<T extends string>({ tabs, active, onSelect, label }: { tabs: TabDef<T>[]; active: T; onSelect: (id: T) => void; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id} onClick={() => onSelect(t.id)} aria-current={on ? "page" : undefined}
            className={clsx("flex shrink-0 items-center gap-2 py-1 text-sm transition-colors", on ? "font-semibold text-accent" : "font-medium text-foreground/70 hover:text-foreground")}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className={clsx(
                "min-w-5 rounded-full px-1.5 text-center text-xs font-medium tabular-nums",
                t.flag && t.count > 0 ? "bg-red-500/10 text-red-600" : on ? "bg-accent/10 text-accent" : "bg-foreground/[0.06] text-foreground/60",
              )}>{t.count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function FilterBar({ children, search, onSearch, placeholder, onClear }: { children?: ReactNode; search: string; onSearch: (v: string) => void; placeholder: string; onClear?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2.5">
      {children}
      {onClear && <button onClick={onClear} className="px-1 text-sm text-muted transition-colors hover:text-accent">Clear</button>}
      <div className="relative ml-auto w-full sm:w-72">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder}
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
    </div>
  );
}

export type GroupStyle = { title: string; Icon: LucideIcon; head?: string; icon: string; text?: string };

// A titled group of rows with a coloured icon, a count, and "View all" once it's long.
export function GroupSection({ group, count, noun, preview = 5, children }: { group: GroupStyle; count: number; noun: [string, string]; preview?: number; children: (limit: number | null) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className={clsx("flex items-center gap-3 border-b border-border px-4 py-3", group.head)}>
        <span className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-full", group.icon)}><group.Icon size={15} /></span>
        <h2 className={clsx("text-sm font-semibold", group.text ?? "text-foreground")}>{group.title}</h2>
        <span className="text-xs text-muted">{count} {count === 1 ? noun[0] : noun[1]}</span>
        {count > preview && (
          <button onClick={() => setOpen((o) => !o)} className="group ml-auto inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            {open ? "Show less" : `View all ${count}`}
            {!open && <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />}
          </button>
        )}
      </header>
      <ul className="divide-y divide-border">{children(open ? null : preview)}</ul>
    </section>
  );
}

export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
          <div className="h-9 w-9 animate-pulse rounded-full bg-foreground/5" />
          <div className="flex-1 space-y-1.5"><div className="h-3 w-48 animate-pulse rounded bg-foreground/5" /><div className="h-3 w-28 animate-pulse rounded bg-foreground/5" /></div>
        </div>
      ))}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
