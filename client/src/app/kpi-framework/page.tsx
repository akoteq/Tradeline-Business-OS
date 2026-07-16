"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { useAuth } from "@/components/AuthProvider";
import { TrendingUp, TrendingDown, Minus, Plus, Pencil, X } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type Def = {
  id: string; metric: string; department: string | null; definition: string | null; formula: string | null;
  unit: string; higherIsBetter: boolean; frequency: string; scope: string; company: string | null;
  ownerName: string | null; strategicObjective: string | null; linkedDashboard: string | null;
};
type Entry = {
  id: string; definitionId: string; period: string; current: number | null; target: number | null;
  priority: string; actionPlan: string | null; decisionRequired: string | null;
  executiveCommentary: string | null; dataSource: string | null; bdoId: string | null; company: string | null;
  reviewStatus: string;
};
type AuditLog = {
  id: string; action: string; field: string | null; previousValue: string | null; newValue: string | null;
  reviewStatus: string | null; actorEmail: string | null; actorRole: string | null; note: string | null; createdAt: string;
};

const REVIEW_STYLE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600", TARGET_SET: "bg-blue-100 text-blue-700",
  ACTUAL_SUBMITTED: "bg-indigo-100 text-indigo-700", VERIFIED: "bg-teal-100 text-teal-700",
  LOCKED: "bg-green-100 text-green-700",
};
// Available next steps per review state.
const NEXT_ACTIONS: Record<string, { action: string; label: string }[]> = {
  DRAFT: [{ action: "submit_target", label: "Submit Target" }, { action: "submit_actual", label: "Submit Actual" }],
  TARGET_SET: [{ action: "submit_actual", label: "Submit Actual" }],
  ACTUAL_SUBMITTED: [{ action: "verify", label: "Verify" }],
  VERIFIED: [{ action: "lock", label: "Lock" }],
  LOCKED: [{ action: "reopen", label: "Reopen" }],
};
type BoardRow = {
  definition: Def; entry: Entry | null;
  current: number | null; target: number | null; variance: number; attainment: number | null;
  status: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "NO_TARGET"; trend: string;
};
type Dept = { department: string; count: number };

const UNIT_OPTS = ["COUNT", "CURRENCY", "PERCENT", "SCORE", "DAYS", "HOURS"];
const FREQ_OPTS = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"];
const SCOPE_OPTS = ["GROUP", "DEPARTMENT", "COMPANY", "BDO"];

const STATUS_STYLE: Record<string, string> = {
  ON_TRACK: "bg-green-100 text-green-700",
  AT_RISK: "bg-amber-100 text-amber-700",
  OFF_TRACK: "bg-red-100 text-red-700",
  NO_TARGET: "bg-gray-100 text-gray-500",
};
const STATUS_LABEL: Record<string, string> = {
  ON_TRACK: "On Track", AT_RISK: "At Risk", OFF_TRACK: "Off Track", NO_TARGET: "No Target",
};

function fmtVal(v: number | null, unit: string) {
  if (v == null) return "—";
  if (unit === "CURRENCY") return "GHS " + v.toLocaleString();
  if (unit === "PERCENT") return `${v}%`;
  if (unit === "SCORE") return `${v}/100`;
  if (unit === "DAYS") return `${v}d`;
  if (unit === "HOURS") return `${v}h`;
  return v.toLocaleString();
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "IMPROVING") return <span className="flex items-center gap-1 text-green-600 text-xs"><TrendingUp size={13} /> Improving</span>;
  if (trend === "NEEDS_ATTENTION") return <span className="flex items-center gap-1 text-red-600 text-xs"><TrendingDown size={13} /> Attention</span>;
  if (trend === "STABLE") return <span className="flex items-center gap-1 text-gray-500 text-xs"><Minus size={13} /> Stable</span>;
  return <span className="text-gray-300 text-xs">—</span>;
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function KpiFrameworkPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "CEO";
  const qc = useQueryClient();
  const { companies } = useCompanies();

  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [view, setView] = useState<"department" | "bdo">("department");
  const [department, setDepartment] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [bdoId, setBdoId] = useState("");
  const [editRow, setEditRow] = useState<BoardRow | null>(null);
  const [showDefForm, setShowDefForm] = useState(false);

  const { data: departments = [] } = useQuery<Dept[]>({
    queryKey: ["kpi-departments"],
    queryFn: () => fetcher("/kpi-framework/departments"),
  });
  const { data: bdos = [] } = useQuery<{ id: string; name: string; company: string }[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
  });

  // Default to the first department once loaded.
  useEffect(() => {
    if (!department && departments.length) setDepartment(departments[0].department);
  }, [departments, department]);

  const qp = new URLSearchParams({ period });
  if (view === "bdo") {
    qp.set("scope", "BDO");
    if (bdoId) qp.set("bdoId", bdoId);
  } else {
    if (department) qp.set("department", department);
    if (companyFilter) qp.set("company", companyFilter);
  }
  const boardReady = view === "bdo" ? !!bdoId : !!department;

  const { data: board = [], isLoading } = useQuery<BoardRow[]>({
    queryKey: ["kpi-board", view, department, companyFilter, bdoId, period],
    queryFn: () => fetcher(`/kpi-framework/board?${qp}`),
    enabled: boardReady,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["kpi-board"] });

  const counts = board.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI Framework</h1>
          <p className="text-sm text-gray-500">Targets vs actuals across departments — status is calculated, not typed.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {isAdmin && (
            <button
              onClick={() => setShowDefForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus size={15} /> Add KPI
            </button>
          )}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile label="On Track" value={counts.ON_TRACK ?? 0} tone="green" />
        <SummaryTile label="At Risk" value={counts.AT_RISK ?? 0} tone="amber" />
        <SummaryTile label="Off Track" value={counts.OFF_TRACK ?? 0} tone="red" />
        <SummaryTile label="No Target Yet" value={counts.NO_TARGET ?? 0} tone="gray" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          <button
            onClick={() => setView("department")}
            className={`px-3 py-2 ${view === "department" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >By Department</button>
          <button
            onClick={() => setView("bdo")}
            className={`px-3 py-2 border-l border-gray-200 ${view === "bdo" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >Per BDO</button>
        </div>

        {view === "department" ? (
          <>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {departments.map((d) => <option key={d.department} value={d.department}>{d.department} ({d.count})</option>)}
            </select>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All companies</option>
              {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          </>
        ) : (
          <select
            value={bdoId}
            onChange={(e) => setBdoId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">— Select a BDO —</option>
            {bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}
          </select>
        )}
      </div>

      {/* Board */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["KPI", "Owner", "Current", "Target", "Attainment", "Status", "Trend", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : board.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No KPIs for this filter.</td></tr>
              ) : board.map((r) => (
                <tr key={r.definition.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-900">{r.definition.metric}</div>
                    {r.definition.strategicObjective && <div className="text-[11px] text-gray-400 truncate max-w-[220px]">{r.definition.strategicObjective}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[160px] truncate">{r.definition.ownerName ?? "—"}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800 tabular-nums whitespace-nowrap">{fmtVal(r.current, r.definition.unit)}</td>
                  <td className="px-3 py-2.5 text-gray-600 tabular-nums whitespace-nowrap">{fmtVal(r.target, r.definition.unit)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{r.attainment != null ? `${r.attainment}%` : "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="px-3 py-2.5"><TrendIcon trend={r.trend} /></td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setEditRow(r)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Enter values">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editRow && (
        <EntryModal
          row={editRow}
          period={period}
          companyFilter={companyFilter}
          bdoId={view === "bdo" ? bdoId : ""}
          onClose={() => setEditRow(null)}
          onSaved={invalidate}
        />
      )}
      {showDefForm && (
        <DefinitionModal
          departments={departments}
          onClose={() => setShowDefForm(false)}
          onSaved={() => { setShowDefForm(false); qc.invalidateQueries({ queryKey: ["kpi-departments"] }); invalidate(); }}
        />
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    green: "text-green-700", amber: "text-amber-700", red: "text-red-700", gray: "text-gray-500",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tones[tone]}`}>{value}</div>
    </div>
  );
}

// ─── Entry editor ───────────────────────────────────────────────────────────
function EntryModal({ row, period, companyFilter, bdoId, onClose, onSaved }: {
  row: BoardRow; period: string; companyFilter: string; bdoId: string; onClose: () => void; onSaved: () => void;
}) {
  const { entry, definition } = row;
  const [entryId, setEntryId] = useState<string | null>(entry?.id ?? null);
  const [reviewStatus, setReviewStatus] = useState(entry?.reviewStatus ?? "DRAFT");
  const [form, setForm] = useState({
    current: entry?.current != null ? String(entry.current) : "",
    target: entry?.target != null ? String(entry.target) : "",
    priority: entry?.priority ?? "MEDIUM",
    actionPlan: entry?.actionPlan ?? "",
    executiveCommentary: entry?.executiveCommentary ?? "",
    dataSource: entry?.dataSource ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const locked = reviewStatus === "LOCKED";

  const { data: audit = [], refetch: refetchAudit } = useQuery<AuditLog[]>({
    queryKey: ["kpi-audit", entryId],
    queryFn: () => fetcher(`/kpi-framework/entries/${entryId}/audit`),
    enabled: !!entryId,
  });

  const save = async () => {
    setSaving(true); setError("");
    const body = {
      definitionId: definition.id,
      period: `${period}-01`,
      current: form.current !== "" ? Number(form.current) : null,
      target: form.target !== "" ? Number(form.target) : null,
      priority: form.priority,
      actionPlan: form.actionPlan || null,
      executiveCommentary: form.executiveCommentary || null,
      dataSource: form.dataSource || null,
      company: definition.company ?? (companyFilter || null),
      bdoId: entry?.bdoId ?? (bdoId || null),
    };
    try {
      const res = entryId
        ? await api.put(`/kpi-framework/entries/${entryId}`, body)
        : await api.post("/kpi-framework/entries", body);
      setEntryId(res.data.id);
      setReviewStatus(res.data.reviewStatus ?? reviewStatus);
      onSaved();
      refetchAudit();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to save.");
    } finally { setSaving(false); }
  };

  const transition = async (action: string) => {
    if (!entryId) { setError("Save the values first to start the workflow."); return; }
    setBusy(true); setError("");
    try {
      const res = await api.post(`/kpi-framework/entries/${entryId}/transition`, { action });
      setReviewStatus(res.data.reviewStatus);
      onSaved();
      refetchAudit();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Could not update the workflow state.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{definition.metric}</h2>
            <p className="text-xs text-gray-400">{definition.department} · {period} · {definition.unit}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {definition.definition && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{definition.definition}</p>}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}

          {/* Workflow status + actions */}
          <div className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500">Status</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${REVIEW_STYLE[reviewStatus] ?? "bg-gray-100 text-gray-600"}`}>
              {reviewStatus.replace(/_/g, " ")}
            </span>
          </div>
          {entryId && (
            <div className="flex flex-wrap gap-2">
              {(NEXT_ACTIONS[reviewStatus] ?? []).map((a) => (
                <button key={a.action} onClick={() => transition(a.action)} disabled={busy}
                  className="px-3 py-1.5 text-xs font-medium border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50">
                  {a.label}
                </button>
              ))}
            </div>
          )}
          {locked && <p className="text-[11px] text-green-700 bg-green-50 rounded-lg px-3 py-2">Locked — values can&apos;t be edited until an admin reopens it.</p>}

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Current (actual)</label><input type="number" disabled={locked} value={form.current} onChange={(e) => set("current", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Target</label><input type="number" disabled={locked} value={form.target} onChange={(e) => set("target", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" /></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Priority</label>
            <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
              {["HIGH", "MEDIUM", "LOW"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Action Plan</label><textarea value={form.actionPlan} onChange={(e) => set("actionPlan", e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" /></div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Executive Commentary</label><textarea value={form.executiveCommentary} onChange={(e) => set("executiveCommentary", e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" /></div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Data Source</label><input value={form.dataSource} onChange={(e) => set("dataSource", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>

          {/* Change history */}
          {entryId && audit.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-semibold text-gray-500 mb-2">Change history</p>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {audit.map((l) => (
                  <li key={l.id} className="text-[11px] text-gray-500 flex gap-2">
                    <span className="text-gray-300 shrink-0">{new Date(l.createdAt).toLocaleDateString()}</span>
                    <span>
                      <span className="font-medium text-gray-700">{l.action.replace(/_/g, " ")}</span>
                      {l.field && <> — {l.field}: <span className="line-through">{l.previousValue || "—"}</span> → {l.newValue || "—"}</>}
                      {l.actorEmail && <span className="text-gray-400"> · {l.actorEmail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Close</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add KPI definition (admin) ─────────────────────────────────────────────
function DefinitionModal({ departments, onClose, onSaved }: {
  departments: Dept[]; onClose: () => void; onSaved: () => void;
}) {
  const { companies } = useCompanies();
  const { data: staff = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["bdos"], queryFn: () => fetcher("/bdo") });
  const [form, setForm] = useState({
    metric: "", department: departments[0]?.department ?? "", definition: "", formula: "",
    unit: "COUNT", higherIsBetter: true, frequency: "MONTHLY", scope: "DEPARTMENT",
    company: "", ownerId: "", ownerName: "", strategicObjective: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.metric.trim()) { setError("Metric name is required."); return; }
    setSaving(true); setError("");
    try {
      const owner = staff.find((s) => s.id === form.ownerId);
      await api.post("/kpi-framework/definitions", {
        ...form,
        company: form.scope === "COMPANY" ? (form.company || null) : null,
        ownerId: form.ownerId || null,
        ownerName: owner?.name ?? form.ownerName ?? null,
      });
      onSaved();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to save.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Add KPI</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Metric name *</label><input value={form.metric} onChange={(e) => set("metric", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Advisory Revenue" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Department</label><input value={form.department} onChange={(e) => set("department", e.target.value)} list="dept-list" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <datalist id="dept-list">{departments.map((d) => <option key={d.department} value={d.department} />)}</datalist>
            </div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Scope</label>
              <select value={form.scope} onChange={(e) => set("scope", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">{SCOPE_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Unit</label>
              <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">{UNIT_OPTS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            </div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Frequency</label>
              <select value={form.frequency} onChange={(e) => set("frequency", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">{FREQ_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}</select>
            </div>
          </div>
          {form.scope === "COMPANY" && (
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Company</label>
              <select value={form.company} onChange={(e) => set("company", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
                <option value="">— Select —</option>
                {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Owner</label>
            <select value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
              <option value="">— Unassigned —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.higherIsBetter} onChange={(e) => set("higherIsBetter", e.target.checked)} />
            Higher is better <span className="text-gray-400 text-xs">(uncheck for metrics like cycle time or overdue counts)</span>
          </label>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Definition</label><textarea value={form.definition} onChange={(e) => set("definition", e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" /></div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving || !form.metric.trim()} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Add KPI"}</button>
        </div>
      </div>
    </div>
  );
}
