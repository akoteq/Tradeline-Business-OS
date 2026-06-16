"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { PriorityBadge } from "@/components/Badges";

const PAGE_SIZE = 100;

type Lead = {
  id: string;
  bizId: string | null;
  businessName: string;
  email: string | null;
  contactPerson: string | null;
  roleTitle: string | null;
  status: string;
  source: string | null;
  bdo: { name: string } | null;
  priority: string | null;
  dateAdded: string | null;
  followUpDate: string | null;
  notes: string | null;
};

type BdoOption = { id: string; name: string };

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-700",
  CONTACTED: "bg-blue-100 text-blue-700",
  QUALIFIED: "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  CONVERTED: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
};

const STATUS_LIST = ["NEW", "CONTACTED", "QUALIFIED", "IN_PROGRESS", "CONVERTED", "LOST"] as const;

export default function LeadsPage() {
  const [filters, setFilters] = useState({ status: "", bdo: "", priority: "" });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: bdos = [] } = useQuery<BdoOption[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
  });

  const { data: stats = {} } = useQuery<Record<string, number>>({
    queryKey: ["leads-stats"],
    queryFn: () => fetcher("/leads/stats"),
  });

  const setFilter = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };

  const queryParams = new URLSearchParams({
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    limit: String(PAGE_SIZE),
    skip: String(page * PAGE_SIZE),
  });

  const { data: leadsRes, isLoading } = useQuery<{ data: Lead[]; total: number }>({
    queryKey: ["leads", filters, page],
    queryFn: () => fetcher(`/leads?${queryParams}`),
  });

  const leads = leadsRes?.data ?? [];
  const total = leadsRes?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-stats"] });
    },
  });

  const totalLeads = Object.values(stats).reduce((a, b) => a + b, 0);

  const columns = [
    { key: "businessName", label: "Business", sortable: true },
    { key: "contactPerson", label: "Contact" },
    { key: "email", label: "Email" },
    { key: "status", label: "Status", render: (r: Lead) => <StatusBadge value={r.status} />, sortable: true },
    { key: "source", label: "Source" },
    { key: "bdo", label: "BDO", render: (r: Lead) => r.bdo?.name ?? "—" },
    {
      key: "priority",
      label: "Priority",
      render: (r: Lead) => r.priority ? <PriorityBadge value={r.priority} /> : <span className="text-gray-400">—</span>,
      sortable: true,
    },
    {
      key: "dateAdded",
      label: "Added",
      render: (r: Lead) => r.dateAdded ? new Date(r.dateAdded).toLocaleDateString() : "—",
    },
    {
      key: "followUpDate",
      label: "Follow Up",
      render: (r: Lead) => r.followUpDate ? new Date(r.followUpDate).toLocaleDateString() : "—",
    },
    {
      key: "notes",
      label: "Notes",
      render: (r: Lead) =>
        r.notes ? (
          <span title={r.notes} className="text-gray-500 text-xs line-clamp-1 max-w-[220px] block">
            {r.notes}
          </span>
        ) : null,
    },
  ];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads Database</h1>
        <p className="text-sm text-gray-500 mt-1">
          {totalLeads.toLocaleString()} total leads across all channels
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {STATUS_LIST.map((s) => (
          <button
            key={s}
            onClick={() => setFilter("status", filters.status === s ? "" : s)}
            className={`rounded-xl border p-3 text-left cursor-pointer transition-all ${
              filters.status === s
                ? "ring-2 ring-indigo-400 border-indigo-200"
                : "border-gray-200 hover:border-gray-300"
            } bg-white`}
          >
            <div className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium mb-2 ${STATUS_COLORS[s] ?? "bg-gray-100 text-gray-600"}`}>
              {s.replace("_", " ")}
            </div>
            <div className="text-2xl font-bold text-gray-900">{(stats[s] ?? 0).toLocaleString()}</div>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={leads}
        isLoading={isLoading}
        title={`${total.toLocaleString()} leads`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => {
          if (confirm(`Delete lead "${row.businessName}"?`)) deleteMutation.mutate(row.id);
        }}
        filterBar={
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {["", ...STATUS_LIST].map((s) => (
                <option key={s} value={s}>{s || "All Statuses"}</option>
              ))}
            </select>
            <select
              value={filters.priority}
              onChange={(e) => setFilter("priority", e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {["", "HIGH", "MEDIUM", "LOW"].map((s) => (
                <option key={s} value={s}>{s || "All Priorities"}</option>
              ))}
            </select>
            <select
              value={filters.bdo}
              onChange={(e) => setFilter("bdo", e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All BDOs</option>
              {bdos.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
        }
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-gray-500">
            Showing {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()} leads
          </span>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              ← Prev
            </button>
            <span className="px-2 text-sm text-gray-600">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <LeadFormModal
          lead={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["leads"] });
            qc.invalidateQueries({ queryKey: ["leads-stats"] });
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    NEW: "bg-gray-100 text-gray-700",
    CONTACTED: "bg-blue-100 text-blue-700",
    QUALIFIED: "bg-indigo-100 text-indigo-700",
    IN_PROGRESS: "bg-yellow-100 text-yellow-700",
    CONVERTED: "bg-green-100 text-green-700",
    LOST: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[value] ?? "bg-gray-100 text-gray-500"}`}>
      {value.replace("_", " ")}
    </span>
  );
}

function LeadFormModal({ lead, onClose, onSaved }: { lead: Lead | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    businessName: lead?.businessName ?? "",
    email: lead?.email ?? "",
    contactPerson: lead?.contactPerson ?? "",
    roleTitle: lead?.roleTitle ?? "",
    status: lead?.status ?? "NEW",
    source: lead?.source ?? "",
    priority: lead?.priority ?? "MEDIUM",
    notes: lead?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      lead ? await api.put(`/leads/${lead.id}`, form) : await api.post("/leads", form);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{lead ? "Edit Lead" : "Add Lead"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          {[
            ["businessName", "Business Name"],
            ["email", "Email"],
            ["contactPerson", "Contact Person"],
            ["roleTitle", "Role / Title"],
            ["source", "Source"],
          ].map(([k, l]) => (
            <div key={k}>
              <label className="text-xs font-medium text-gray-600 block mb-1">{l}</label>
              <input
                value={String(form[k as keyof typeof form])}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {["NEW", "CONTACTED", "QUALIFIED", "IN_PROGRESS", "CONVERTED", "LOST"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Priority</label>
              <select value={form.priority ?? "MEDIUM"} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {["HIGH", "MEDIUM", "LOW"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
