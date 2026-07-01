"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { PriorityBadge } from "@/components/Badges";
import { X } from "lucide-react";

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
  bdoId: string | null;
  bdo: { id: string; name: string } | null;
  priority: string | null;
  dateAdded: string | null;
  followUpDate: string | null;
  notes: string | null;
};

type BdoOption = { id: string; name: string; company: string };

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-700",
  CONTACTED: "bg-blue-100 text-blue-700",
  QUALIFIED: "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  CONVERTED: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
};

const STATUS_LIST = ["NEW", "CONTACTED", "QUALIFIED", "IN_PROGRESS", "CONVERTED", "LOST"] as const;

const EMPTY_FORM = {
  businessName: "", email: "", contactPerson: "", roleTitle: "",
  status: "NEW", source: "", priority: "MEDIUM",
  bdoId: "", dateAdded: "", followUpDate: "", notes: "",
};

export default function LeadsPage() {
  const [filters, setFilters] = useState({ status: "", bdo: "", priority: "", source: "" });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);
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
  const totalLeads = Object.values(stats).reduce((a, b) => a + b, 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["leads-stats"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: invalidate,
  });

  const columns = [
    {
      key: "businessName", label: "Business", sortable: true,
      render: (r: Lead) => (
        <button onClick={() => setDetail(r)} className="text-left font-medium text-indigo-700 hover:underline truncate max-w-[180px] block">
          {r.businessName}
        </button>
      ),
    },
    { key: "contactPerson", label: "Contact", render: (r: Lead) => r.contactPerson ?? "—" },
    { key: "roleTitle", label: "Role", render: (r: Lead) => r.roleTitle ?? "—" },
    { key: "email", label: "Email", render: (r: Lead) => r.email ?? "—" },
    { key: "status", label: "Status", render: (r: Lead) => <StatusBadge value={r.status} />, sortable: true },
    { key: "source", label: "Source", render: (r: Lead) => r.source ?? "—" },
    { key: "bdo", label: "BDO", render: (r: Lead) => r.bdo?.name ?? "—" },
    {
      key: "priority", label: "Priority",
      render: (r: Lead) => r.priority ? <PriorityBadge value={r.priority} /> : <span className="text-gray-400">—</span>,
      sortable: true,
    },
    {
      key: "followUpDate", label: "Follow Up",
      render: (r: Lead) => r.followUpDate ? (
        <span className={new Date(r.followUpDate) < new Date() ? "text-red-600 font-medium" : ""}>
          {new Date(r.followUpDate).toLocaleDateString()}
        </span>
      ) : "—",
    },
    {
      key: "notes", label: "Notes",
      render: (r: Lead) => r.notes ? (
        <span title={r.notes} className="text-gray-500 text-xs truncate max-w-[180px] block">{r.notes}</span>
      ) : <span className="text-gray-400">—</span>,
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads Database</h1>
        <p className="text-sm text-gray-500 mt-1">{totalLeads.toLocaleString()} total leads across all channels</p>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {STATUS_LIST.map((s) => (
          <button
            key={s}
            onClick={() => setFilter("status", filters.status === s ? "" : s)}
            className={`rounded-xl border p-3 text-left transition-all bg-white ${
              filters.status === s ? "ring-2 ring-indigo-400 border-indigo-200" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium mb-2 ${STATUS_COLORS[s]}`}>
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
            <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {["", ...STATUS_LIST].map((s) => <option key={s} value={s}>{s ? s.replace("_", " ") : "All Statuses"}</option>)}
            </select>
            <select value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {["", "HIGH", "MEDIUM", "LOW"].map((s) => <option key={s} value={s}>{s || "All Priorities"}</option>)}
            </select>
            <select value={filters.bdo} onChange={(e) => setFilter("bdo", e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="">All BDOs</option>
              {bdos.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
            <select value={filters.source} onChange={(e) => setFilter("source", e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {["", "Database", "Referral", "Cold Call", "Event", "Social Media", "Website"].map((s) => (
                <option key={s} value={s}>{s || "All Sources"}</option>
              ))}
            </select>
          </div>
        }
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-gray-500">
            {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}
          </span>
          <div className="flex gap-2 items-center">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
            <span className="px-2 text-sm text-gray-600">Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
          </div>
        </div>
      )}

      {showForm && (
        <LeadFormModal
          lead={editing}
          bdos={bdos}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); invalidate(); }}
        />
      )}

      {detail && (
        <DetailDrawer
          lead={detail}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); setShowForm(true); }}
        />
      )}
    </div>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[value] ?? "bg-gray-100 text-gray-500"}`}>
      {value.replace("_", " ")}
    </span>
  );
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────────

function LeadFormModal({ lead, bdos, onClose, onSaved }: { lead: Lead | null; bdos: BdoOption[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(lead ? {
      businessName: lead.businessName,
      email: lead.email ?? "",
      contactPerson: lead.contactPerson ?? "",
      roleTitle: lead.roleTitle ?? "",
      status: lead.status,
      source: lead.source ?? "",
      priority: lead.priority ?? "MEDIUM",
      bdoId: lead.bdoId ?? "",
      dateAdded: lead.dateAdded ? lead.dateAdded.slice(0, 10) : "",
      followUpDate: lead.followUpDate ? lead.followUpDate.slice(0, 10) : "",
      notes: lead.notes ?? "",
    } : {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.businessName.trim()) { setError("Business name is required."); return; }
    setSaving(true); setError("");
    const body = {
      ...form,
      bdoId: form.bdoId || null,
      email: form.email || null,
      contactPerson: form.contactPerson || null,
      roleTitle: form.roleTitle || null,
      source: form.source || null,
      priority: form.priority || null,
      dateAdded: form.dateAdded || null,
      followUpDate: form.followUpDate || null,
      notes: form.notes || null,
    };
    try {
      lead ? await api.put(`/leads/${lead.id}`, body) : await api.post("/leads", body);
      onSaved();
    } catch { setError("Failed to save. Check the server."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-gray-900">{lead ? "Edit Lead" : "Add Lead"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Business Name *" value={form.businessName} onChange={(v) => set("businessName", v)} span={2} />
            <Field label="Contact Person" value={form.contactPerson} onChange={(v) => set("contactPerson", v)} />
            <Field label="Role / Title" value={form.roleTitle} onChange={(v) => set("roleTitle", v)} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} span={2} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Assigned BDO</label>
              <select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">— Unassigned —</option>
                {bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Source</label>
              <select value={form.source} onChange={(e) => set("source", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {["", "Database", "Referral", "Cold Call", "Event", "Social Media", "Website"].map((s) => (
                  <option key={s} value={s}>{s || "— Select source —"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {["NEW", "CONTACTED", "QUALIFIED", "IN_PROGRESS", "CONVERTED", "LOST"].map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {["HIGH", "MEDIUM", "LOW"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Field label="Date Added" type="date" value={form.dateAdded} onChange={(v) => set("dateAdded", v)} />
            <Field label="Follow Up Date" type="date" value={form.followUpDate} onChange={(v) => set("followUpDate", v)} />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={4} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : lead ? "Update Lead" : "Add Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ lead, onClose, onEdit }: { lead: Lead; onClose: () => void; onEdit: () => void }) {
  const overdue = lead.followUpDate && new Date(lead.followUpDate) < new Date();
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{lead.businessName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{lead.bizId ?? "No Biz ID"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Edit</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={lead.status} />
            {lead.priority && <PriorityBadge value={lead.priority} />}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailItem label="Contact Person" value={lead.contactPerson} />
            <DetailItem label="Role / Title" value={lead.roleTitle} />
            <DetailItem label="Email" value={lead.email} />
            <DetailItem label="BDO" value={lead.bdo?.name} />
            <DetailItem label="Source" value={lead.source} />
            <DetailItem label="Date Added" value={lead.dateAdded ? new Date(lead.dateAdded).toLocaleDateString() : null} />
            <div>
              <dt className="text-xs text-gray-400 font-medium">Follow Up Date</dt>
              <dd className={`mt-0.5 ${overdue ? "text-red-600 font-medium" : "text-gray-800"}`}>
                {lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString() : "—"}
                {overdue && <span className="ml-1 text-xs">(overdue)</span>}
              </dd>
            </div>
          </dl>

          {lead.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3">{lead.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text", span }: { label: string; value: string; onChange: (v: string) => void; type?: string; span?: number }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 font-medium">{label}</dt>
      <dd className="text-gray-800 mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}
