"use client";

import { clsx } from "clsx";
import { Download, Search } from "lucide-react";
import { SOURCES, type BdoOption, type Filters, type Scope } from "./lib";

const select = "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40";

type Tab = { id: Scope; label: string; count?: number; flag?: boolean };

export function LeadsToolbar({
  scope, onScope, counts, showMine, filters, onFilter, onClear, bdos, search, onSearch, onExport, canExport,
}: {
  scope: Scope; onScope: (s: Scope) => void;
  counts: { all: number; overdue: number; week: number }; showMine: boolean;
  filters: Omit<Filters, "status">; onFilter: (key: keyof Filters, value: string) => void; onClear: () => void;
  bdos: BdoOption[]; search: string; onSearch: (v: string) => void; onExport: () => void; canExport: boolean;
}) {
  const tabs: Tab[] = [
    { id: "all", label: "All leads", count: counts.all },
    ...(showMine ? [{ id: "mine" as const, label: "My leads" }] : []),
    { id: "overdue", label: "Overdue", count: counts.overdue, flag: true },
    { id: "week", label: "Due this week", count: counts.week },
    { id: "shared", label: "Shared" },
  ];
  const anyFilter = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-3">
      <nav aria-label="Lead views" className="flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const active = t.id === scope;
          return (
            <button
              key={t.id} onClick={() => onScope(t.id)} aria-current={active ? "page" : undefined}
              className={clsx("flex shrink-0 items-center gap-2 py-1 text-sm transition-colors", active ? "font-semibold text-accent" : "font-medium text-foreground/70 hover:text-foreground")}
            >
              {t.label}
              {typeof t.count === "number" && (
                <span className={clsx(
                  "min-w-5 rounded-full px-1.5 text-center text-xs font-medium tabular-nums",
                  t.flag && t.count > 0 ? "bg-red-500/10 text-red-600" : active ? "bg-accent/10 text-accent" : "bg-foreground/[0.06] text-foreground/60",
                )}>{t.count}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2.5">
        <select value={filters.priority} onChange={(e) => onFilter("priority", e.target.value)} className={select} aria-label="Priority">
          <option value="">All priorities</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
        </select>
        <select value={filters.source} onChange={(e) => onFilter("source", e.target.value)} className={select} aria-label="Source">
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.bdo} onChange={(e) => onFilter("bdo", e.target.value)} className={select} aria-label="Owner" disabled={scope === "mine"}>
          <option value="">Everyone</option>
          {bdos.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
        </select>
        {anyFilter && <button onClick={onClear} className="px-1 text-sm text-muted transition-colors hover:text-accent">Clear</button>}

        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-72 sm:flex-none">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search by business, contact or phone"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <button onClick={onExport} disabled={!canExport} title="Download as CSV" aria-label="Download as CSV" className="rounded-lg border border-border p-2 text-muted transition-colors hover:bg-subtle/50 hover:text-foreground disabled:opacity-40">
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
