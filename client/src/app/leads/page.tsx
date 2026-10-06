"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { accessLevel, isManager, type AuthUser } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { DataTable } from "@/components/DataTable";
import { PriorityBadge } from "@/components/Badges";
import { X, Lock, Users, UserCheck } from "lucide-react";

const PAGE_SIZE = 100;

type Lead = {
  id: string;
  bizId: string | null;
  businessName: string;
  email: string | null;
  phone: string | null;
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
  visibility: "PRIVATE" | "PUBLIC" | null;
  smeId: string | null;
  convertedAt: string | null;
  archivedAt: string | null;
};

type BdoOption = { id: string; name: string; company: string };

// Restrained tinted pills instead of solid rainbow badges — meaning stays scannable,
// visual weight stays low so 100+ rows don't read as a color chart.
const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-foreground/5 text-foreground",
  CONTACTED: "bg-sky-500/10 text-sky-700",
  QUALIFIED: "bg-accent/10 text-accent",
  IN_PROGRESS: "bg-amber-500/10 text-amber-700",
  CONVERTED: "bg-emerald-500/10 text-emerald-700",
  LOST: "bg-red-500/10 text-red-700",
};

const STATUS_LIST = ["NEW", "CONTACTED", "QUALIFIED", "IN_PROGRESS", "CONVERTED", "LOST"] as const;
// A lead only reaches CONVERTED through "Convert to customer", never by picking the stage.
const EDITABLE_STATUSES = STATUS_LIST.filter((s) => s !== "CONVERTED");

// Mirrors the server (routes/leads.ts): staff edit only their own leads — a teammate's shared
// lead is read-only. Converted leads are archived and read-only for everyone.
function canEditLead(user: AuthUser | null, lead: Lead) {
  if (!user || lead.archivedAt) return false;
  return isManager(user) || (!!user.bdoId && lead.bdoId === user.bdoId);
}

const SCOPE_NOTE = {
  GROUP_OWNER: "Every lead across all businesses, private or shared",
  BUSINESS_CEO: "Every lead in your business. Private leads stay hidden from the rest of the team until you share them",
  STAFF: "Your own leads, plus leads your Business CEO has shared with the team",
};

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

const EMPTY_FORM = {
  businessName: "", email: "", phone: "", contactPerson: "", roleTitle: "",
  status: "NEW", source: "", priority: "MEDIUM",
  bdoId: "", dateAdded: "", followUpDate: "", notes: "",
};

const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent";
const selectClass = "text-sm bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40";

export default function LeadsPage() {
  const { user } = useAuth();
  const level = accessLevel(user?.role);
  const [filters, setFilters] = useState({ status: "", bdo: "", priority: "", source: "", visibility: "" });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);
  const qc = useQueryClient();

  const { data: bdos = [] } = useQuery<BdoOption[]>({ queryKey: ["bdos"], queryFn: () => fetcher("/bdo") });
  const { data: stats = {} } = useQuery<Record<string, number>>({ queryKey: ["leads-stats"], queryFn: () => fetcher("/leads/stats") });

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
    onError: (err) => alert(apiError(err, "Failed to delete lead.")),
  });

  const columns = [
    {
      key: "businessName", label: "Business", sortable: true,
      render: (r: Lead) => (
        <button onClick={() => setDetail(r)} className="text-left font-medium text-foreground hover:text-accent transition-colors truncate max-w-[180px] block">
          {r.businessName}
        </button>
      ),
    },
    { key: "contactPerson", label: "Contact", render: (r: Lead) => r.contactPerson ?? "—" },
    { key: "roleTitle", label: "Role", render: (r: Lead) => r.roleTitle ?? "—" },
    { key: "email", label: "Email", render: (r: Lead) => r.email ?? "—" },
    { key: "status", label: "Status", render: (r: Lead) => <StatusBadge value={r.status} />, sortable: true },
    {
      key: "visibility", label: "Visibility",
      render: (r: Lead) => <VisibilityBadge value={r.visibility} />,
      exportValue: (r: Lead) => (r.visibility === "PUBLIC" ? "Shared" : "Private"),
    },
    { key: "source", label: "Source", render: (r: Lead) => r.source ?? "—" },
    { key: "bdo", label: "BDO", render: (r: Lead) => r.bdo?.name ?? "—" },
    {
      key: "priority", label: "Priority",
      render: (r: Lead) => r.priority ? <PriorityBadge value={r.priority} /> : <span className="text-muted">—</span>,
      sortable: true,
    },
    {
      key: "followUpDate", label: "Follow Up",
      render: (r: Lead) => r.followUpDate ? (
        <span className={new Date(r.followUpDate) < new Date() ? "text-red-600 font-medium" : "text-foreground"}>
          {new Date(r.followUpDate).toLocaleDateString()}
        </span>
      ) : "—",
    },
    {
      key: "notes", label: "Notes",
      render: (r: Lead) => r.notes ? (
        <span title={r.notes} className="text-muted text-xs truncate max-w-[180px] block">{r.notes}</span>
      ) : <span className="text-muted">—</span>,
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">Leads</p>
        <h1 className="font-serif text-2xl md:text-3xl text-foreground">Leads Database</h1>
        <p className="text-sm text-muted mt-1">{totalLeads.toLocaleString()} leads · {SCOPE_NOTE[level]}</p>
      </div>

      {/* Status summary — click to filter */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        {STATUS_LIST.map((s) => {
          const active = filters.status === s;
          return (
            <button
              key={s}
              onClick={() => setFilter("status", active ? "" : s)}
              className={`rounded-xl border p-3 text-left transition-all bg-surface ${
                active ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/40"
              }`}
            >
              <div className={`inline-block px-1.5 py-0.5 rounded-full text-[11px] font-medium mb-2 ${STATUS_COLORS[s]}`}>
                {s.replace("_", " ")}
              </div>
              <div className="text-2xl font-semibold text-foreground tabular-nums">{(stats[s] ?? 0).toLocaleString()}</div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <DataTable
          columns={columns}
          data={leads}
          isLoading={isLoading}
          title={`${total.toLocaleString()} leads`}
          onAdd={() => { setEditing(null); setShowForm(true); }}
          onEdit={(row) => { setEditing(row); setShowForm(true); }}
          canEditRow={(row) => canEditLead(user, row)}
          onDelete={(row) => {
            if (confirm(`Delete lead "${row.businessName}"?`)) deleteMutation.mutate(row.id);
          }}
          filterBar={
            <div className="flex gap-2 flex-wrap items-center">
              <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={selectClass}>
                {["", ...STATUS_LIST].map((s) => <option key={s} value={s}>{s ? s.replace("_", " ") : "All Statuses"}</option>)}
              </select>
              <select value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)} className={selectClass}>
                {["", "HIGH", "MEDIUM", "LOW"].map((s) => <option key={s} value={s}>{s || "All Priorities"}</option>)}
              </select>
              <select value={filters.visibility} onChange={(e) => setFilter("visibility", e.target.value)} className={selectClass}>
                <option value="">Private &amp; shared</option>
                <option value="PRIVATE">Private only</option>
                <option value="PUBLIC">Shared only</option>
              </select>
              <select value={filters.bdo} onChange={(e) => setFilter("bdo", e.target.value)} className={selectClass}>
                <option value="">All BDOs</option>
                {bdos.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
              <select value={filters.source} onChange={(e) => setFilter("source", e.target.value)} className={selectClass}>
                {["", "Database", "Referral", "Cold Call", "Event", "Social Media", "Website"].map((s) => (
                  <option key={s} value={s}>{s || "All Sources"}</option>
                ))}
              </select>
            </div>
          }
        />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted">
            {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}
          </span>
          <div className="flex gap-2 items-center">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 text-foreground hover:bg-primary/5 transition-colors">← Prev</button>
            <span className="px-2 text-sm text-muted">Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 text-foreground hover:bg-primary/5 transition-colors">Next →</button>
          </div>
        </div>
      )}

      {showForm && (
        <LeadFormModal
          lead={editing}
          bdos={bdos}
          canAssign={isManager(user)}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); invalidate(); }}
        />
      )}

      {detail && (
        <DetailDrawer
          lead={detail}
          canEdit={canEditLead(user, detail)}
          canShare={isManager(user)}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); setShowForm(true); }}
          onChanged={(updated) => { setDetail(updated); invalidate(); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[value] ?? "bg-foreground/5 text-muted"}`}>
      {value.replace("_", " ")}
    </span>
  );
}

function VisibilityBadge({ value }: { value: Lead["visibility"] }) {
  return value === "PUBLIC" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-700"><Users size={11} /> Shared</span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-foreground/5 text-muted"><Lock size={11} /> Private</span>
  );
}

function LeadFormModal({ lead, bdos, canAssign, onClose, onSaved }: { lead: Lead | null; bdos: BdoOption[]; canAssign: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(lead ? {
      businessName: lead.businessName,
      email: lead.email ?? "",
      phone: lead.phone ?? "",
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
      phone: form.phone || null,
      contactPerson: form.contactPerson || null,
      roleTitle: form.roleTitle || null,
      source: form.source || null,
      priority: form.priority || null,
      dateAdded: form.dateAdded || null,
      followUpDate: form.followUpDate || null,
      notes: form.notes || null,
    };
    // Staff always own their leads — the server assigns them, so don't send a pick.
    if (!canAssign) delete (body as Partial<typeof body>).bdoId;
    try {
      lead ? await api.put(`/leads/${lead.id}`, body) : await api.post("/leads", body);
      onSaved();
    } catch (err) { setError(apiError(err, "Failed to save. Check the server.")); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-xl border border-border w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="font-serif text-lg text-foreground">{lead ? "Edit Lead" : "Add Lead"}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Business Name *" value={form.businessName} onChange={(v) => set("businessName", v)} span={2} />
            <Field label="Contact Person" value={form.contactPerson} onChange={(v) => set("contactPerson", v)} />
            <Field label="Role / Title" value={form.roleTitle} onChange={(v) => set("roleTitle", v)} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
            <Field label="Phone" type="tel" value={form.phone} onChange={(v) => set("phone", v)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {canAssign && (
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Assigned BDO</label>
                <select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className={selectClass + " w-full"}>
                  <option value="">— Unassigned —</option>
                  {bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Source</label>
              <select value={form.source} onChange={(e) => set("source", e.target.value)} className={selectClass + " w-full"}>
                {["", "Database", "Referral", "Cold Call", "Event", "Social Media", "Website"].map((s) => (
                  <option key={s} value={s}>{s || "— Select source —"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className={selectClass + " w-full"}>
                {(form.status === "CONVERTED" ? STATUS_LIST : EDITABLE_STATUSES).map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={selectClass + " w-full"}>
                {["HIGH", "MEDIUM", "LOW"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Field label="Date Added" type="date" value={form.dateAdded} onChange={(v) => set("dateAdded", v)} />
            <Field label="Follow Up Date" type="date" value={form.followUpDate} onChange={(v) => set("followUpDate", v)} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={4} className={inputClass + " resize-none"} />
          </div>

          {error && <p className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-foreground rounded-lg border border-border hover:bg-primary/5 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? "Saving…" : lead ? "Update Lead" : "Add Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailDrawer({ lead, canEdit, canShare, onClose, onEdit, onChanged }: {
  lead: Lead; canEdit: boolean; canShare: boolean; onClose: () => void; onEdit: () => void; onChanged: (lead: Lead) => void;
}) {
  const overdue = lead.followUpDate && new Date(lead.followUpDate) < new Date();
  const isPublic = lead.visibility === "PUBLIC";
  const [busy, setBusy] = useState<"" | "share" | "convert">("");
  const [error, setError] = useState("");

  const toggleShare = async () => {
    setBusy("share"); setError("");
    try {
      const { data } = await api.put(`/leads/${lead.id}/visibility`, { visibility: isPublic ? "PRIVATE" : "PUBLIC" });
      onChanged(data);
    } catch (err) { setError(apiError(err, "Failed to change visibility.")); }
    finally { setBusy(""); }
  };

  const convert = async () => {
    if (!confirm(`Convert "${lead.businessName}" to a customer? The lead will be archived.`)) return;
    setBusy("convert"); setError("");
    try {
      const { data } = await api.post(`/leads/${lead.id}/convert`);
      onChanged(data.lead);
    } catch (err) { setError(apiError(err, "Failed to convert lead.")); }
    finally { setBusy(""); }
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-primary/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-surface w-full max-w-md h-full overflow-y-auto shadow-2xl border-l border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-serif text-lg text-foreground">{lead.businessName}</h2>
            <p className="text-xs text-muted mt-0.5">{lead.bizId ?? "No Biz ID"}</p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity">Edit</button>}
            <button onClick={onClose} className="text-muted hover:text-foreground transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={lead.status} />
            <VisibilityBadge value={lead.visibility} />
            {lead.priority && <PriorityBadge value={lead.priority} />}
          </div>

          {lead.archivedAt ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-500/5 px-3 py-2.5 text-sm text-foreground">
              Converted to a customer on {new Date(lead.convertedAt ?? lead.archivedAt).toLocaleDateString()}. This lead is archived.{" "}
              <Link href="/sme" className="font-medium text-accent hover:underline">View clients</Link>
            </div>
          ) : (canEdit || canShare) && (
            <div className="flex flex-col sm:flex-row gap-2">
              {canEdit && (
                <button onClick={convert} disabled={!!busy} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                  <UserCheck size={15} /> {busy === "convert" ? "Converting…" : "Convert to customer"}
                </button>
              )}
              {canShare && (
                <button onClick={toggleShare} disabled={!!busy} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-primary/5 disabled:opacity-50 transition-colors">
                  {isPublic ? <Lock size={15} /> : <Users size={15} />}
                  {busy === "share" ? "Saving…" : isPublic ? "Make private" : "Share with team"}
                </button>
              )}
            </div>
          )}
          {!lead.archivedAt && !canEdit && (
            <p className="text-xs text-muted">Shared by your Business CEO. Only its owner can edit or convert it.</p>
          )}
          {error && <p className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailItem label="Contact Person" value={lead.contactPerson} />
            <DetailItem label="Role / Title" value={lead.roleTitle} />
            <DetailItem label="Email" value={lead.email} />
            <DetailItem label="Phone" value={lead.phone} />
            <DetailItem label="BDO" value={lead.bdo?.name} />
            <DetailItem label="Source" value={lead.source} />
            <DetailItem label="Date Added" value={lead.dateAdded ? new Date(lead.dateAdded).toLocaleDateString() : null} />
            <div>
              <dt className="text-xs text-muted font-medium">Follow Up Date</dt>
              <dd className={`mt-0.5 ${overdue ? "text-red-600 font-medium" : "text-foreground"}`}>
                {lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString() : "—"}
                {overdue && <span className="ml-1 text-xs">(overdue)</span>}
              </dd>
            </div>
          </dl>

          {lead.notes && (
            <div>
              <p className="text-xs font-semibold text-muted mb-1.5">Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-background rounded-lg p-3 border border-border">{lead.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", span }: { label: string; value: string; onChange: (v: string) => void; type?: string; span?: number }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-muted block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted font-medium">{label}</dt>
      <dd className="text-foreground mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}