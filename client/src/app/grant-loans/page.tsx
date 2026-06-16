"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";

type GrantLoan = {
  id: string;
  clientName: string;
  bdo: { name: string } | null;
  grantLoanType: string | null;
  funderDfi: string | null;
  sectorValueChain: string | null;
  amountApplied: string | null;
  amountApproved: number | null;
  disbursed: number | null;
  applicationDate: string | null;
  decisionDate: string | null;
  status: string;
  commissionPct: number | null;
  commissionReceived: number | null;
  notes: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-500",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  DISBURSED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  WITHDRAWN: "bg-gray-100 text-gray-400",
};

export default function GrantLoansPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<GrantLoan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery<GrantLoan[]>({ queryKey: ["grant-loans", statusFilter], queryFn: () => fetcher(`/grant-loans${statusFilter ? `?status=${statusFilter}` : ""}`) });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/grant-loans/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["grant-loans"] }) });

  const totalCommission = data.reduce((s, r) => s + (r.commissionReceived ?? 0), 0);

  const columns = [
    { key: "clientName", label: "Client / SME", sortable: true },
    { key: "bdo", label: "BDO", render: (r: GrantLoan) => r.bdo?.name ?? "—" },
    { key: "grantLoanType", label: "Type" },
    { key: "funderDfi", label: "Funder / DFI" },
    { key: "sectorValueChain", label: "Sector" },
    { key: "amountApplied", label: "Applied" },
    { key: "amountApproved", label: "Approved", render: (r: GrantLoan) => r.amountApproved != null ? `GHS ${r.amountApproved.toLocaleString()}` : "—", sortable: true },
    { key: "disbursed", label: "Disbursed", render: (r: GrantLoan) => r.disbursed != null ? `GHS ${r.disbursed.toLocaleString()}` : "—", sortable: true },
    { key: "applicationDate", label: "Applied", render: (r: GrantLoan) => r.applicationDate ? new Date(r.applicationDate).toLocaleDateString() : "—" },
    { key: "decisionDate", label: "Decision", render: (r: GrantLoan) => r.decisionDate ? new Date(r.decisionDate).toLocaleDateString() : "—" },
    { key: "status", label: "Status", render: (r: GrantLoan) => <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>{r.status.replace(/_/g," ")}</span>, sortable: true },
    { key: "commissionPct", label: "Comm %", render: (r: GrantLoan) => r.commissionPct != null ? `${r.commissionPct}%` : "—" },
    { key: "commissionReceived", label: "Comm Received", render: (r: GrantLoan) => r.commissionReceived != null ? `GHS ${r.commissionReceived.toLocaleString()}` : "—", sortable: true },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grant & Loan Tracker</h1>
          <p className="text-sm text-gray-500">Finance Factory & Tradeline — grant applications & loan facilitation</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center">
          <div className="text-xs text-emerald-600 font-medium">Commission Received</div>
          <div className="font-bold text-emerald-700">GHS {totalCommission.toLocaleString()}</div>
        </div>
      </div>
      <DataTable
        columns={columns} data={data} isLoading={isLoading} title={`${data.length} records`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => { if (confirm(`Delete record for "${row.clientName}"?`)) deleteMutation.mutate(row.id); }}
        filterBar={
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
            {["","DRAFT","SUBMITTED","UNDER_REVIEW","APPROVED","DISBURSED","REJECTED","WITHDRAWN"].map((s) => <option key={s} value={s}>{s || "All Statuses"}</option>)}
          </select>
        }
      />
      {showForm && <GrantFormModal g={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["grant-loans"] }); }} />}
    </div>
  );
}

function GrantFormModal({ g, onClose, onSaved }: { g: GrantLoan | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ clientName: g?.clientName ?? "", grantLoanType: g?.grantLoanType ?? "", funderDfi: g?.funderDfi ?? "", sectorValueChain: g?.sectorValueChain ?? "", amountApplied: g?.amountApplied ?? "", amountApproved: g?.amountApproved ?? "", disbursed: g?.disbursed ?? "", status: g?.status ?? "SUBMITTED", commissionPct: g?.commissionPct ?? 10, commissionReceived: g?.commissionReceived ?? "", notes: g?.notes ?? "" });
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { g ? await api.put(`/grant-loans/${g.id}`, form) : await api.post("/grant-loans", form); onSaved(); } finally { setSaving(false); } };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between"><h2 className="font-semibold">{g ? "Edit Record" : "Add Grant/Loan"}</h2><button onClick={onClose}>&times;</button></div>
        <div className="p-5 space-y-3">
          {[["clientName","Client / SME Name"],["grantLoanType","Grant / Loan Type"],["funderDfi","Funder / DFI"],["sectorValueChain","Sector / Value Chain"],["amountApplied","Amount Applied"]].map(([k,l]) => (
            <div key={k}><label className="text-xs font-medium text-gray-600 block mb-1">{l}</label><input value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({...f,[k]:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" /></div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            {[["amountApproved","Amount Approved (GHS)"],["disbursed","Disbursed (GHS)"],["commissionPct","Commission %"],["commissionReceived","Commission Received (GHS)"]].map(([k,l]) => (
              <div key={k}><label className="text-xs font-medium text-gray-600 block mb-1">{l}</label><input type="number" value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({...f,[k]:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            ))}
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Status</label><select value={form.status} onChange={(e) => setForm((f) => ({...f,status:e.target.value}))} className="w-full border rounded-lg px-2 py-2 text-sm">{["DRAFT","SUBMITTED","UNDER_REVIEW","APPROVED","DISBURSED","REJECTED","WITHDRAWN"].map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({...f,notes:e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></div>
      </div>
    </div>
  );
}
