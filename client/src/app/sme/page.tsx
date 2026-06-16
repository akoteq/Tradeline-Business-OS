"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";

type SME = {
  id: string;
  bizId: string | null;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  valueChain: string | null;
  region: string | null;
  district: string | null;
  businessDescription: string | null;
  status: string;
  followUpDate: string | null;
  investorReadinessScore: number | null;
  bankabilityTier: string;
  notes: string | null;
};

export default function SmePage() {
  const [filters, setFilters] = useState({ status: "", tier: "", valueChain: "", region: "" });
  const [editing, setEditing] = useState<SME | null>(null);
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
  const { data = [], isLoading } = useQuery<SME[]>({ queryKey: ["sme", filters], queryFn: () => fetcher(`/sme?${params}`) });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/sme/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["sme"] }) });

  const columns = [
    { key: "companyName", label: "Company", sortable: true },
    { key: "contactName", label: "Contact" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "valueChain", label: "Value Chain", sortable: true },
    { key: "region", label: "Region", sortable: true },
    { key: "district", label: "District" },
    { key: "status", label: "Status", render: (r: SME) => <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{r.status.replace(/_/g," ")}</span>, sortable: true },
    { key: "investorReadinessScore", label: "IR Score", render: (r: SME) => r.investorReadinessScore != null ? <ScoreBar score={r.investorReadinessScore} /> : "Unscored", sortable: true },
    { key: "bankabilityTier", label: "Bankability", sortable: true },
    { key: "followUpDate", label: "Follow Up", render: (r: SME) => r.followUpDate ? new Date(r.followUpDate).toLocaleDateString() : "—" },
  ];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">SME Database</h1>
      <p className="text-sm text-gray-500">Full SME profiles · Investor readiness · Bankability assessments</p>
      <DataTable
        columns={columns} data={data} isLoading={isLoading} title={`${data.length} SMEs`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => { if (confirm(`Delete "${row.companyName}"?`)) deleteMutation.mutate(row.id); }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {["","IN_PROGRESS","ACTIVE","INACTIVE","ARCHIVED"].map((s) => <option key={s} value={s}>{s || "All Statuses"}</option>)}
            </select>
            <input value={filters.valueChain} onChange={(e) => setFilters((f) => ({ ...f, valueChain: e.target.value }))} placeholder="Value Chain…" className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 w-32" />
            <input value={filters.region} onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))} placeholder="Region…" className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 w-28" />
          </div>
        }
      />
      {showForm && <SmeFormModal sme={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["sme"] }); }} />}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium">{score}</span>
    </div>
  );
}

function SmeFormModal({ sme, onClose, onSaved }: { sme: SME | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ companyName: sme?.companyName ?? "", contactName: sme?.contactName ?? "", email: sme?.email ?? "", phone: sme?.phone ?? "", valueChain: sme?.valueChain ?? "", region: sme?.region ?? "", district: sme?.district ?? "", businessDescription: sme?.businessDescription ?? "", status: sme?.status ?? "IN_PROGRESS", investorReadinessScore: sme?.investorReadinessScore ?? "", bankabilityTier: sme?.bankabilityTier ?? "UNSCORED", notes: sme?.notes ?? "" });
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { sme ? await api.put(`/sme/${sme.id}`, form) : await api.post("/sme", form); onSaved(); } finally { setSaving(false); } };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between"><h2 className="font-semibold">{sme ? "Edit SME" : "Add SME"}</h2><button onClick={onClose}>&times;</button></div>
        <div className="p-5 space-y-3">
          {[["companyName","Company Name"],["contactName","Contact Name"],["email","Email"],["phone","Phone"],["valueChain","Value Chain"],["region","Region"],["district","District"]].map(([k,l]) => (
            <div key={k}><label className="text-xs font-medium text-gray-600 block mb-1">{l}</label><input value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({...f,[k]:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" /></div>
          ))}
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Business Description</label><textarea value={form.businessDescription} onChange={(e) => setForm((f) => ({...f,businessDescription:e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Status</label><select value={form.status} onChange={(e) => setForm((f) => ({...f,status:e.target.value}))} className="w-full border rounded-lg px-2 py-2 text-sm">{["IN_PROGRESS","ACTIVE","INACTIVE","ARCHIVED"].map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Bankability Tier</label><select value={form.bankabilityTier} onChange={(e) => setForm((f) => ({...f,bankabilityTier:e.target.value}))} className="w-full border rounded-lg px-2 py-2 text-sm">{["UNSCORED","TIER_1","TIER_2","TIER_3"].map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Investor Readiness Score (0–100)</label><input type="number" min="0" max="100" value={String(form.investorReadinessScore)} onChange={(e) => setForm((f) => ({...f,investorReadinessScore:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({...f,notes:e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></div>
      </div>
    </div>
  );
}
