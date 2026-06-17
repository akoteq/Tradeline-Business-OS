"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";

type Partnership = {
  id: string;
  partnerOrganisation: string;
  contactPerson: string | null;
  contactEmailPhone: string | null;
  partnershipType: string | null;
  tradelineEntity: string | null;
  valueChainSector: string | null;
  country: string | null;
  agreementType: string | null;
  startDate: string | null;
  endRenewalDate: string | null;
  status: string;
  revenueSharePct: number | null;
  revenueGeneratedGhs: number | null;
  notes: string | null;
};

export default function PartnershipsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<Partnership | null>(null);
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery<Partnership[]>({ queryKey: ["partnerships", statusFilter], queryFn: () => fetcher(`/partnerships${statusFilter ? `?status=${statusFilter}` : ""}`) });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/partnerships/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["partnerships"] }) });

  const statusColors: Record<string, string> = { ACTIVE: "bg-green-100 text-green-700", PENDING: "bg-yellow-100 text-yellow-700", EXPIRED: "bg-gray-100 text-gray-500", SUSPENDED: "bg-red-100 text-red-700" };

  const columns = [
    { key: "partnerOrganisation", label: "Organisation", sortable: true },
    { key: "contactPerson", label: "Contact" },
    { key: "contactEmailPhone", label: "Email/Phone" },
    { key: "partnershipType", label: "Type" },
    { key: "tradelineEntity", label: "Entity" },
    { key: "valueChainSector", label: "Sector" },
    { key: "country", label: "Country", sortable: true },
    { key: "agreementType", label: "Agreement" },
    { key: "startDate", label: "Start", render: (r: Partnership) => r.startDate ? new Date(r.startDate).toLocaleDateString() : "—" },
    { key: "endRenewalDate", label: "Renewal", render: (r: Partnership) => r.endRenewalDate ? new Date(r.endRenewalDate).toLocaleDateString() : "—" },
    { key: "status", label: "Status", render: (r: Partnership) => <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status] ?? "bg-gray-100"}`}>{r.status}</span>, sortable: true },
    { key: "revenueSharePct", label: "Rev Share %", render: (r: Partnership) => r.revenueSharePct != null ? `${r.revenueSharePct}%` : "—" },
    { key: "revenueGeneratedGhs", label: "Revenue (GHS)", render: (r: Partnership) => r.revenueGeneratedGhs != null ? `GHS ${r.revenueGeneratedGhs.toLocaleString()}` : "—", sortable: true },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Partnerships & MOUs</h1>
      <p className="text-sm text-gray-500">Strategic partnerships · Joint ventures · Revenue-sharing agreements</p>
      <DataTable
        columns={columns} data={data} isLoading={isLoading} title={`${data.length} partners`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => { if (confirm(`Delete "${row.partnerOrganisation}"?`)) deleteMutation.mutate(row.id); }}
        filterBar={
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
            {["","ACTIVE","PENDING","EXPIRED","SUSPENDED"].map((s) => <option key={s} value={s}>{s || "All Statuses"}</option>)}
          </select>
        }
      />
      {showForm && <PartnershipFormModal p={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["partnerships"] }); }} />}
    </div>
  );
}

function PartnershipFormModal({ p, onClose, onSaved }: { p: Partnership | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ partnerOrganisation: p?.partnerOrganisation ?? "", contactPerson: p?.contactPerson ?? "", contactEmailPhone: p?.contactEmailPhone ?? "", partnershipType: p?.partnershipType ?? "", tradelineEntity: p?.tradelineEntity ?? "TRADELINE", valueChainSector: p?.valueChainSector ?? "", country: p?.country ?? "", agreementType: p?.agreementType ?? "", status: p?.status ?? "ACTIVE", revenueSharePct: p?.revenueSharePct ?? "", revenueGeneratedGhs: p?.revenueGeneratedGhs ?? "", notes: p?.notes ?? "" });
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { p ? await api.put(`/partnerships/${p.id}`, form) : await api.post("/partnerships", form); onSaved(); } finally { setSaving(false); } };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between"><h2 className="font-semibold">{p ? "Edit Partnership" : "Add Partnership"}</h2><button onClick={onClose}>&times;</button></div>
        <div className="p-5 space-y-3">
          {[["partnerOrganisation","Organisation"],["contactPerson","Contact Person"],["contactEmailPhone","Email / Phone"],["partnershipType","Partnership Type"],["valueChainSector","Sector"],["country","Country"],["agreementType","Agreement Type"]].map(([k,l]) => (
            <div key={k}><label className="text-xs font-medium text-gray-600 block mb-1">{l}</label><input value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({...f,[k]:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" /></div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Entity</label><select value={form.tradelineEntity} onChange={(e) => setForm((f) => ({...f,tradelineEntity:e.target.value}))} className="w-full border rounded-lg px-2 py-2 text-sm">{["TRADELINE","BAPX"].map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Status</label><select value={form.status} onChange={(e) => setForm((f) => ({...f,status:e.target.value}))} className="w-full border rounded-lg px-2 py-2 text-sm">{["ACTIVE","PENDING","EXPIRED","SUSPENDED"].map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Revenue Share %</label><input type="number" value={String(form.revenueSharePct)} onChange={(e) => setForm((f) => ({...f,revenueSharePct:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Revenue Generated (GHS)</label><input type="number" value={String(form.revenueGeneratedGhs)} onChange={(e) => setForm((f) => ({...f,revenueGeneratedGhs:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({...f,notes:e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></div>
      </div>
    </div>
  );
}
