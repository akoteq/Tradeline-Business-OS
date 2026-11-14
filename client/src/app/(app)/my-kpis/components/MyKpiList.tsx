"use client";

import { plainText } from "@/lib/mentions";
import { useState } from "react";
import { clsx } from "clsx";
import { ArrowUpDown, Filter, Search } from "lucide-react";
import {
  KPI_STATUS_LABEL, KPI_STATUS_LIST, fmtKpiVal, PaceBar, AutoTag, Tag, StatusPill, WorkChip, windowLabel, daysLeftIn,
  type KpiRow, type KpiStatus,
} from "@/components/kpi";
import { Menu, MenuItem } from "../../kpi-framework/components/ui";
import { kpiIcon, type SortKey } from "../../kpi-framework/components/lib";

// Someone's KPIs as a table, styled like the Company KPIs board: count, search, status filter and
// sort up top, one row per KPI, with +1 and "Log result" on the right.

export type MyRow = KpiRow & { kind: "PERSONAL" | "STANDARD" | "ACCOUNTABLE"; canManage: boolean; canSetTarget: boolean };

type Kind = "all" | "mine" | "assigned" | "scorecard" | "owner";
const KINDS: [Kind, string][] = [["all", "All"], ["mine", "Mine"], ["assigned", "Assigned to me"], ["scorecard", "Scorecard"], ["owner", "Company KPIs I own"]];
const kindOf = (r: MyRow): Kind =>
  r.kind === "STANDARD" ? "scorecard" : r.kind === "ACCOUNTABLE" ? "owner" : r.definition.assignedBy ? "assigned" : "mine";

const COLS = ["KPI", "Actual", "Target", "Progress", "Tasks", "Status", ""];

export function canPlusOne(r: MyRow) {
  const d = r.definition;
  return d.source !== "AUTO" && r.aggregation === "SUM" && d.unit === "COUNT" && r.entry?.reviewStatus !== "LOCKED" && d.state !== "DRAFT";
}

export function MyKpiList({ rows, statusFilter, onStatusFilter, companyName, onOpen, onPlusOne, busy, someoneElse }: {
  rows: MyRow[]; statusFilter: KpiStatus | ""; onStatusFilter: (s: KpiStatus | "") => void;
  companyName: (k: string) => string; onOpen: (r: MyRow) => void; onPlusOne: (r: MyRow) => void; busy: boolean;
  /** Viewing another person's KPIs, so "Mine" reads as theirs. */
  someoneElse: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const [kind, setKind] = useState<Kind>("all");

  const kindCounts = rows.reduce((m, r) => { const k = kindOf(r); m[k] = (m[k] ?? 0) + 1; return m; }, {} as Partial<Record<Kind, number>>);
  // Only offer the kind tabs when there's more than one kind to tell apart.
  const kinds = KINDS.filter(([k]) => k === "all" || kindCounts[k]);
  const showKinds = kinds.length > 2;

  const q = search.trim().toLowerCase();
  const shown = rows
    .filter((r) => (kind === "all" || kindOf(r) === kind) && (!statusFilter || r.status === statusFilter))
    .filter((r) => !q || [r.definition.metric, plainText(r.definition.definition), r.parent?.metric].some((v) => (v ?? "").toLowerCase().includes(q)))
    .sort((a, b) => {
      if (sort === "name") return a.definition.metric.localeCompare(b.definition.metric);
      if (sort === "attain_asc" || sort === "attain_desc") {
        const av = a.attainment, bv = b.attainment;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sort === "attain_asc" ? av - bv : bv - av;
      }
      return 0;
    });

  const iconBtn = (active: boolean) => clsx(
    "p-2.5 rounded-xl border bg-surface transition-colors",
    active ? "border-accent text-accent" : "border-border text-muted hover:text-foreground hover:bg-primary/5",
  );

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-sm">
      <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-foreground">
            {shown.length} KPI{shown.length === 1 ? "" : "s"}
            {statusFilter && <span className="text-muted font-normal text-sm"> · {KPI_STATUS_LABEL[statusFilter]}</span>}
          </span>
          {statusFilter && (
            <button onClick={() => onStatusFilter("")} className="text-xs text-muted hover:text-accent transition-colors">Clear filter</button>
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search KPIs"
              className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>
          <Menu trigger={({ toggle }) => (
            <button onClick={toggle} className={iconBtn(!!statusFilter)} title="Filter by status" aria-label="Filter by status"><Filter size={16} /></button>
          )}>
            {(close) => (
              <>
                <MenuItem active={!statusFilter} onClick={() => { onStatusFilter(""); close(); }}>All statuses</MenuItem>
                {KPI_STATUS_LIST.map((s) => (
                  <MenuItem key={s} active={statusFilter === s} onClick={() => { onStatusFilter(s); close(); }}>{KPI_STATUS_LABEL[s]}</MenuItem>
                ))}
              </>
            )}
          </Menu>
          <Menu trigger={({ toggle }) => (
            <button onClick={toggle} className={iconBtn(sort !== "default")} title="Sort" aria-label="Sort"><ArrowUpDown size={16} /></button>
          )}>
            {(close) => (
              <>
                <MenuItem active={sort === "default"} onClick={() => { setSort("default"); close(); }}>Default order</MenuItem>
                <MenuItem active={sort === "attain_asc"} onClick={() => { setSort("attain_asc"); close(); }}>Progress: lowest first</MenuItem>
                <MenuItem active={sort === "attain_desc"} onClick={() => { setSort("attain_desc"); close(); }}>Progress: highest first</MenuItem>
                <MenuItem active={sort === "name"} onClick={() => { setSort("name"); close(); }}>Name A–Z</MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>

      {showKinds && (
        <nav aria-label="Kinds of KPI" className="flex gap-5 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {kinds.map(([k, label]) => {
            const on = k === kind;
            const count = k === "all" ? rows.length : kindCounts[k] ?? 0;
            return (
              <button key={k} onClick={() => setKind(k)} aria-current={on ? "page" : undefined}
                className={clsx("flex shrink-0 items-center gap-2 py-1 text-sm transition-colors", on ? "font-semibold text-accent" : "font-medium text-foreground/70 hover:text-foreground")}>
                {k === "mine" && someoneElse ? "Their own" : label}
                <span className={clsx("min-w-5 rounded-full px-1.5 text-center text-xs font-medium tabular-nums", on ? "bg-accent/10 text-accent" : "bg-foreground/[0.06] text-foreground/60")}>{count}</span>
              </button>
            );
          })}
        </nav>
      )}

      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-sm min-w-[880px]">
          <thead className="border-b border-border">
            <tr>
              {COLS.map((h, i) => (
                <th key={i} className={clsx("px-4 py-3 text-[10.5px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap text-left", i === 0 && "pl-5")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {shown.length === 0 ? (
              <tr><td colSpan={COLS.length} className="px-4 py-12 text-center text-muted">Nothing matches. Try clearing the filter or search.</td></tr>
            ) : shown.map((r) => {
              const d = r.definition;
              const Icon = kpiIcon(d);
              const left = daysLeftIn(r.window);
              const k = kindOf(r);
              return (
                <tr key={`${d.id}-${r.kind}`} className="hover:bg-primary/[0.03] transition-colors">
                  <td className="pl-5 pr-4 py-4">
                    <button onClick={() => onOpen(r)} className="flex items-center gap-3 text-left group">
                      <span className="h-10 w-10 rounded-full bg-foreground/5 text-foreground/80 grid place-items-center shrink-0"><Icon size={17} /></span>
                      <span className="min-w-0">
                        <span className="font-semibold text-foreground group-hover:text-accent transition-colors flex items-center gap-1.5 flex-wrap">
                          {d.metric}
                          {d.source === "AUTO" && <AutoTag />}
                          {k === "assigned" && <Tag>Assigned</Tag>}
                          {k === "scorecard" && <Tag>Scorecard</Tag>}
                          {k === "owner" && <Tag title="A company KPI you are accountable for">Owner</Tag>}
                          {!d.higherIsBetter && <Tag>Decrease</Tag>}
                          {d.state === "DRAFT" && <Tag>Draft</Tag>}
                        </span>
                        <span className="block text-xs text-muted truncate max-w-[320px]">
                          {[
                            r.parent ? `↳ ${r.parent.metric} (${companyName(r.parent.company)})` : null,
                            windowLabel(r.window, d.frequency) + (left != null ? ` · ${left} day${left === 1 ? "" : "s"} left` : ""),
                          ].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-4 font-medium text-foreground tabular-nums whitespace-nowrap">{fmtKpiVal(r.current, d.unit)}</td>
                  <td className="px-4 py-4 text-foreground/80 tabular-nums whitespace-nowrap">{fmtKpiVal(r.target, d.unit)}</td>
                  <td className="px-4 py-4 min-w-[150px]">
                    {r.attainment != null ? (
                      <div className="w-36">
                        <div className="text-xs font-medium tabular-nums text-foreground mb-1">{r.attainment}%</div>
                        <div className="flex"><PaceBar attainment={r.attainment} expected={r.expected} status={r.status} /></div>
                      </div>
                    ) : <span className="text-muted/50">—</span>}
                  </td>
                  <td className="px-4 py-4"><WorkChip work={r.work} /></td>
                  <td className="px-4 py-4"><StatusPill status={r.status} className="px-2.5 py-1" /></td>
                  <td className="pl-4 pr-5 py-4">
                    <div className="flex items-center gap-1.5 justify-end">
                      {canPlusOne(r) && (
                        <button onClick={() => onPlusOne(r)} disabled={busy} title="Add 1 to this result"
                          className="px-2 py-1 rounded-lg border border-border text-xs font-medium text-foreground hover:border-accent hover:text-accent transition-colors disabled:opacity-50">+1</button>
                      )}
                      <button onClick={() => onOpen(r)} className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-primary/5 text-xs font-medium text-foreground hover:bg-primary/10 transition-colors">
                        {d.source === "AUTO" ? "Details" : "Log result"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
