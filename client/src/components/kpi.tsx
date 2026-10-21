"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap, X, Trash2, Lock, ChevronRight, Ban, AlertCircle } from "lucide-react";
import { clsx } from "clsx";
import { api, fetcher } from "@/lib/api";

// Shared KPI vocabulary and pieces. The server (lib/kpiEngine.ts, lib/kpiStatus.ts) computes
// every number and status; this only shows them.
export type KpiStatus =
  | "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "NO_TARGET" | "ACHIEVED" | "STALE"
  | "OVERDUE" | "NOT_STARTED" | "DRAFT";

export const KPI_STATUS_LIST: KpiStatus[] = ["OVERDUE", "OFF_TRACK", "AT_RISK", "STALE", "ON_TRACK", "ACHIEVED", "NOT_STARTED", "NO_TARGET", "DRAFT"];

export const KPI_STATUS_STYLE: Record<KpiStatus, string> = {
  ON_TRACK: "bg-emerald-500/10 text-emerald-700",
  AT_RISK: "bg-amber-500/10 text-amber-700",
  OFF_TRACK: "bg-red-500/10 text-red-700",
  OVERDUE: "bg-red-600 text-white",
  ACHIEVED: "bg-sky-500/10 text-sky-700",
  STALE: "bg-foreground/10 text-foreground/70",
  NOT_STARTED: "bg-violet-500/10 text-violet-700",
  NO_TARGET: "bg-foreground/5 text-muted",
  DRAFT: "bg-foreground/5 text-muted italic",
};
export const KPI_STATUS_BAR: Record<KpiStatus, string> = {
  ON_TRACK: "bg-emerald-500", AT_RISK: "bg-amber-500", OFF_TRACK: "bg-red-500", OVERDUE: "bg-red-600",
  ACHIEVED: "bg-sky-500", STALE: "bg-foreground/30", NOT_STARTED: "bg-violet-400", NO_TARGET: "bg-border", DRAFT: "bg-border",
};
export const KPI_STATUS_LABEL: Record<KpiStatus, string> = {
  ON_TRACK: "On Track", AT_RISK: "At Risk", OFF_TRACK: "Behind", OVERDUE: "Overdue", ACHIEVED: "Achieved",
  STALE: "Stale", NOT_STARTED: "Not started", NO_TARGET: "No Target", DRAFT: "Draft",
};
export const KPI_STATUS_HINT: Record<KpiStatus, string> = {
  ON_TRACK: "At or above the on-track line (default 90%) of where it should be by today",
  AT_RISK: "Between the at-risk line (default 60%) and the on-track line of where it should be by today",
  OFF_TRACK: "Below the at-risk line of where it should be by today",
  OVERDUE: "The window ended and the target was missed",
  ACHIEVED: "Target reached",
  STALE: "No result logged in 7 days",
  NOT_STARTED: "The window hasn't started yet",
  NO_TARGET: "No target set yet",
  DRAFT: "Not live yet — not judged or counted",
};

// The row the server returns for every KPI (board, My KPIs, cascade, detail).
export type KpiDef = {
  id: string; metric: string; company: string; department: string | null; definition: string | null;
  unit: string; higherIsBetter: boolean; frequency: string; source: string; autoKey: string | null;
  aggregation: string; state: string; parentId: string | null; ownerId: string | null; ownerBdoId: string | null;
  categoryId: string | null; startDate: string | null; endDate: string | null; targetValue: number | null; startValue: number | null;
  milestones: { date: string; target: number }[]; assignedBy: string | null; scope?: string | null;
};
export type KpiRow = {
  definition: KpiDef;
  entry: { id: string; target: number | null; start: number | null; reviewStatus: string; bdoId: string | null } | null;
  current: number | null; target: number | null; start: number | null; targetCarried: boolean;
  variance: number; attainment: number | null; expected: number | null; pace: number | null;
  status: KpiStatus; trend: string;
  window: { start: string; end: string; windowed: boolean };
  aggregation: "SUM" | "LATEST" | "AVERAGE";
  lastUpdateAt: string | null; bdoId: string | null;
  owner: { id: string; name: string } | null;
  parent: { id: string; metric: string; company: string } | null;
  category: { id: string; name: string } | null;
  work: { tasks: number; done: number; blocked: number; overdue: number; noResult: number; pct: number | null };
  children: { count: number; allocated: number | null; unallocated: number | null; over: boolean };
};

export function fmtKpiVal(v: number | null | undefined, unit: string) {
  if (v == null) return "—";
  const n = Math.round(v * 100) / 100;
  if (unit === "CURRENCY") return "GHS " + n.toLocaleString();
  if (unit === "PERCENT") return `${n}%`;
  if (unit === "SCORE") return `${n}/100`;
  if (unit === "DAYS") return `${n}d`;
  if (unit === "HOURS") return `${n}h`;
  return n.toLocaleString();
}

const DAY = 86_400_000;
// "Oct 2026", "Q4 2026", or "1 Jan 2027 – 31 Dec 2027" for a fixed window.
export function windowLabel(w: KpiRow["window"], frequency?: string) {
  const s = new Date(w?.start);
  if (w?.windowed) {
    const e = new Date(new Date(w.end).getTime() - DAY);
    const f = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    return `${f(s)} – ${f(e)}`;
  }
  if (frequency === "WEEKLY") return `Week of ${s.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
  if (frequency === "ANNUAL") return String(s.getUTCFullYear());
  if (frequency === "QUARTERLY") return `Q${Math.floor(s.getUTCMonth() / 3) + 1} ${s.getUTCFullYear()}`;
  return s.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

// ─── Parents in the cascade ─────────────────────────────────────────────────
// A KPI another one can be "part of". targetValue is the target for the current period.
export type ParentOpt = {
  id: string; metric: string; company: string; unit: string; frequency: string;
  startDate: string | null; endDate: string | null; targetValue: number | null;
};

const PER_YEAR: Record<string, number> = { WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4, ANNUAL: 1 };
export const FREQ_WORD: Record<string, string> = { WEEKLY: "week", MONTHLY: "month", QUARTERLY: "quarter", ANNUAL: "year" };

// A KPI can be tracked as often as its parent or more often, never less (the server checks too).
export function fitsUnder(parent: ParentOpt, frequency: string) {
  if (parent.startDate && parent.endDate) return true;
  return (PER_YEAR[frequency] ?? 12) >= (PER_YEAR[parent.frequency] ?? 12);
}

// The parent's target spread over this KPI's period: 5,000,000 a year is about 416,667 a month.
export function sharePerPeriod(parent: ParentOpt | undefined, frequency: string): number | null {
  if (!parent || parent.targetValue == null || (parent.startDate && parent.endDate)) return null;
  if (parent.frequency === frequency) return null;
  return Math.round((parent.targetValue * (PER_YEAR[parent.frequency] ?? 12)) / (PER_YEAR[frequency] ?? 12));
}

// Under the target field: the parent's target per period, with a button to use it.
export function ShareHint({ parent, frequency, onUse }: { parent: ParentOpt | undefined; frequency: string; onUse: (v: number) => void }) {
  const share = sharePerPeriod(parent, frequency);
  if (share == null || !parent) return null;
  return (
    <p className="text-[11px] text-muted mt-1">
      {parent.metric} is {parent.targetValue!.toLocaleString()} a {FREQ_WORD[parent.frequency] ?? "period"}, about {share.toLocaleString()} a {FREQ_WORD[frequency] ?? "period"} in full.{" "}
      <button type="button" onClick={() => onUse(share)} className="text-accent hover:underline">Use {share.toLocaleString()}</button>
    </p>
  );
}

export function daysLeftIn(w: KpiRow["window"]): number | null {
  const now = Date.now(), end = new Date(w.end).getTime(), start = new Date(w.start).getTime();
  if (now < start || now >= end) return null;
  return Math.max(0, Math.ceil((end - now) / DAY));
}

export function StatusPill({ status, className }: { status: KpiStatus; className?: string }) {
  return (
    <span title={KPI_STATUS_HINT[status]} className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", KPI_STATUS_STYLE[status], className)}>
      {KPI_STATUS_LABEL[status]}
    </span>
  );
}

// Progress bar with a pace marker showing where the KPI should be by today.
export function PaceBar({ attainment, expected, status, className = "h-1.5" }: {
  attainment: number | null; expected: number | null; status: KpiStatus; className?: string;
}) {
  return (
    <div className={`relative flex-1 rounded-full bg-foreground/5 ${className}`}>
      <div
        className={`h-full rounded-full ${KPI_STATUS_BAR[status]}`}
        style={{ width: `${Math.min(100, Math.max(0, attainment ?? 0))}%` }}
      />
      {expected != null && expected > 0 && expected < 100 && (
        <div
          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground/60"
          style={{ left: `calc(${expected}% - 1px)` }}
          title={`Pace: ${expected}% expected by today`}
        />
      )}
    </div>
  );
}

// Work done on a KPI's linked tasks (a leading signal — it never changes the actual).
export function WorkChip({ work }: { work: KpiRow["work"] }) {
  if (!work?.tasks) return <span className="text-[11px] text-muted/60">No tasks</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted whitespace-nowrap" title="Weighted progress of the tasks linked to this KPI. A signal only — it never changes the actual.">
      <span className="tabular-nums text-foreground font-medium">{work.pct ?? 0}%</span> work · {work.done}/{work.tasks}
      {work.blocked > 0 && <span className="inline-flex items-center gap-0.5 text-amber-700"><Ban size={10} />{work.blocked}</span>}
      {work.noResult > 0 && <span className="inline-flex items-center gap-0.5 text-sky-700" title="Finished tasks with no result logged"><AlertCircle size={10} />{work.noResult}</span>}
    </span>
  );
}

// How much of a KPI's target the KPIs under it have taken.
export function AllocationBar({ row }: { row: KpiRow }) {
  const { children: c, target } = row;
  if (!c.count || target == null || !target) return null;
  const pct = Math.min(100, Math.round(((c.allocated ?? 0) / target) * 100));
  const unit = row.definition.unit;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-muted">
        <span>{c.count} KPI{c.count === 1 ? "" : "s"} under it take {fmtKpiVal(c.allocated, unit)}</span>
        <span className={c.over ? "text-red-600 font-medium" : ""}>
          {c.over ? `over by ${fmtKpiVal(-(c.unallocated ?? 0), unit)}` : `${fmtKpiVal(c.unallocated, unit)} unallocated`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
        <div className={clsx("h-full rounded-full", c.over ? "bg-red-500" : "bg-primary/60")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Bottom sheet on phones, centred dialog from sm up.
export function KpiSheet({ title, subtitle, onClose, footer, children, wide }: {
  title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose}>
      <div
        className={clsx("bg-surface shadow-xl border border-border w-full max-h-[92vh] flex flex-col", wide ? "max-w-2xl" : "max-w-md", "rounded-t-2xl sm:rounded-2xl")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-serif text-lg text-foreground flex items-center gap-2 flex-wrap">{title}</h2>
            {subtitle && <div className="text-xs text-muted mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors shrink-0" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-border flex flex-wrap justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

export function AutoTag() {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-700 px-1.5 py-0.5 rounded"
      title="Actual is auto-calculated from live data"
    >
      <Zap size={9} /> Auto
    </span>
  );
}

export function Tag({ children, title }: { children: React.ReactNode; title?: string }) {
  return <span title={title} className="text-[9px] font-semibold uppercase tracking-wider bg-foreground/5 text-foreground/60 px-1.5 py-0.5 rounded">{children}</span>;
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-60";
const btnPrimary = "px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity";

// ─── KPI detail: the number, the chain, the KPIs under it, results and work ─
type Detail = {
  row: KpiRow;
  children: KpiRow[];
  attributed: number | null;
  chain: { id: string; metric: string; company: string }[];
  canManage: boolean;
  updates: { id: string; value: number; date: string; note: string | null; person: string | null; enteredBy: string | null; createdAt: string; task: { id: string; deliverable: string } | null; canDelete: boolean }[];
  tasks: { id: string; deliverable: string; status: string; progress: number; weight: number; targetDate: string | null; bdo: string | null; blocked: boolean; noResult: boolean; kpiId: string }[];
};

export function KpiDetailSheet({ kpiId, period, bdoId, onClose, onChanged, onOpen, extra, companyName }: {
  kpiId: string; period?: string; bdoId?: string | null; onClose: () => void; onChanged?: () => void;
  onOpen?: (id: string) => void; extra?: (row: KpiRow) => React.ReactNode; companyName?: (key: string) => string;
}) {
  const qc = useQueryClient();
  const qp = new URLSearchParams();
  if (period) qp.set("period", period);
  if (bdoId) qp.set("bdoId", bdoId);
  const key = ["kpi-detail", kpiId, period ?? "", bdoId ?? ""];
  const { data, isLoading, error } = useQuery<Detail>({ queryKey: key, queryFn: () => fetcher(`/kpi-framework/definitions/${kpiId}/detail?${qp}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["kpi-detail", kpiId] }); onChanged?.(); };
  const name = (k: string) => (k === "GROUP" ? "Group" : companyName?.(k) ?? k);

  const row = data?.row;
  const d = row?.definition;
  const isAuto = d?.source === "AUTO";
  const locked = row?.entry?.reviewStatus === "LOCKED";

  return (
    <KpiSheet
      wide
      onClose={onClose}
      title={d ? <>{d.metric}{isAuto && <AutoTag />}{row && <StatusPill status={row.status} />}</> : "KPI"}
      subtitle={d && row ? (
        <span className="flex flex-wrap items-center gap-1">
          {data!.chain.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1">
              <button className="hover:text-accent" onClick={() => onOpen?.(c.id)}>{c.metric} <span className="text-muted/60">({name(c.company)})</span></button>
              <ChevronRight size={11} />
            </span>
          ))}
          <span>{name(d.company)}{row.owner ? ` · ${row.owner.name}` : ""} · {windowLabel(row.window, d.frequency)}</span>
        </span>
      ) : undefined}
    >
      {isLoading ? <p className="text-sm text-muted">Loading…</p>
        : error || !data || !row || !d ? <p className="text-sm text-red-600">{apiError(error, "Couldn't load this KPI.")}</p>
        : (
        <>
          {d.definition && <p className="text-xs text-muted bg-background border border-border rounded-lg p-3 leading-relaxed">{d.definition}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Actual" value={fmtKpiVal(row.current, d.unit)} />
            <Stat label={row.targetCarried ? "Target (carried)" : "Target"} value={fmtKpiVal(row.target, d.unit)} />
            <Stat label="Progress" value={row.attainment != null ? `${row.attainment}%` : "—"} hint={row.expected != null ? `${row.expected}% expected by today` : undefined} />
            <Stat label="Pace" value={row.pace != null ? `${row.pace}%` : "—"} hint={row.aggregation === "SUM" ? "Actual vs where it should be by today" : "Reading vs target"} />
          </div>
          <PaceBar attainment={row.attainment} expected={row.expected} status={row.status} className="h-2" />
          <p className="text-[11px] text-muted">
            {isAuto ? "Calculated live from deals, payments and other records for this scope and window."
              : row.aggregation === "SUM" ? "Total of the results logged in the window, including those logged on the KPIs under it."
              : row.aggregation === "LATEST" ? "The latest reading logged." : "The average of the readings logged."}
            {row.children.count > 0 && data.attributed != null && <> KPIs under it account for <strong>{fmtKpiVal(data.attributed, d.unit)}</strong>.</>}
          </p>

          {extra?.(row)}

          <AllocationBar row={row} />

          {data.children.length > 0 && (
            <Section title={`Under this KPI (${data.children.length})`}>
              <ul className="divide-y divide-border/60">
                {data.children.map((c) => (
                  <li key={c.definition.id}>
                    <button onClick={() => onOpen?.(c.definition.id)} className="w-full text-left py-2 flex items-center gap-3 hover:bg-primary/[0.03] rounded">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-foreground truncate">{c.definition.metric}</div>
                        <div className="text-[11px] text-muted truncate">{name(c.definition.company)}{c.owner ? ` · ${c.owner.name}` : ""}</div>
                      </div>
                      <span className="text-xs tabular-nums text-muted whitespace-nowrap">{fmtKpiVal(c.current, c.definition.unit)} / {fmtKpiVal(c.target, c.definition.unit)}</span>
                      <StatusPill status={c.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {!isAuto && !locked && <LogResult row={row} bdoId={bdoId ?? row.bdoId} tasks={data.tasks.filter((t) => t.kpiId === d.id)} onSaved={refresh} />}
          {locked && <p className="text-xs text-foreground bg-foreground/5 rounded-lg px-3 py-2 flex items-center gap-1.5"><Lock size={12} /> This period is locked. A Group Owner must reopen it before results can change.</p>}

          {data.updates.length > 0 && (
            <Section title="Results">
              <ul className="space-y-1.5 max-h-56 overflow-y-auto border-l border-border pl-3">
                {data.updates.map((u) => (
                  <li key={u.id} className="text-[11px] text-muted flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-muted/70 mr-2">{new Date(u.date).toLocaleDateString()}</span>
                      <span className={clsx("font-medium tabular-nums", u.value < 0 ? "text-red-600" : "text-foreground")}>{u.value > 0 && row.aggregation === "SUM" ? "+" : ""}{fmtKpiVal(u.value, d.unit)}</span>
                      {u.person && <span> · {u.person}</span>}
                      {u.task && <span> · from “{u.task.deliverable}”</span>}
                      {u.note && <span className="italic"> · {u.note}</span>}
                      {u.enteredBy && <span className="text-muted/70"> · {u.enteredBy}</span>}
                    </div>
                    {u.canDelete && (
                      <button
                        title="Remove this result"
                        onClick={async () => {
                          if (!window.confirm("Remove this result line?")) return;
                          try { await api.delete(`/kpi-framework/updates/${u.id}`); refresh(); }
                          catch (err) { window.alert(apiError(err, "Couldn't remove it.")); }
                        }}
                        className="shrink-0 p-0.5 rounded text-muted hover:text-red-600"
                      ><Trash2 size={12} /></button>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={`Work behind it${row.work.tasks ? ` · ${row.work.pct ?? 0}% done` : ""}`}>
            {data.tasks.length === 0 ? (
              <p className="text-xs text-muted">No tasks linked yet. Link tasks to this KPI from the task form.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {data.tasks.map((t) => (
                  <li key={t.id} className="py-1.5 flex items-center gap-2 text-xs">
                    <span className="flex-1 min-w-0 truncate text-foreground">{t.deliverable}</span>
                    {t.blocked && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 font-medium">Blocked</span>}
                    {t.noResult && <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 font-medium">No result logged</span>}
                    <span className="text-muted whitespace-nowrap">{t.bdo ?? "Unassigned"}</span>
                    <span className="text-muted tabular-nums w-10 text-right">{t.status === "COMPLETED" ? "Done" : `${t.progress}%`}</span>
                    <span className="text-muted/60 w-6 text-right" title="Weight">×{t.weight}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </KpiSheet>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2" title={hint}>
      <div className="text-[10px] font-medium text-muted uppercase tracking-wider">{label}</div>
      <div className="text-lg font-semibold text-foreground tabular-nums truncate">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted mb-1.5">{title}</p>
      {children}
    </div>
  );
}

// Log a result line: an amount added (total KPIs) or a new reading (rates, scores).
export function LogResult({ row, bdoId, tasks = [], onSaved, defaultTaskId }: {
  row: KpiRow; bdoId?: string | null; tasks?: { id: string; deliverable: string }[]; onSaved: () => void; defaultTaskId?: string | null;
}) {
  const sum = row.aggregation === "SUM";
  const [value, setValue] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [taskId, setTaskId] = useState(defaultTaskId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (value === "") { setError("Enter a number."); return; }
    setBusy(true); setError("");
    try {
      await api.post("/kpi-framework/updates", { kpiId: row.definition.id, value, date, note: note || undefined, taskId: taskId || undefined, bdoId: bdoId ?? undefined });
      setValue(""); setNote(""); setTaskId("");
      onSaved();
    } catch (err) {
      setError(apiError(err, "Couldn't log the result."));
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
      <p className="text-xs font-semibold text-muted">{sum ? "Log a result" : "Log a new reading"}</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className={inputCls + " tabular-nums"} placeholder={sum ? "e.g. 1 (adds to the total)" : "Current reading"} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        {tasks.length > 0 && (
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={inputCls + " col-span-2"}>
            <option value="">Not from a specific task</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>From: {t.deliverable}</option>)}
          </select>
        )}
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls + " col-span-2"} placeholder="Note (optional), e.g. ERP deal, Client E" maxLength={200} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving…" : sum ? "Add result" : "Save reading"}</button>
      </div>
    </div>
  );
}
