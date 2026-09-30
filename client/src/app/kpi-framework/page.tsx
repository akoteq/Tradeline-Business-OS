"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { useAuth } from "@/components/AuthProvider";
import {
  TrendingUp, TrendingDown, Minus, Plus, Pencil, X, Settings2, Trash2,
  ChevronLeft, ChevronRight, Zap, Lock,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type Def = {
  id: string; metric: string; company: string; department: string | null; definition: string | null;
  unit: string; higherIsBetter: boolean; frequency: string;
  source: string; autoKey: string | null;
};
type AutoKey = { key: string; label: string; unit: string };
type Entry = {
  id: string; definitionId: string; period: string; current: number | null; target: number | null;
  priority: string; actionPlan: string | null; decisionRequired: string | null;
  executiveCommentary: string | null; dataSource: string | null; bdoId: string | null; company: string | null;
  reviewStatus: ReviewStatus;
};
type AuditLog = {
  id: string; action: string; field: string | null; previousValue: string | null; newValue: string | null;
  reviewStatus: string | null; actorEmail: string | null; actorRole: string | null; note: string | null; createdAt: string;
};

type Status = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "NO_TARGET";
type ReviewStatus = "DRAFT" | "TARGET_SET" | "ACTUAL_SUBMITTED" | "VERIFIED" | "LOCKED";
type BoardRow = {
  definition: Def; entry: Entry | null;
  current: number | null; target: number | null; variance: number; attainment: number | null;
  status: Status; trend: string;
};
type Dept = { department: string; count: number };

const UNIT_OPTS = ["COUNT", "CURRENCY", "PERCENT", "SCORE", "DAYS", "HOURS"];
const FREQ_OPTS = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"];
const STATUS_LIST: Status[] = ["ON_TRACK", "AT_RISK", "OFF_TRACK", "NO_TARGET"];

// Same restrained tinted pills as the leads page.
const STATUS_STYLE: Record<Status, string> = {
  ON_TRACK: "bg-emerald-500/10 text-emerald-700",
  AT_RISK: "bg-amber-500/10 text-amber-700",
  OFF_TRACK: "bg-red-500/10 text-red-700",
  NO_TARGET: "bg-foreground/5 text-muted",
};
const STATUS_BAR: Record<Status, string> = {
  ON_TRACK: "bg-emerald-500", AT_RISK: "bg-amber-500", OFF_TRACK: "bg-red-500", NO_TARGET: "bg-border",
};
const STATUS_LABEL: Record<Status, string> = {
  ON_TRACK: "On Track", AT_RISK: "At Risk", OFF_TRACK: "Off Track", NO_TARGET: "No Target",
};

const REVIEW_STYLE: Record<ReviewStatus, string> = {
  DRAFT: "bg-foreground/5 text-muted",
  TARGET_SET: "bg-sky-500/10 text-sky-700",
  ACTUAL_SUBMITTED: "bg-accent/10 text-accent",
  VERIFIED: "bg-emerald-500/10 text-emerald-700",
  LOCKED: "bg-primary text-accent-foreground",
};
const REVIEW_LABEL: Record<ReviewStatus, string> = {
  DRAFT: "Draft", TARGET_SET: "Target set", ACTUAL_SUBMITTED: "Submitted", VERIFIED: "Verified", LOCKED: "Locked",
};

// Mirrors TRANSITIONS in server/src/routes/kpiFramework.ts — the server is the authority,
// this only decides which buttons to show.
const MANAGER_ROLES = ["SENIOR_BDO", "MANAGING_PARTNER", "SENIOR_PARTNER", "ADMIN", "CEO"];
const ADMIN_ROLES = ["ADMIN", "CEO"];
const TRANSITIONS: { action: string; label: string; from: ReviewStatus[]; roles: string[] | null }[] = [
  { action: "submit_target", label: "Submit target", from: ["DRAFT"], roles: null },
  { action: "submit_actual", label: "Submit actual", from: ["DRAFT", "TARGET_SET"], roles: null },
  { action: "verify", label: "Verify", from: ["ACTUAL_SUBMITTED"], roles: MANAGER_ROLES },
  { action: "lock", label: "Lock", from: ["VERIFIED"], roles: ADMIN_ROLES },
  { action: "reopen", label: "Reopen", from: ["TARGET_SET", "ACTUAL_SUBMITTED", "VERIFIED", "LOCKED"], roles: ADMIN_ROLES },
];

const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-60";
const selectClass =
  "text-sm bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40";

function fmtVal(v: number | null, unit: string) {
  if (v == null) return "—";
  if (unit === "CURRENCY") return "GHS " + v.toLocaleString();
  if (unit === "PERCENT") return `${v}%`;
  if (unit === "SCORE") return `${v}/100`;
  if (unit === "DAYS") return `${v}d`;
  if (unit === "HOURS") return `${v}h`;
  return v.toLocaleString();
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "IMPROVING") return <span className="inline-flex items-center gap-1 text-emerald-700 text-xs"><TrendingUp size={13} /> Improving</span>;
  if (trend === "NEEDS_ATTENTION") return <span className="inline-flex items-center gap-1 text-red-700 text-xs"><TrendingDown size={13} /> Attention</span>;
  if (trend === "STABLE") return <span className="inline-flex items-center gap-1 text-muted text-xs"><Minus size={13} /> Stable</span>;
  return <span className="text-muted/50 text-xs">—</span>;
}

function AutoTag() {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-700 px-1.5 py-0.5 rounded"
      title="Actual is auto-calculated from live data"
    >
      <Zap size={9} /> Auto
    </span>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function KpiFrameworkPage() {
  const { user } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const qc = useQueryClient();
  const { companies } = useCompanies();

  const PAGE_SIZE = 15;
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [company, setCompany] = useState("GROUP");
  const [department, setDepartment] = useState<string>(""); // "" = all departments
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [page, setPage] = useState(1);
  const [editRow, setEditRow] = useState<BoardRow | null>(null);
  const [showDefForm, setShowDefForm] = useState(false);
  const [editDef, setEditDef] = useState<Def | null>(null);

  // Company picker: Group + every active company.
  const companyOpts = [{ key: "GROUP", name: "Group" }, ...companies.map((c) => ({ key: c.key, name: c.name }))];

  // Departments that exist within the selected company (optional sub-filter).
  const { data: departments = [] } = useQuery<Dept[]>({
    queryKey: ["kpi-departments", company],
    queryFn: () => fetcher(`/kpi-framework/departments?company=${company}`),
  });

  // Reset the department sub-filter whenever the company changes.
  useEffect(() => { setDepartment(""); }, [company]);

  const qp = new URLSearchParams({ period, company });
  if (department) qp.set("department", department);

  const { data: board = [], isLoading } = useQuery<BoardRow[]>({
    queryKey: ["kpi-board", company, department, period],
    queryFn: () => fetcher(`/kpi-framework/board?${qp}`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["kpi-board"] });
  const refreshAll = () => { qc.invalidateQueries({ queryKey: ["kpi-departments"] }); invalidate(); };

  const deleteDef = useMutation({
    mutationFn: (id: string) => api.delete(`/kpi-framework/definitions/${id}`),
    onSuccess: refreshAll,
  });

  const counts = board.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );
  const scored = board.filter((r) => r.attainment != null);
  const avgAttainment = scored.length
    ? Math.round(scored.reduce((s, r) => s + (r.attainment ?? 0), 0) / scored.length)
    : null;

  const rows = statusFilter ? board.filter((r) => r.status === statusFilter) : board;

  // Client-side pagination of the board.
  useEffect(() => { setPage(1); }, [company, department, period, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = rows.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">Performance</p>
          <h1 className="font-serif text-2xl md:text-3xl text-foreground">KPI Framework</h1>
          <p className="text-sm text-muted mt-1">
            Targets vs actuals for {periodLabel(period)}. Status is calculated, not typed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
            className={selectClass + " py-2"}
          />
          {isAdmin && (
            <button
              onClick={() => setShowDefForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              <Plus size={15} /> Add KPI
            </button>
          )}
        </div>
      </div>

      {/* Company tabs + optional department */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 p-1 bg-surface border border-border rounded-xl">
          {companyOpts.map((c) => (
            <button
              key={c.key}
              onClick={() => setCompany(c.key)}
              className={clsx(
                "px-3 py-1.5 text-sm rounded-lg transition-colors",
                company === c.key ? "bg-primary text-accent-foreground font-medium" : "text-foreground/70 hover:bg-primary/5",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        {departments.length > 0 && (
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className={selectClass + " py-2"}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.department} value={d.department}>{d.department} ({d.count})</option>)}
          </select>
        )}
      </div>

      {/* Summary — click a status to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-border bg-primary text-accent-foreground p-3">
          <div className="text-[11px] font-medium uppercase tracking-wider opacity-60 mb-2">Avg attainment</div>
          <div className="text-2xl font-semibold tabular-nums">{avgAttainment != null ? `${avgAttainment}%` : "—"}</div>
          <div className="text-[11px] opacity-60 mt-0.5">{board.length} KPI{board.length === 1 ? "" : "s"} tracked</div>
        </div>
        {STATUS_LIST.map((s) => {
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(active ? "" : s)}
              className={clsx(
                "rounded-xl border p-3 text-left transition-all bg-surface",
                active ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/40",
              )}
            >
              <div className={`inline-block px-1.5 py-0.5 rounded-full text-[11px] font-medium mb-2 ${STATUS_STYLE[s]}`}>
                {STATUS_LABEL[s]}
              </div>
              <div className="text-2xl font-semibold text-foreground tabular-nums">{counts[s] ?? 0}</div>
            </button>
          );
        })}
      </div>

      {/* Board */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {rows.length} KPI{rows.length === 1 ? "" : "s"}
            {statusFilter && <span className="text-muted font-normal"> · {STATUS_LABEL[statusFilter]}</span>}
          </span>
          {statusFilter && (
            <button onClick={() => setStatusFilter("")} className="text-xs text-muted hover:text-accent transition-colors">
              Clear filter
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                {["KPI", "Actual", "Target", "Attainment", "Status", "Trend", "Review", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-muted">{board.length === 0 ? "No KPIs set up for this company yet." : "No KPIs match this filter."}</p>
                    {isAdmin && board.length === 0 && (
                      <button onClick={() => setShowDefForm(true)} className="mt-3 text-sm font-medium text-accent hover:underline">
                        Add the first KPI
                      </button>
                    )}
                  </td>
                </tr>
              ) : pageRows.map((r) => (
                <tr key={r.definition.id} className="hover:bg-primary/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => setEditRow(r)} className="text-left group">
                      <div className="font-medium text-foreground group-hover:text-accent transition-colors flex items-center gap-1.5">
                        {r.definition.metric}
                        {r.definition.source === "AUTO" && <AutoTag />}
                      </div>
                      <div className="text-[11px] text-muted truncate max-w-[240px]">
                        {[r.definition.department, r.definition.frequency.toLowerCase()].filter(Boolean).join(" · ")}
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground tabular-nums whitespace-nowrap">{fmtVal(r.current, r.definition.unit)}</td>
                  <td className="px-4 py-3 text-muted tabular-nums whitespace-nowrap">{fmtVal(r.target, r.definition.unit)}</td>
                  <td className="px-4 py-3 min-w-[120px]">
                    {r.attainment != null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                          <div className={`h-full rounded-full ${STATUS_BAR[r.status]}`} style={{ width: `${Math.min(100, r.attainment)}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-foreground w-10 text-right">{r.attainment}%</span>
                      </div>
                    ) : <span className="text-muted/50">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><TrendIcon trend={r.trend} /></td>
                  <td className="px-4 py-3">
                    {r.entry ? <ReviewBadge value={r.entry.reviewStatus} /> : <span className="text-muted/50 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5 justify-end">
                      <IconButton title="Enter target / actual" onClick={() => setEditRow(r)}><Pencil size={14} /></IconButton>
                      {isAdmin && (
                        <>
                          <IconButton title="Edit KPI" onClick={() => setEditDef(r.definition)}><Settings2 size={14} /></IconButton>
                          <IconButton
                            title="Delete KPI"
                            danger
                            onClick={() => { if (window.confirm(`Delete KPI "${r.definition.metric}"? This removes it from the framework.`)) deleteDef.mutate(r.definition.id); }}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
            <span className="text-muted">
              {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, rows.length)} of {rows.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
                className="p-1.5 rounded-lg border border-border text-foreground hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed"
              ><ChevronLeft size={16} /></button>
              <span className="px-2 text-muted">Page {pageSafe} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe >= totalPages}
                className="p-1.5 rounded-lg border border-border text-foreground hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed"
              ><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {editRow && (
        <EntryModal
          row={editRow}
          period={period}
          company={company}
          role={user?.role ?? ""}
          onClose={() => setEditRow(null)}
          onSaved={invalidate}
        />
      )}
      {(showDefForm || editDef) && (
        <DefinitionModal
          editDef={editDef}
          departments={departments}
          companyOpts={companyOpts}
          defaultCompany={company}
          onClose={() => { setShowDefForm(false); setEditDef(null); }}
          onSaved={() => { setShowDefForm(false); setEditDef(null); refreshAll(); }}
        />
      )}
    </div>
  );
}

function ReviewBadge({ value }: { value: ReviewStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${REVIEW_STYLE[value] ?? REVIEW_STYLE.DRAFT}`}>
      {value === "LOCKED" && <Lock size={10} />}
      {REVIEW_LABEL[value] ?? value}
    </span>
  );
}

function IconButton({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        "p-1.5 rounded-lg text-muted transition-colors",
        danger ? "hover:text-red-600 hover:bg-red-500/10" : "hover:text-accent hover:bg-accent/10",
      )}
    >
      {children}
    </button>
  );
}

function Modal({ title, subtitle, onClose, footer, children, wide }: {
  title: React.ReactNode; subtitle?: string; onClose: () => void; footer: React.ReactNode; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className={clsx("bg-surface rounded-2xl shadow-xl border border-border w-full max-h-[90vh] flex flex-col", wide ? "max-w-lg" : "max-w-md")}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-serif text-lg text-foreground flex items-center gap-2">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors shrink-0"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">{children}</div>
        <div className="px-5 py-3 border-t border-border flex flex-wrap justify-end gap-2 shrink-0">{footer}</div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted block mb-1">{children}</label>;
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-lg">{message}</p>;
}

const btnSecondary = "px-4 py-2 text-sm text-foreground rounded-lg border border-border hover:bg-primary/5 transition-colors disabled:opacity-50";
const btnPrimary = "px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity";

// ─── Entry editor: set target; actual is typed for MANUAL, live for AUTO ───
function EntryModal({ row, period, company, role, onClose, onSaved }: {
  row: BoardRow; period: string; company: string; role: string; onClose: () => void; onSaved: () => void;
}) {
  const { definition, current } = row;
  const isAuto = definition.source === "AUTO";
  const [entry, setEntry] = useState<Entry | null>(row.entry);
  const [form, setForm] = useState({
    current: row.entry?.current != null ? String(row.entry.current) : "",
    target: row.entry?.target != null ? String(row.entry.target) : "",
    actionPlan: row.entry?.actionPlan ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const review: ReviewStatus = entry?.reviewStatus ?? "DRAFT";
  const locked = review === "LOCKED";
  const actions = entry
    ? TRANSITIONS.filter((t) => t.from.includes(review) && (!t.roles || t.roles.includes(role)))
    : [];

  const { data: audit = [], refetch: refetchAudit } = useQuery<AuditLog[]>({
    queryKey: ["kpi-audit", entry?.id],
    queryFn: () => fetcher(`/kpi-framework/entries/${entry!.id}/audit`),
    enabled: !!entry,
  });

  const save = async () => {
    setBusy(true); setError("");
    const body = {
      definitionId: definition.id,
      period: `${period}-01`,
      // AUTO KPIs never store an actual — it's computed live.
      current: isAuto ? null : (form.current !== "" ? Number(form.current) : null),
      target: form.target !== "" ? Number(form.target) : null,
      actionPlan: form.actionPlan || null,
      company,
      bdoId: entry?.bdoId ?? null,
    };
    try {
      const res = entry
        ? await api.put(`/kpi-framework/entries/${entry.id}`, body)
        : await api.post("/kpi-framework/entries", body);
      setEntry(res.data);
      onSaved();
      refetchAudit();
    } catch (err) {
      setError(apiError(err, "Failed to save."));
    } finally { setBusy(false); }
  };

  const transition = async (action: string) => {
    if (!entry) return;
    setBusy(true); setError("");
    try {
      const res = await api.post(`/kpi-framework/entries/${entry.id}/transition`, { action });
      setEntry(res.data);
      onSaved();
      refetchAudit();
    } catch (err) {
      setError(apiError(err, "Failed to update review status."));
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title={<>{definition.metric}{isAuto && <AutoTag />}</>}
      subtitle={[definition.department, periodLabel(period), definition.unit.toLowerCase()].filter(Boolean).join(" · ")}
      onClose={onClose}
      footer={
        <>
          {actions.map((t) => (
            <button key={t.action} onClick={() => transition(t.action)} disabled={busy} className={btnSecondary}>
              {t.label}
            </button>
          ))}
          <span className="flex-1" />
          <button onClick={onClose} className={btnSecondary}>Close</button>
          <button onClick={save} disabled={busy || locked} className={btnPrimary}>{busy ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <div className="flex items-center justify-between">
        <ReviewBadge value={review} />
        {!entry && <span className="text-[11px] text-muted">Save once to start the review workflow.</span>}
      </div>

      {definition.definition && (
        <p className="text-xs text-muted bg-background border border-border rounded-lg p-3 leading-relaxed">{definition.definition}</p>
      )}
      {locked && (
        <p className="text-xs text-foreground bg-foreground/5 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <Lock size={12} /> This scorecard is locked. An admin must reopen it before values can change.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Actual {isAuto && <span className="text-sky-700">(auto)</span>}</Label>
          {isAuto ? (
            <div className="w-full border border-sky-200 rounded-lg px-3 py-2 text-sm bg-sky-500/5 text-sky-800 tabular-nums">{fmtVal(current, definition.unit)}</div>
          ) : (
            <input type="number" value={form.current} onChange={(e) => set("current", e.target.value)} disabled={locked} className={inputClass} />
          )}
        </div>
        <div>
          <Label>Target</Label>
          <input type="number" value={form.target} onChange={(e) => set("target", e.target.value)} disabled={locked} className={inputClass} />
        </div>
      </div>
      {isAuto && (
        <p className="text-[11px] text-sky-700 bg-sky-500/5 rounded-lg px-3 py-2">
          The actual is calculated live from your deals, leads, referrals & partnerships. Just set the target.
        </p>
      )}

      <div>
        <Label>Note</Label>
        <textarea
          value={form.actionPlan}
          onChange={(e) => set("actionPlan", e.target.value)}
          rows={2}
          className={inputClass + " resize-none"}
          placeholder="Optional action plan / context"
        />
      </div>

      <ErrorNote message={error} />

      {entry && audit.length > 0 && (
        <div className="pt-1">
          <p className="text-xs font-semibold text-muted mb-2">Change history</p>
          <ul className="space-y-1.5 max-h-40 overflow-y-auto border-l border-border pl-3">
            {audit.map((l) => (
              <li key={l.id} className="text-[11px] text-muted">
                <span className="text-muted/60 mr-2">{new Date(l.createdAt).toLocaleDateString()}</span>
                <span className="font-medium text-foreground">{l.action.replace(/_/g, " ")}</span>
                {l.field
                  ? <> — {l.field}: <span className="line-through">{l.previousValue || "—"}</span> → {l.newValue || "—"}</>
                  : l.previousValue && l.newValue && <> — {l.previousValue.replace(/_/g, " ").toLowerCase()} → {l.newValue.replace(/_/g, " ").toLowerCase()}</>}
                {l.actorEmail && <span className="text-muted/70"> · {l.actorEmail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

// ─── Add / Edit KPI definition (admin) ──────────────────────────────────────
function DefinitionModal({ editDef, departments, companyOpts, defaultCompany, onClose, onSaved }: {
  editDef?: Def | null; departments: Dept[]; companyOpts: { key: string; name: string }[]; defaultCompany: string; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!editDef;
  const { data: autoKeys = [] } = useQuery<AutoKey[]>({ queryKey: ["kpi-auto-keys"], queryFn: () => fetcher("/kpi-framework/auto-keys") });
  const [form, setForm] = useState({
    metric: editDef?.metric ?? "",
    company: editDef?.company ?? defaultCompany ?? "GROUP",
    department: editDef?.department ?? "",
    definition: editDef?.definition ?? "",
    unit: editDef?.unit ?? "COUNT",
    higherIsBetter: editDef?.higherIsBetter ?? true,
    frequency: editDef?.frequency ?? "MONTHLY",
    source: editDef?.source ?? "MANUAL",
    autoKey: editDef?.autoKey ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  // Picking an auto-feed also sets a sensible unit.
  const pickAutoKey = (key: string) => {
    const ak = autoKeys.find((a) => a.key === key);
    setForm((f) => ({ ...f, autoKey: key, unit: ak?.unit ?? f.unit }));
  };

  const save = async () => {
    if (!form.metric.trim()) { setError("Metric name is required."); return; }
    if (form.source === "AUTO" && !form.autoKey) { setError("Pick which data feeds this auto KPI."); return; }
    setSaving(true); setError("");
    const body = {
      metric: form.metric,
      company: form.company,
      department: form.department || null,
      definition: form.definition || null,
      unit: form.unit,
      higherIsBetter: form.higherIsBetter,
      frequency: form.frequency,
      source: form.source,
      autoKey: form.source === "AUTO" ? (form.autoKey || null) : null,
    };
    try {
      if (isEdit) await api.put(`/kpi-framework/definitions/${editDef!.id}`, body);
      else await api.post("/kpi-framework/definitions", body);
      onSaved();
    } catch (err) {
      setError(apiError(err, "Failed to save."));
    } finally { setSaving(false); }
  };

  return (
    <Modal
      wide
      title={isEdit ? "Edit KPI" : "Add KPI"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={save} disabled={saving || !form.metric.trim()} className={btnPrimary}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add KPI"}
          </button>
        </>
      }
    >
      <div>
        <Label>Metric name *</Label>
        <input value={form.metric} onChange={(e) => set("metric", e.target.value)} className={inputClass} placeholder="e.g. Advisory Revenue" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Company *</Label>
          <select value={form.company} onChange={(e) => set("company", e.target.value)} className={selectClass + " w-full py-2"}>
            {companyOpts.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Department <span className="text-muted/60">(optional)</span></Label>
          <input value={form.department} onChange={(e) => set("department", e.target.value)} list="dept-list" className={inputClass} />
          <datalist id="dept-list">{departments.map((d) => <option key={d.department} value={d.department} />)}</datalist>
        </div>
        <div>
          <Label>Unit</Label>
          <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className={selectClass + " w-full py-2"}>
            {UNIT_OPTS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <Label>Frequency</Label>
          <select value={form.frequency} onChange={(e) => set("frequency", e.target.value)} className={selectClass + " w-full py-2"}>
            {FREQ_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Source: manual vs auto-computed */}
      <div>
        <Label>How is the actual measured?</Label>
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {[["MANUAL", "Entered manually"], ["AUTO", "Auto from data"]].map(([key, label], i) => (
            <button
              key={key}
              type="button"
              onClick={() => set("source", key)}
              className={clsx(
                "flex-1 px-3 py-2 transition-colors",
                i > 0 && "border-l border-border",
                form.source === key ? "bg-primary text-accent-foreground" : "bg-background text-foreground/70 hover:bg-primary/5",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {form.source === "AUTO" && (
        <div>
          <Label>Data feed *</Label>
          <select value={form.autoKey} onChange={(e) => pickAutoKey(e.target.value)} className={selectClass + " w-full py-2"}>
            <option value="">— Select a feed —</option>
            {autoKeys.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
          <p className="text-[11px] text-sky-700 mt-1">The actual updates automatically; you only set the target.</p>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" checked={form.higherIsBetter} onChange={(e) => set("higherIsBetter", e.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />
        <span>Higher is better <span className="text-muted text-xs">(uncheck for metrics like cycle time or overdue counts)</span></span>
      </label>
      <div>
        <Label>Description</Label>
        <textarea value={form.definition} onChange={(e) => set("definition", e.target.value)} rows={2} className={inputClass + " resize-none"} />
      </div>

      <ErrorNote message={error} />
    </Modal>
  );
}
