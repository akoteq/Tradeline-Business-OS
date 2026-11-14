"use client";

import { plainText } from "@/lib/mentions";
import { useState, useEffect, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  Settings2, Archive, ChevronLeft, ChevronRight, Search, Filter, ArrowUpDown, MoreHorizontal, Target, Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { isManager } from "@/lib/auth";
import {
  KpiStatus, KpiRow, KpiDef, KPI_STATUS_LIST, KPI_STATUS_STYLE, KPI_STATUS_LABEL,
  fmtKpiVal, PaceBar, AutoTag, Tag, StatusPill, WorkChip, windowLabel,
} from "@/components/kpi";
import { Menu, MenuItem, IconButton, ReviewBadge, TrendCell } from "./ui";
import { apiError, avatarColor, initials, kpiIcon, periodLabelFor, type Department, type ReviewStatus, type SortKey, type View } from "./lib";

const PAGE_SIZE = 20;
const COLS = ["KPI", "Owner & department", "Actual", "Target", "Progress", "Tasks", "Status", "Trend", "Review", "Actions"];

function BoardGroup({ name, rows, colSpan, children }: { name: string; rows: KpiRow[]; colSpan: number; children: ReactNode }) {
  if (!name) return <>{children}</>;
  const c = rows.reduce((m, r) => { m[r.status] = (m[r.status] ?? 0) + 1; return m; }, {} as Record<string, number>);
  return (
    <>
      <tr className="bg-background/70">
        <td colSpan={colSpan} className="px-5 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">{name}</span>
            <span className="text-[11px] text-muted">{rows.length} KPI{rows.length === 1 ? "" : "s"}</span>
            {(["OVERDUE", "OFF_TRACK", "AT_RISK", "ON_TRACK", "ACHIEVED"] as KpiStatus[]).filter((s) => c[s]).map((s) => (
              <span key={s} className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${KPI_STATUS_STYLE[s]}`}>{c[s]} {KPI_STATUS_LABEL[s]}</span>
            ))}
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}

export function KpiBoard({
  board, isLoading, error, departments, view, statusFilter, onStatusFilter, resetKey, period,
  canManage, companyName, onOpen, onSetTarget, onEdit, onArchive, onAdd, onChanged,
}: {
  board: KpiRow[]; isLoading: boolean; error: unknown; departments: Department[]; view: View;
  statusFilter: KpiStatus | ""; onStatusFilter: (s: KpiStatus | "") => void;
  resetKey: string;                       // changes when company / department / period change, to go back to page 1
  period: string; canManage: boolean; companyName: (k: string) => string;
  onOpen: (id: string) => void; onSetTarget: (r: KpiRow) => void; onEdit: (d: KpiDef) => void; onArchive: (d: KpiDef) => void;
  onAdd: () => void; onChanged: () => void;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const [page, setPage] = useState(1);

  // One-tap +1 for manual totals.
  const canQuickAdd = (r: KpiRow) =>
    isManager(user) && r.definition.source !== "AUTO" && r.aggregation === "SUM"
    && r.definition.unit === "COUNT" && r.entry?.reviewStatus !== "LOCKED" && r.status !== "DRAFT";
  const quickAdd = useMutation({
    mutationFn: (r: KpiRow) => api.post("/kpi-framework/quick-update", { definitionId: r.definition.id, period, delta: 1 }),
    onSuccess: (_res, r) => { toast.success("Progress added", { description: `+1 on ${r.definition.metric}` }); onChanged(); },
    onError: (err) => toast.error("Couldn't add progress", { description: apiError(err, "Please try again.") }),
  });

  // Status filter → search → sort.
  const q = search.trim().toLowerCase();
  const filtered = board.filter((r) =>
    (!statusFilter || r.status === statusFilter) &&
    (!q || [r.definition.metric, plainText(r.definition.definition), r.owner?.name, r.department?.name, r.parent?.metric]
      .some((v) => (v ?? "").toLowerCase().includes(q))),
  );
  const rows = [...filtered].sort((a, b) => {
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

  useEffect(() => { setPage(1); }, [resetKey, statusFilter, search, sort, view]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = view === "department" ? rows : rows.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  // By-department view: one block per department (KPIs without one last).
  const groups = view === "department"
    ? [...departments.map((c) => ({ key: c.id, name: c.name, rows: rows.filter((r) => r.department?.id === c.id) })),
       { key: "none", name: "No department", rows: rows.filter((r) => !r.department) }].filter((g) => g.rows.length)
    : [{ key: "all", name: "", rows: pageRows }];

  const iconBtn = (active: boolean) => clsx(
    "p-2.5 rounded-xl border bg-surface transition-colors",
    active ? "border-accent text-accent" : "border-border text-muted hover:text-foreground hover:bg-primary/5",
  );

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-sm">
      <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-foreground">
            {rows.length} KPI{rows.length === 1 ? "" : "s"}
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by KPI, owner or department"
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

      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-sm min-w-[1180px]">
          <thead className="border-b border-border">
            <tr>
              {COLS.map((h) => (
                <th
                  key={h}
                  className={clsx(
                    "px-4 py-3 text-[10.5px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap",
                    h === "Actions" ? "text-right pr-5" : "text-left",
                    h === "KPI" && "pl-5",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading ? (
              <tr><td colSpan={COLS.length} className="px-4 py-10 text-center text-muted">Loading your KPIs…</td></tr>
            ) : error ? (
              <tr><td colSpan={COLS.length} className="px-4 py-10 text-center text-red-600">{apiError(error, "Couldn't load KPIs. Please refresh and try again.")}</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-12 text-center">
                  <p className="text-muted">{board.length === 0 ? "No KPIs here yet." : "Nothing matches. Try clearing the filter or search."}</p>
                  {canManage && board.length === 0 && (
                    <button onClick={onAdd} className="mt-3 text-sm font-medium text-accent hover:underline">Add your first KPI</button>
                  )}
                </td>
              </tr>
            ) : groups.map((g) => (
              <BoardGroup key={g.key} name={g.name} rows={g.rows} colSpan={COLS.length}>
                {g.rows.map((r) => {
                  const Icon = kpiIcon(r.definition);
                  const owner = r.owner?.name ?? null;
                  return (
                    <tr key={r.definition.id} className="hover:bg-primary/[0.03] transition-colors">
                      <td className="pl-5 pr-4 py-4">
                        <button onClick={() => onOpen(r.definition.id)} className="flex items-center gap-3 text-left group">
                          <span className="h-10 w-10 rounded-full bg-foreground/5 text-foreground/80 grid place-items-center shrink-0">
                            <Icon size={17} />
                          </span>
                          <span className="min-w-0">
                            <span className="font-semibold text-foreground group-hover:text-accent transition-colors flex items-center gap-1.5 flex-wrap">
                              {r.definition.metric}
                              {r.definition.source === "AUTO" && <AutoTag />}
                              {r.definition.state === "DRAFT" && <Tag>Draft</Tag>}
                              {r.children.count > 0 && <Tag title="KPIs that feed into this one">{r.children.count} below</Tag>}
                            </span>
                            <span className="block text-xs text-muted truncate max-w-[280px]">
                              {[r.parent ? `↳ ${r.parent.metric} (${companyName(r.parent.company)})` : null, windowLabel(r.window, r.definition.frequency)].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          {owner ? (
                            <span className={clsx("h-8 w-8 rounded-full grid place-items-center text-[11px] font-semibold text-white shrink-0", avatarColor(owner))}>{initials(owner)}</span>
                          ) : (
                            <span className="h-8 w-8 rounded-full grid place-items-center bg-foreground/5 text-muted shrink-0"><Users size={14} /></span>
                          )}
                          <div className="min-w-0">
                            <div className={clsx("text-[13px] font-medium truncate max-w-[160px]", owner ? "text-foreground" : "text-muted")}>{owner ?? "No owner"}</div>
                            <div className="text-xs text-muted truncate max-w-[160px]">{r.department?.name ?? "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-foreground tabular-nums whitespace-nowrap">{fmtKpiVal(r.current, r.definition.unit)}</td>
                      <td className="px-4 py-4 text-foreground/80 tabular-nums whitespace-nowrap" title={r.targetCarried ? "Carried over from an earlier period" : undefined}>
                        {fmtKpiVal(r.target, r.definition.unit)}{r.targetCarried && <span className="text-muted/60">*</span>}
                      </td>
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
                      <td className="px-4 py-4 whitespace-nowrap"><TrendCell trend={r.attainment != null ? r.trend : ""} /></td>
                      <td className="px-4 py-4">{r.entry ? <ReviewBadge value={r.entry.reviewStatus as ReviewStatus} /> : <span className="text-muted/50 text-xs">—</span>}</td>
                      <td className="pl-4 pr-5 py-4">
                        <div className="flex items-center gap-0.5 justify-end">
                          {canQuickAdd(r) && (
                            <button onClick={() => quickAdd.mutate(r)} disabled={quickAdd.isPending} title="Add 1 to progress"
                              className="px-1.5 py-0.5 mr-1 rounded-md border border-border text-xs font-medium text-foreground hover:border-accent hover:text-accent transition-colors disabled:opacity-50">+1</button>
                          )}
                          <button
                            onClick={() => onOpen(r.definition.id)}
                            className="px-3 py-1.5 mr-1 rounded-lg border border-border text-xs font-medium text-foreground whitespace-nowrap hover:border-accent hover:text-accent transition-colors"
                          >
                            Update progress
                          </button>
                          {canManage && (
                            <Menu width={210} trigger={({ toggle }) => (
                              <IconButton title="More actions" onClick={toggle}><MoreHorizontal size={16} /></IconButton>
                            )}>
                              {(close) => (
                                <>
                                  {!r.window.windowed && (
                                    <MenuItem icon={<Target size={14} />} onClick={() => { close(); onSetTarget(r); }}>Set target for {periodLabelFor(period, r.definition.frequency)}</MenuItem>
                                  )}
                                  <MenuItem icon={<Settings2 size={14} />} onClick={() => { close(); onEdit(r.definition); }}>Edit KPI</MenuItem>
                                  <MenuItem icon={<Archive size={14} />} danger onClick={() => { close(); onArchive(r.definition); }}>Archive KPI</MenuItem>
                                </>
                              )}
                            </Menu>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </BoardGroup>
            ))}
          </tbody>
        </table>
      </div>

      {view === "list" && rows.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
          <span className="text-muted">{(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, rows.length)} of {rows.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe <= 1} className="p-1.5 rounded-lg border border-border text-foreground hover:bg-primary/5 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span className="px-2 text-muted">Page {pageSafe} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe >= totalPages} className="p-1.5 rounded-lg border border-border text-foreground hover:bg-primary/5 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}