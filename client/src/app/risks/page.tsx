"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable, type Column } from "@/components/DataTable";
import { useAuth } from "@/components/AuthProvider";
import { accessLevel } from "@/lib/auth";
import { useCompanies } from "@/lib/companies";
import { X, AlertTriangle, Plus, Trash2, History } from "lucide-react";

// Company risk registers. The Business CEO (own company) and the Group Owner add, edit and review
// risks; staff see the risks where they own an action and update those actions.

type Mitigation = { id?: string; action: string; ownerBdoId: string | null; ownerName?: string | null; deadline: string | null; status: string; note?: string; overdue?: boolean };
type Indicator = { id?: string; name: string; threshold: string; triggered: boolean; note?: string };
type Risk = {
  id: string; company: string; title: string; category: string; description: string; impactDescription: string; financialImpactGhs: number | null;
  impact: number; likelihood: number; score: number; residualImpact: number | null; residualLikelihood: number | null; residualScore: number | null;
  indicators: Indicator[]; mitigations: Mitigation[]; ownerBdoId: string | null; ownerName: string | null; reviewStatus: string; reviewState: string;
  lastReviewedAt: string | null; nextReviewDate: string | null; canEdit: boolean;
};
type Bdo = { id: string; name: string; company: string };

const CATEGORIES = ["FINANCIAL", "OPERATIONAL", "REGULATORY", "CREDIT", "PEOPLE", "TECHNOLOGY", "REPUTATIONAL", "MARKET"];
const MIT_STATUS = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"];
const t = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
const showDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : "—");
const errText = (e: unknown, f: string) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? f;
const scoreTone = (s: number) => (s >= 15 ? "bg-red-600 text-white" : s >= 8 ? "bg-amber-400 text-gray-900" : "bg-green-200 text-green-900");
const REVIEW_STYLE: Record<string, string> = { ACTIVE: "bg-green-100 text-green-700", REVIEW_DUE: "bg-amber-100 text-amber-800", DRAFT: "bg-gray-100 text-gray-600", CLOSED: "bg-slate-100 text-slate-500" };

export default function RisksPage() {
  const { user } = useAuth();
  const { byKey } = useCompanies();
  const qc = useQueryClient();
  const level = user ? accessLevel(user.role) : "STAFF";
  const manager = level !== "STAFF";
  const [company, setCompany] = useState("");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [editing, setEditing] = useState<Risk | "new" | null>(null);
  const [reviewing, setReviewing] = useState<Risk | null>(null);

  const { data: risks = [], isLoading } = useQuery<Risk[]>({ queryKey: ["risks", includeClosed], queryFn: () => fetcher(`/risks${includeClosed ? "?includeClosed=1" : ""}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["risks"] });
  const rows = risks.filter((r) => !company || r.company === company);

  const setMitigation = async (r: Risk, m: Mitigation, status: string) => {
    try { await api.patch(`/risks/${r.id}/mitigations/${m.id}`, { status }); refresh(); } catch (e) { alert(errText(e, "Couldn't update.")); }
  };

  if (!user) return null;

  // Staff: only the actions assigned to them.
  if (!manager) {
    const mine = risks.flatMap((r) => r.mitigations.filter((m) => m.ownerBdoId === user.bdoId).map((m) => ({ r, m })));
    return (
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><AlertTriangle size={22} /> My risk actions</h1>
        <p className="text-sm text-gray-500">Actions you own on your company&apos;s risk register. Update them as you go.</p>
        {mine.length === 0 ? <p className="text-sm text-gray-400">Nothing assigned to you.</p> : (
          <div className="space-y-2">
            {mine.map(({ r, m }) => (
              <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{m.action}</p>
                  <p className="text-xs text-gray-500">Risk: {r.title} · due {showDate(m.deadline)}{m.overdue && <span className="text-red-600 font-medium"> · overdue</span>}</p>
                </div>
                <select value={m.status} onChange={(e) => setMitigation(r, m, e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                  {MIT_STATUS.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const columns: Column<Risk>[] = [
    { key: "title", label: "Risk", sortable: true, render: (r) => <button onClick={() => setEditing(r)} className="text-left font-semibold text-accent hover:underline">{r.title}</button>, exportValue: (r) => r.title },
    ...(level === "GROUP_OWNER" ? [{ key: "company", label: "Company", sortable: true, render: (r: Risk) => byKey[r.company]?.name ?? r.company }] : []),
    { key: "category", label: "Category", render: (r) => t(r.category) },
    { key: "score", label: "Score", sortable: true, render: (r) => <span className={`inline-block min-w-8 text-center px-1.5 py-0.5 rounded text-xs font-bold ${scoreTone(r.score)}`}>{r.score}</span> },
    { key: "residualScore", label: "After mitigation", render: (r) => r.residualScore != null ? <span className={`inline-block min-w-8 text-center px-1.5 py-0.5 rounded text-xs font-bold ${scoreTone(r.residualScore)}`}>{r.residualScore}</span> : "—" },
    { key: "ownerName", label: "Owner", render: (r) => r.ownerName ?? <span className="text-amber-700">Nobody</span> },
    {
      key: "mitigations", label: "Actions",
      render: (r) => { const open = r.mitigations.filter((m) => !["DONE", "CANCELLED"].includes(m.status)).length; const late = r.mitigations.filter((m) => m.overdue).length;
        return r.mitigations.length ? <span className="text-xs">{open} open{late ? <span className="text-red-600"> · {late} overdue</span> : ""}</span> : <span className="text-xs text-amber-700">None</span>; },
      exportValue: (r) => r.mitigations.length,
    },
    { key: "reviewState", label: "Review", render: (r) => <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${REVIEW_STYLE[r.reviewState]}`}>{t(r.reviewState)}{r.nextReviewDate && r.reviewState !== "CLOSED" ? ` · ${showDate(r.nextReviewDate)}` : ""}</span> },
    { key: "review", label: "", render: (r) => r.canEdit ? <button onClick={() => setReviewing(r)} className="text-xs text-accent hover:underline">Review</button> : null },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><AlertTriangle size={22} /> Risk register</h1>
        <p className="text-sm text-gray-500">Each company&apos;s top 10–15 material risks. Score = impact × likelihood (1–25).</p>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        title={`${rows.length} risks`}
        onAdd={() => setEditing("new")}
        onEdit={(r) => setEditing(r)}
        canEditRow={(r) => r.canEdit}
        onDelete={(r) => { if (confirm(`Delete "${r.title}"?`)) api.delete(`/risks/${r.id}`).then(refresh, (e) => alert(errText(e, "Failed to delete."))); }}
        filterBar={
          <div className="flex gap-3 flex-wrap items-center">
            {level === "GROUP_OWNER" && (
              <select value={company} onChange={(e) => setCompany(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                <option value="">All companies</option>{[...new Set(risks.map((r) => r.company))].map((k) => <option key={k} value={k}>{byKey[k]?.name ?? k}</option>)}
              </select>
            )}
            <label className="flex items-center gap-1.5 text-sm text-gray-600"><input type="checkbox" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} /> Show closed</label>
          </div>
        }
      />

      {editing && <RiskModal risk={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(w) => { setEditing(null); refresh(); if (w) alert(w); }} />}
      {reviewing && <ReviewModal risk={reviewing} onClose={() => setReviewing(null)} onSaved={() => { setReviewing(null); refresh(); }} />}
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
function L({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return <div className={span ? "sm:col-span-2" : ""}><label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>{children}</div>;
}
function Scale({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} onClick={() => onChange(value === n ? null : n)} className={`w-8 h-8 rounded-lg text-sm font-semibold border ${value === n ? "bg-accent text-accent-foreground border-accent" : "bg-white text-gray-600 border-gray-200"}`}>{n}</button>)}
    </div>
  );
}

function RiskModal({ risk, onClose, onSaved }: { risk: Risk | null; onClose: () => void; onSaved: (warning?: string | null) => void }) {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const owner = !!user && accessLevel(user.role) === "GROUP_OWNER";
  const [form, setForm] = useState({
    company: risk?.company ?? (owner ? "" : user?.bdoCompany ?? ""), title: risk?.title ?? "", category: risk?.category ?? "FINANCIAL",
    description: risk?.description ?? "", impactDescription: risk?.impactDescription ?? "", financialImpactGhs: risk?.financialImpactGhs != null ? String(risk.financialImpactGhs) : "",
    impact: risk?.impact ?? null as number | null, likelihood: risk?.likelihood ?? null as number | null,
    residualImpact: risk?.residualImpact ?? null as number | null, residualLikelihood: risk?.residualLikelihood ?? null as number | null,
    ownerBdoId: risk?.ownerBdoId ?? "", nextReviewDate: risk?.nextReviewDate?.slice(0, 10) ?? "", reviewStatus: risk?.reviewStatus ?? "ACTIVE",
    indicators: risk?.indicators ?? [] as Indicator[], mitigations: risk?.mitigations ?? [] as Mitigation[],
  });
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const { data: bdos = [] } = useQuery<Bdo[]>({ queryKey: ["bdos", form.company], queryFn: () => fetcher(`/bdo${form.company ? `?company=${form.company}` : ""}`), enabled: !!form.company });
  const { data: audit = [] } = useQuery<{ id: string; action: string; actorName: string | null; createdAt: string; note?: string }[]>({ queryKey: ["risk-audit", risk?.id], queryFn: () => fetcher(`/risks/${risk!.id}/audit`), enabled: !!risk });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const readOnly = !!risk && !risk.canEdit;

  const save = async () => {
    if (!form.impact || !form.likelihood) { setError("Choose impact and likelihood."); return; }
    setSaving(true); setError("");
    const body = {
      ...form, financialImpactGhs: form.financialImpactGhs === "" ? null : Number(form.financialImpactGhs), ownerBdoId: form.ownerBdoId || null,
      nextReviewDate: form.nextReviewDate || null, mitigations: form.mitigations.map((m) => ({ ...m, ownerBdoId: m.ownerBdoId || null, deadline: m.deadline || null })),
    };
    try {
      if (risk) { await api.put(`/risks/${risk.id}`, body); onSaved(); }
      else { const { data } = await api.post<{ warning?: string | null }>("/risks", body); onSaved(data.warning); }
    } catch (e) { setError(errText(e, "Failed to save.")); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <h2 className="font-semibold">{risk ? risk.title : "New risk"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <fieldset disabled={readOnly} className="p-5 space-y-4 min-w-0">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!risk && owner && (
              <L label="Company *" span><select value={form.company} onChange={(e) => set("company", e.target.value)} className={inputCls}><option value="">— Choose —</option>{companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></L>
            )}
            <L label="Title *" span><input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} /></L>
            <L label="Category"><select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></L>
            <L label="Accountable owner"><select value={form.ownerBdoId} onChange={(e) => set("ownerBdoId", e.target.value)} className={inputCls}><option value="">— Nobody —</option>{bdos.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></L>
            <L label="Description" span><textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className={`${inputCls} resize-none`} /></L>
            <L label="Impact if it happens" span><textarea value={form.impactDescription} onChange={(e) => set("impactDescription", e.target.value)} rows={2} className={`${inputCls} resize-none`} /></L>
            <L label="Impact (1–5) *"><Scale value={form.impact} onChange={(n) => set("impact", n)} /></L>
            <L label="Likelihood (1–5) *"><Scale value={form.likelihood} onChange={(n) => set("likelihood", n)} /></L>
            <L label="Residual impact (after mitigation)"><Scale value={form.residualImpact} onChange={(n) => set("residualImpact", n)} /></L>
            <L label="Residual likelihood"><Scale value={form.residualLikelihood} onChange={(n) => set("residualLikelihood", n)} /></L>
            <L label="Estimated financial impact (GHS)"><input type="number" min={0} value={form.financialImpactGhs} onChange={(e) => set("financialImpactGhs", e.target.value)} className={inputCls} /></L>
            <L label="Next review"><input type="date" value={form.nextReviewDate} onChange={(e) => set("nextReviewDate", e.target.value)} className={inputCls} /></L>
            <L label="Status"><select value={form.reviewStatus} onChange={(e) => set("reviewStatus", e.target.value)} className={inputCls}>{["DRAFT", "ACTIVE", "CLOSED"].map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></L>
            {form.impact && form.likelihood && <div className="flex items-end"><span className={`px-2 py-1 rounded text-sm font-bold ${scoreTone(form.impact * form.likelihood)}`}>Score {form.impact * form.likelihood}</span></div>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Warning signs</p>
              <button type="button" onClick={() => set("indicators", [...form.indicators, { name: "", threshold: "", triggered: false }])} className="text-xs text-accent flex items-center gap-1"><Plus size={12} /> Add</button></div>
            {form.indicators.map((ind, i) => (
              <div key={ind.id ?? `n${i}`} className="flex gap-2 mb-1.5 items-center">
                <input value={ind.name} placeholder="What to watch" onChange={(e) => set("indicators", form.indicators.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={inputCls} />
                <input value={ind.threshold} placeholder="Threshold" onChange={(e) => set("indicators", form.indicators.map((x, j) => (j === i ? { ...x, threshold: e.target.value } : x)))} className={inputCls} />
                <label className="flex items-center gap-1 text-xs text-gray-600 shrink-0"><input type="checkbox" checked={ind.triggered} onChange={(e) => set("indicators", form.indicators.map((x, j) => (j === i ? { ...x, triggered: e.target.checked } : x)))} /> Triggered</label>
                <button type="button" onClick={() => set("indicators", form.indicators.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mitigation actions</p>
              <button type="button" onClick={() => set("mitigations", [...form.mitigations, { action: "", ownerBdoId: null, deadline: null, status: "OPEN" }])} className="text-xs text-accent flex items-center gap-1"><Plus size={12} /> Add</button></div>
            {form.mitigations.map((m, i) => (
              <div key={m.id ?? `n${i}`} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_130px_120px_20px] gap-2 mb-1.5 items-center">
                <input value={m.action} placeholder="Action" onChange={(e) => set("mitigations", form.mitigations.map((x, j) => (j === i ? { ...x, action: e.target.value } : x)))} className={inputCls} />
                <select value={m.ownerBdoId ?? ""} onChange={(e) => set("mitigations", form.mitigations.map((x, j) => (j === i ? { ...x, ownerBdoId: e.target.value || null } : x)))} className={inputCls}><option value="">Owner</option>{bdos.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                <input type="date" value={m.deadline?.slice(0, 10) ?? ""} onChange={(e) => set("mitigations", form.mitigations.map((x, j) => (j === i ? { ...x, deadline: e.target.value || null } : x)))} className={inputCls} />
                <select value={m.status} onChange={(e) => set("mitigations", form.mitigations.map((x, j) => (j === i ? { ...x, status: e.target.value } : x)))} className={inputCls}>{MIT_STATUS.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select>
                <button type="button" onClick={() => set("mitigations", form.mitigations.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          {risk && audit.length > 0 && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer flex items-center gap-1"><History size={12} /> History ({audit.length})</summary>
              <ul className="mt-2 space-y-1">{audit.map((a) => <li key={a.id}>{new Date(a.createdAt).toLocaleString()} · {a.actorName ?? "Someone"} · {a.action}{a.note ? ` — ${a.note}` : ""}</li>)}</ul>
            </details>
          )}
        </fieldset>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">{readOnly ? "Close" : "Cancel"}</button>
          {!readOnly && <button onClick={save} disabled={saving || !form.title.trim() || (!risk && !form.company)} className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>}
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ risk, onClose, onSaved }: { risk: Risk; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ impact: risk.impact as number | null, likelihood: risk.likelihood as number | null, residualImpact: risk.residualImpact, residualLikelihood: risk.residualLikelihood, note: "", nextReviewDate: "" });
  const { data: history = [] } = useQuery<{ id: string; at: string; reviewerName: string | null; score: number; residualScore: number | null; note: string }[]>({ queryKey: ["risk-reviews", risk.id], queryFn: () => fetcher(`/risks/${risk.id}/reviews`) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true); setError("");
    try { await api.post(`/risks/${risk.id}/review`, { ...form, nextReviewDate: form.nextReviewDate || undefined }); onSaved(); } catch (e) { setError(errText(e, "Failed to save the review.")); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between"><h2 className="font-semibold">Review: {risk.title}</h2><button onClick={onClose} className="text-gray-400"><X size={18} /></button></div>
        <div className="p-5 space-y-3 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {error && <div className="bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
          <L label="Impact"><Scale value={form.impact} onChange={(n) => setForm({ ...form, impact: n })} /></L>
          <L label="Likelihood"><Scale value={form.likelihood} onChange={(n) => setForm({ ...form, likelihood: n })} /></L>
          <L label="Residual impact"><Scale value={form.residualImpact} onChange={(n) => setForm({ ...form, residualImpact: n })} /></L>
          <L label="Residual likelihood"><Scale value={form.residualLikelihood} onChange={(n) => setForm({ ...form, residualLikelihood: n })} /></L>
          <L label="What changed?"><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className={`${inputCls} resize-none`} /></L>
          <L label="Next review (default: in 90 days)"><input type="date" value={form.nextReviewDate} onChange={(e) => setForm({ ...form, nextReviewDate: e.target.value })} className={inputCls} /></L>
          {history.length > 0 && (
            <div className="text-xs text-gray-500"><p className="font-semibold mb-1">Past reviews</p>
              {history.map((h) => <p key={h.id}>{showDate(h.at)} · {h.reviewerName ?? "—"} · score {h.score}{h.residualScore != null ? ` → ${h.residualScore}` : ""}{h.note ? ` — ${h.note}` : ""}</p>)}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving || !form.impact || !form.likelihood} className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save review"}</button>
        </div>
      </div>
    </div>
  );
}
