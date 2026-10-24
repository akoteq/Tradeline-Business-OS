"use client";

import { clsx } from "clsx";
import { Plus, Upload } from "lucide-react";
import { SORT_LABEL, STAGE_LABEL, STAGE_RING, STATUS_LABEL, STATUS_LIST, type SortKey } from "./lib";

export function LeadsHeader({ scope, sort, onSort, onAdd, onImport }: { scope: string; sort: SortKey; onSort: (s: SortKey) => void; onAdd: () => void; onImport: () => void }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-3xl text-foreground md:text-4xl">Leads</h1>
        <p className="mt-1 max-w-2xl text-base text-muted">Prospects you&apos;re working before they become customers. {scope}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={sort} onChange={(e) => onSort(e.target.value as SortKey)} aria-label="Sort leads"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
        </select>
        <button onClick={onImport} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5">
          <Upload size={15} /> Import
        </button>
        <button onClick={onAdd} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90">
          <Plus size={16} /> New lead
        </button>
      </div>
    </div>
  );
}

function Ring({ share, className }: { share: number; className: string }) {
  const r = 16, c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className={clsx("-rotate-90 shrink-0", className)} aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-foreground/10" />
      <circle
        cx="20" cy="20" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-current"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, share))} style={{ transition: "stroke-dashoffset 600ms ease" }}
      />
    </svg>
  );
}

// One card per stage: how many, and its share of all leads. Tap to filter.
export function LeadsStats({ stats, status, onStatus }: { stats: Record<string, number>; status: string; onStatus: (s: string) => void }) {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {STATUS_LIST.map((s) => {
        const n = stats[s] ?? 0;
        const share = total ? n / total : 0;
        const active = status === s;
        return (
          <button
            key={s} onClick={() => onStatus(active ? "" : s)} aria-pressed={active}
            className={clsx(
              "flex items-center gap-3 rounded-xl border bg-surface p-3 text-left transition-colors",
              active ? "border-accent ring-1 ring-accent" : "border-border hover:border-foreground/30",
            )}
          >
            <Ring share={share} className={STAGE_RING[s]} />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-2xl font-semibold leading-none tabular-nums text-foreground">{n.toLocaleString()}</span>
              <span className={clsx("mt-1 block truncate text-sm font-medium", STAGE_LABEL[s])}>{STATUS_LABEL[s]}</span>
            </span>
            <span className="self-end text-xs tabular-nums text-muted">{Math.round(share * 100)}%</span>
          </button>
        );
      })}
    </div>
  );
}
