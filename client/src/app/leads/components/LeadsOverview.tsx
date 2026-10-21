"use client";

import { clsx } from "clsx";
import { Plus } from "lucide-react";
import { STATUS_BAR, STATUS_LABEL, STATUS_LIST } from "./lib";

// Six stages as one connected pipeline: the bar shows how leads split across stages,
// and each stage is a tap-to-filter.
export function LeadsOverview({ stats, status, onStatus, scope, onAdd }: {
  stats: Record<string, number>; status: string; onStatus: (s: string) => void; scope: string; onAdd: () => void;
}) {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl md:text-4xl text-foreground tracking-tight">Leads</h1>
          <p className="text-sm text-muted mt-1.5 max-w-2xl">
            <span className="text-foreground font-medium">{total.toLocaleString()} {total === 1 ? "lead" : "leads"}.</span> {scope}
          </p>
        </div>
        <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-accent text-accent-foreground rounded-xl shadow-sm hover:opacity-90 transition-opacity">
          <Plus size={16} /> Add lead
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-sm p-3 space-y-3">
        <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-foreground/5 gap-px" aria-hidden>
          {total > 0 && STATUS_LIST.map((s) => (stats[s] ?? 0) > 0 && (
            <div key={s} className={STATUS_BAR[s]} style={{ width: `${((stats[s] ?? 0) / total) * 100}%` }} />
          ))}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {STATUS_LIST.map((s) => {
            const active = status === s;
            return (
              <button
                key={s} onClick={() => onStatus(active ? "" : s)} aria-pressed={active}
                className={clsx(
                  "rounded-xl px-3 py-2 text-left transition-colors",
                  active ? "bg-primary text-accent-foreground" : "hover:bg-primary/5",
                )}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <span className={clsx("h-2 w-2 rounded-full", STATUS_BAR[s])} />
                  <span className={active ? "opacity-80" : "text-muted"}>{STATUS_LABEL[s]}</span>
                </div>
                <div className="text-xl font-semibold tabular-nums mt-0.5">{(stats[s] ?? 0).toLocaleString()}</div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
