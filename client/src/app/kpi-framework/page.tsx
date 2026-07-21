"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { useAuth } from "@/components/AuthProvider";
import { TrendingUp, TrendingDown, Minus, Plus, Pencil, X, Settings2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

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
  reviewStatus: string;
};
type AuditLog = {
  id: string; action: string; field: string | null; previousValue: string | null; newValue: string | null;
  reviewStatus: string | null; actorEmail: string | null; actorRole: string | null; note: string | null; createdAt: string;
};

type BoardRow = {
  definition: Def; entry: Entry | null;
  current: number | null; target: number | null; variance: number; attainment: number | null;
  status: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "NO_TARGET"; trend: string;
};
type Dept = { department: string; count: number };

const UNIT_OPTS = ["COUNT", "CURRENCY", "PERCENT", "SCORE", "DAYS", "HOURS"];
const FREQ_OPTS = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"];

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

  const PAGE_SIZE = 15;
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [company, setCompany] = useState("GROUP");
  const [department, setDepartment] = useState<string>(""); // "" = all departments
  const [page, setPage] = useState(1);
  const [editRow, setEditRow] = useState<BoardRow | null>(null);
  const [showDefForm, setShowDefForm] = useState(false);
  const [editDef, setEditDef] = useState<Def | null>(null);

  // Company picker: Group + every active company.
  const companyOpts = [{ key: "GROUP", name: "Group / All" }, ...companies.map((c) => ({ key: c.key, name: c.name }))];

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

  // Client-side pagination of the board.
  useEffect(() => { setPage(1); }, [company, department, period]);
  const totalPages = Math.max(1, Math.ceil(board.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = board.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI Framework</h1>
          <p className="text-sm text-gray-500">Targets vs actuals per company — status is calculated, not typed.</p>
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

      {/* Filters — pick a company; optionally narrow to a department */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {companyOpts.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
        {departments.length > 0 && (
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.department} value={d.department}>{d.department} ({d.count})</option>)}
          </select>
        )}
      </div>

      {/* Board */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["KPI", "Current", "Target", "Attainment", "Status", "Trend", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : board.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No KPIs for this filter.</td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.definition.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-900 flex items-center gap-1.5">
                      {r.definition.metric}
                      {r.definition.source === "AUTO" && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded" title="Actual is auto-calculated from live data">Auto</span>
                      )}
                    </div>
                    {r.definition.definition && <div className="text-[11px] text-gray-400 truncate max-w-[220px]">{r.definition.definition}</div>}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-800 tabular-nums whitespace-nowrap">{fmtVal(r.current, r.definition.unit)}</td>
                  <td className="px-3 py-2.5 text-gray-600 tabular-nums whitespace-nowrap">{fmtVal(r.target, r.definition.unit)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{r.attainment != null ? `${r.attainment}%` : "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="px-3 py-2.5"><TrendIcon trend={r.trend} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setEditRow(r)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Enter target / actual">
                        <Pencil size={14} />
                      </button>
                      {isAdmin && (
                        <>
                          <button onClick={() => setEditDef(r.definition)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Edit KPI">
                            <Settings2 size={14} />
                          </button>
                          <button
                            onClick={() => { if (window.confirm(`Delete KPI "${r.definition.metric}"? This removes it from the framework.`)) deleteDef.mutate(r.definition.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete KPI"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {board.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
            <span className="text-gray-500">
              {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, board.length)} of {board.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              ><ChevronLeft size={16} /></button>
              <span className="px-2 text-gray-600">Page {pageSafe} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe >= totalPages}
                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
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

// ─── Entry editor (simple: set target; actual is typed for MANUAL, live for AUTO) ────
function EntryModal({ row, period, company, onClose, onSaved }: {
  row: BoardRow; period: string; company: string; onClose: () => void; onSaved: () => void;
}) {
  const { entry, definition, current } = row;
  const isAuto = definition.source === "AUTO";
  const [entryId, setEntryId] = useState<string | null>(entry?.id ?? null);
  const [form, setForm] = useState({
    current: entry?.current != null ? String(entry.current) : "",
    target: entry?.target != null ? String(entry.target) : "",
    actionPlan: entry?.actionPlan ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

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
      // AUTO KPIs never store an actual — it's computed live.
      current: isAuto ? null : (form.current !== "" ? Number(form.current) : null),
      target: form.target !== "" ? Number(form.target) : null,
      actionPlan: form.actionPlan || null,
      company,
      bdoId: entry?.bdoId ?? null,
    };
    try {
      const res = entryId
        ? await api.put(`/kpi-framework/entries/${entryId}`, body)
        : await api.post("/kpi-framework/entries", body);
      setEntryId(res.data.id);
      onSaved();
      refetchAudit();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to save.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-1.5">
              {definition.metric}
              {isAuto && <span className="text-[9px] font-semibold uppercase tracking-wide bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">Auto</span>}
            </h2>
            <p className="text-xs text-gray-400">{definition.department} · {period} · {definition.unit}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {definition.definition && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{definition.definition}</p>}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Actual {isAuto && <span className="text-sky-600">(auto)</span>}</label>
              {isAuto ? (
                <div className="w-full border rounded-lg px-3 py-2 text-sm bg-sky-50 text-sky-800 tabular-nums">{fmtVal(current, definition.unit)}</div>
              ) : (
                <input type="number" value={form.current} onChange={(e) => set("current", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              )}
            </div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Target</label><input type="number" value={form.target} onChange={(e) => set("target", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          {isAuto && <p className="text-[11px] text-sky-700 bg-sky-50 rounded-lg px-3 py-2">The actual is calculated live from your deals, leads, referrals & partnerships. Just set the target.</p>}

          <div><label className="text-xs font-medium text-gray-600 block mb-1">Note</label><textarea value={form.actionPlan} onChange={(e) => set("actionPlan", e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" placeholder="Optional action plan / context" /></div>

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
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to save.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">{isEdit ? "Edit KPI" : "Add KPI"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Metric name *</label><input value={form.metric} onChange={(e) => set("metric", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Advisory Revenue" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Company *</label>
              <select value={form.company} onChange={(e) => set("company", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">{companyOpts.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select>
            </div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Department <span className="text-gray-400">(optional)</span></label><input value={form.department} onChange={(e) => set("department", e.target.value)} list="dept-list" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <datalist id="dept-list">{departments.map((d) => <option key={d.department} value={d.department} />)}</datalist>
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

          {/* Source: manual vs auto-computed */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">How is the actual measured?</label>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm w-full">
              <button type="button" onClick={() => set("source", "MANUAL")} className={`flex-1 px-3 py-2 ${form.source === "MANUAL" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>Entered manually</button>
              <button type="button" onClick={() => set("source", "AUTO")} className={`flex-1 px-3 py-2 border-l border-gray-200 ${form.source === "AUTO" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>Auto from data</button>
            </div>
          </div>
          {form.source === "AUTO" && (
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Data feed *</label>
              <select value={form.autoKey} onChange={(e) => pickAutoKey(e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
                <option value="">— Select a feed —</option>
                {autoKeys.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
              <p className="text-[11px] text-sky-700 mt-1">The actual updates automatically; you only set the target.</p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.higherIsBetter} onChange={(e) => set("higherIsBetter", e.target.checked)} />
            Higher is better <span className="text-gray-400 text-xs">(uncheck for metrics like cycle time or overdue counts)</span>
          </label>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Description</label><textarea value={form.definition} onChange={(e) => set("definition", e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" /></div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving || !form.metric.trim()} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : isEdit ? "Save changes" : "Add KPI"}</button>
        </div>
      </div>
    </div>
  );
}
