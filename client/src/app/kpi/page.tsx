"use client";

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";

type KPI = {
  id: string;
  month: string;
  company: string;
  kpiMetric: string;
  currentValue: number | null;
  unit: string | null;
  benchmarkTarget: number | null;
  status: string | null;
  managementNotes: string | null;
};

export default function KpiPage() {
  const [companyFilter, setCompanyFilter] = useState("");
  const [editing, setEditing] = useState<KPI | null>(null);
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery<KPI[]>({ queryKey: ["kpi", companyFilter], queryFn: () => fetcher(`/kpi${companyFilter ? `?company=${companyFilter}` : ""}`) });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/kpi/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi"] }) });

  const columns = [
    { key: "month", label: "Month", render: (r: KPI) => new Date(r.month).toLocaleDateString("en-GH", { year: "numeric", month: "short" }), sortable: true },
    { key: "company", label: "Company", render: (r: KPI) => <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.company === "TRADELINE" ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"}`}>{r.company}</span>, sortable: true },
    { key: "kpiMetric", label: "KPI Metric", sortable: true },
    { key: "currentValue", label: "Current", sortable: true },
    { key: "unit", label: "Unit" },
    { key: "benchmarkTarget", label: "Target", sortable: true },
    { key: "status", label: "Status", render: (r: KPI) => {
      const c = r.status === "ON_TRACK" ? "bg-green-100 text-green-700" : r.status === "AT_RISK" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
      return r.status ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c}`}>{r.status}</span> : <span className="text-gray-400">—</span>;
    }, sortable: true },
    { key: "managementNotes", label: "Notes" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">KPI Scorecard</h1>
      <p className="text-sm text-gray-500">Monthly performance monitoring across both companies</p>
      <DataTable
        columns={columns} data={data} isLoading={isLoading} title={`${data.length} entries`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => { if (confirm(`Delete KPI "${row.kpiMetric}"?`)) deleteMutation.mutate(row.id); }}
        filterBar={
          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
            {["","TRADELINE","BAPX"].map((s) => <option key={s} value={s}>{s || "Both Companies"}</option>)}
          </select>
        }
      />
      {showForm && <KpiFormModal kpi={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["kpi"] }); }} />}
    </div>
  );
}

function KpiFormModal({ kpi, onClose, onSaved }: { kpi: KPI | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ month: kpi?.month ? kpi.month.slice(0,7) : new Date().toISOString().slice(0,7), company: kpi?.company ?? "TRADELINE", kpiMetric: kpi?.kpiMetric ?? "", currentValue: kpi?.currentValue ?? "", unit: kpi?.unit ?? "", benchmarkTarget: kpi?.benchmarkTarget ?? "", status: kpi?.status ?? "ON_TRACK", managementNotes: kpi?.managementNotes ?? "" });
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { kpi ? await api.put(`/kpi/${kpi.id}`, {...form, month: new Date(form.month + "-01")}) : await api.post("/kpi", {...form, month: new Date(form.month + "-01")}); onSaved(); } finally { setSaving(false); } };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between"><h2 className="font-semibold">{kpi ? "Edit KPI" : "Add KPI"}</h2><button onClick={onClose}>&times;</button></div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Month</label><input type="month" value={form.month} onChange={(e) => setForm((f) => ({...f,month:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Company</label><select value={form.company} onChange={(e) => setForm((f) => ({...f,company:e.target.value}))} className="w-full border rounded-lg px-2 py-2 text-sm">{["TRADELINE","BAPX"].map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">KPI Metric</label><input value={form.kpiMetric} onChange={(e) => setForm((f) => ({...f,kpiMetric:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Current</label><input type="number" value={String(form.currentValue)} onChange={(e) => setForm((f) => ({...f,currentValue:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Target</label><input type="number" value={String(form.benchmarkTarget)} onChange={(e) => setForm((f) => ({...f,benchmarkTarget:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Unit</label><input value={form.unit} onChange={(e) => setForm((f) => ({...f,unit:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Status</label><select value={form.status} onChange={(e) => setForm((f) => ({...f,status:e.target.value}))} className="w-full border rounded-lg px-2 py-2 text-sm">{["ON_TRACK","AT_RISK","OFF_TRACK"].map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Management Notes</label><textarea value={form.managementNotes} onChange={(e) => setForm((f) => ({...f,managementNotes:e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></div>
      </div>
    </div>
  );
}
