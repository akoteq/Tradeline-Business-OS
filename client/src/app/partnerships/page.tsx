"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { X } from "lucide-react";

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

const STATUS_OPTS = ["ACTIVE", "PENDING", "EXPIRED", "SUSPENDED"] as const;
const ENTITY_OPTS = ["BAPX", "TRADELINE"] as const;

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  EXPIRED: "bg-gray-100 text-gray-500",
  SUSPENDED: "bg-red-100 text-red-700",
};

const ENTITY_COLORS: Record<string, string> = {
  BAPX: "bg-indigo-100 text-indigo-700",
  TRADELINE: "bg-teal-100 text-teal-700",
};

const EMPTY_FORM = {
  partnerOrganisation: "", contactPerson: "", contactEmailPhone: "",
  partnershipType: "", tradelineEntity: "TRADELINE", valueChainSector: "",
  country: "", agreementType: "", status: "ACTIVE",
  startDate: "", endRenewalDate: "",
  revenueSharePct: "", revenueGeneratedGhs: "", notes: "",
};

const fmt = (n: number) => `GHS ${n.toLocaleString()}`;

function expiryStatus(endDate: string | null): "expired" | "expiring-soon" | "ok" | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  const days = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 60) return "expiring-soon";
  return "ok";
}

export default function PartnershipsPage() {
  const [filters, setFilters] = useState({ status: "", entity: "", country: "" });
  const [editing, setEditing] = useState<Partnership | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<Partnership | null>(null);
  const qc = useQueryClient();

  const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
  const { data = [], isLoading } = useQuery<Partnership[]>({
    queryKey: ["partnerships", filters],
    queryFn: () => fetcher(`/partnerships?${params}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/partnerships/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partnerships"] }),
  });

  const totalRevenue = data.reduce((s, p) => s + (p.revenueGeneratedGhs ?? 0), 0);
  const activeCount = data.filter((p) => p.status === "ACTIVE").length;
  const expiringCount = data.filter((p) => expiryStatus(p.endRenewalDate) === "expiring-soon").length;

  const columns = [
    {
      key: "partnerOrganisation", label: "Organisation", sortable: true,
      render: (r: Partnership) => (
        <button onClick={() => setDetail(r)} className="text-left font-medium text-accent hover:underline truncate max-w-[180px] block">
          {r.partnerOrganisation}
        </button>
      ),
    },
    { key: "contactPerson", label: "Contact", render: (r: Partnership) => r.contactPerson ?? "—" },
    { key: "partnershipType", label: "Type", render: (r: Partnership) => r.partnershipType ?? "—" },
    {
      key: "tradelineEntity", label: "Entity",
      render: (r: Partnership) => r.tradelineEntity ? (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ENTITY_COLORS[r.tradelineEntity] ?? "bg-gray-100 text-gray-500"}`}>
          {r.tradelineEntity}
        </span>
      ) : <span className="text-gray-400">—</span>,
    },
    { key: "valueChainSector", label: "Sector", render: (r: Partnership) => r.valueChainSector ?? "—" },
    { key: "country", label: "Country", sortable: true, render: (r: Partnership) => r.country ?? "—" },
    {
      key: "status", label: "Status", sortable: true,
      render: (r: Partnership) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: "endRenewalDate", label: "Renewal", sortable: true,
      render: (r: Partnership) => {
        if (!r.endRenewalDate) return <span className="text-gray-400">—</span>;
        const es = expiryStatus(r.endRenewalDate);
        return (
          <span className={es === "expired" ? "text-red-600 font-medium" : es === "expiring-soon" ? "text-orange-600 font-medium" : ""}>
            {new Date(r.endRenewalDate).toLocaleDateString()}
            {es === "expiring-soon" && <span className="ml-1 text-xs">(soon)</span>}
            {es === "expired" && <span className="ml-1 text-xs">(expired)</span>}
          </span>
        );
      },
    },
    { key: "revenueSharePct", label: "Rev Share", render: (r: Partnership) => r.revenueSharePct != null ? `${r.revenueSharePct}%` : "—" },
    { key: "revenueGeneratedGhs", label: "Revenue (GHS)", sortable: true, render: (r: Partnership) => r.revenueGeneratedGhs != null ? fmt(r.revenueGeneratedGhs) : "—" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partnerships & MOUs</h1>
          <p className="text-sm text-gray-500 mt-1">Strategic partnerships · Joint ventures · Revenue-sharing agreements</p>
        </div>
        <div className="flex gap-3 text-sm">
          <StatCard label="Active" value={String(activeCount)} color="green" />
          {expiringCount > 0 && <StatCard label="Expiring Soon" value={String(expiringCount)} color="orange" />}
          <StatCard label="Total Revenue" value={fmt(totalRevenue)} color="blue" />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        title={`${data.length} partnerships`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => { if (confirm(`Delete "${row.partnerOrganisation}"?`)) deleteMutation.mutate(row.id); }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <FilterSelect value={filters.status} options={[{ value: "", label: "All Statuses" }, ...STATUS_OPTS.map((s) => ({ value: s, label: s }))]} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
            <FilterSelect value={filters.entity} options={[{ value: "", label: "All Entities" }, ...ENTITY_OPTS.map((e) => ({ value: e, label: e }))]} onChange={(v) => setFilters((f) => ({ ...f, entity: v }))} />
            <input value={filters.country} onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))} placeholder="Country…" className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-28" />
          </div>
        }
      />

      {showForm && (
        <PartnershipFormModal
          p={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["partnerships"] }); }}
        />
      )}

      {detail && (
        <DetailDrawer
          p={detail}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); setShowForm(true); }}
        />
      )}
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: "green" | "orange" | "blue" }) {
  const styles = {
    green: "bg-green-50 border-green-200 text-green-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
  };
  return (
    <div className={`border rounded-lg px-3 py-2 text-center ${styles[color]}`}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="font-bold text-sm mt-0.5">{value}</div>
    </div>
  );
}

// ─── Filter select ─────────────────────────────────────────────────────────────

function FilterSelect({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────────

function PartnershipFormModal({ p, onClose, onSaved }: { p: Partnership | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(p ? {
      partnerOrganisation: p.partnerOrganisation,
      contactPerson: p.contactPerson ?? "",
      contactEmailPhone: p.contactEmailPhone ?? "",
      partnershipType: p.partnershipType ?? "",
      tradelineEntity: p.tradelineEntity ?? "TRADELINE",
      valueChainSector: p.valueChainSector ?? "",
      country: p.country ?? "",
      agreementType: p.agreementType ?? "",
      status: p.status,
      startDate: p.startDate ? p.startDate.slice(0, 10) : "",
      endRenewalDate: p.endRenewalDate ? p.endRenewalDate.slice(0, 10) : "",
      revenueSharePct: p.revenueSharePct != null ? String(p.revenueSharePct) : "",
      revenueGeneratedGhs: p.revenueGeneratedGhs != null ? String(p.revenueGeneratedGhs) : "",
      notes: p.notes ?? "",
    } : {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.partnerOrganisation.trim()) { setError("Organisation name is required."); return; }
    setSaving(true); setError("");
    const body = {
      ...form,
      tradelineEntity: form.tradelineEntity || null,
      contactPerson: form.contactPerson || null,
      contactEmailPhone: form.contactEmailPhone || null,
      partnershipType: form.partnershipType || null,
      valueChainSector: form.valueChainSector || null,
      country: form.country || null,
      agreementType: form.agreementType || null,
      startDate: form.startDate || null,
      endRenewalDate: form.endRenewalDate || null,
      revenueSharePct: form.revenueSharePct !== "" ? Number(form.revenueSharePct) : null,
      revenueGeneratedGhs: form.revenueGeneratedGhs !== "" ? Number(form.revenueGeneratedGhs) : null,
      notes: form.notes || null,
    };
    try {
      p ? await api.put(`/partnerships/${p.id}`, body) : await api.post("/partnerships", body);
      onSaved();
    } catch { setError("Failed to save. Check the server."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-gray-900">{p ? "Edit Partnership" : "Add Partnership"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <Section label="Partner Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Organisation Name *" value={form.partnerOrganisation} onChange={(v) => set("partnerOrganisation", v)} span={2} />
              <Field label="Contact Person" value={form.contactPerson} onChange={(v) => set("contactPerson", v)} />
              <Field label="Email / Phone" value={form.contactEmailPhone} onChange={(v) => set("contactEmailPhone", v)} />
              <Field label="Country" value={form.country} onChange={(v) => set("country", v)} />
              <Field label="Value Chain / Sector" value={form.valueChainSector} onChange={(v) => set("valueChainSector", v)} />
            </div>
          </Section>

          <Section label="Agreement">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Partnership Type" value={form.partnershipType} onChange={(v) => set("partnershipType", v)} />
              <Field label="Agreement Type" value={form.agreementType} onChange={(v) => set("agreementType", v)} />
              <Field label="Start Date" type="date" value={form.startDate} onChange={(v) => set("startDate", v)} />
              <Field label="End / Renewal Date" type="date" value={form.endRenewalDate} onChange={(v) => set("endRenewalDate", v)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Entity</label>
                <select value={form.tradelineEntity} onChange={(e) => set("tradelineEntity", e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                  <option value="">— None —</option>
                  {ENTITY_OPTS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <FormSelect label="Status" value={form.status} options={STATUS_OPTS as unknown as string[]} onChange={(v) => set("status", v)} />
            </div>
          </Section>

          <Section label="Revenue">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Revenue Share %" type="number" value={form.revenueSharePct} onChange={(v) => set("revenueSharePct", v)} />
              <Field label="Revenue Generated (GHS)" type="number" value={form.revenueGeneratedGhs} onChange={(v) => set("revenueGeneratedGhs", v)} />
            </div>
          </Section>

          <Section label="Notes">
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
          </Section>

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : p ? "Update Partnership" : "Add Partnership"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ p, onClose, onEdit }: { p: Partnership; onClose: () => void; onEdit: () => void }) {
  const es = expiryStatus(p.endRenewalDate);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{p.partnerOrganisation}</h2>
            {p.country && <p className="text-xs text-gray-400 mt-0.5">{p.country}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90">Edit</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-100"}`}>{p.status}</span>
            {p.tradelineEntity && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ENTITY_COLORS[p.tradelineEntity] ?? "bg-gray-100"}`}>{p.tradelineEntity}</span>
            )}
            {es === "expiring-soon" && <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Expiring Soon</span>}
            {es === "expired" && <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Expired</span>}
          </div>

          {/* Revenue */}
          {(p.revenueSharePct != null || p.revenueGeneratedGhs != null) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {p.revenueSharePct != null && (
                <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-center">
                  <div className="text-xs font-medium text-accent">Revenue Share</div>
                  <div className="font-bold text-accent text-lg">{p.revenueSharePct}%</div>
                </div>
              )}
              {p.revenueGeneratedGhs != null && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <div className="text-xs font-medium text-emerald-600">Revenue Generated</div>
                  <div className="font-bold text-emerald-700">{fmt(p.revenueGeneratedGhs)}</div>
                </div>
              )}
            </div>
          )}

          {/* Key fields */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailItem label="Contact Person" value={p.contactPerson} />
            <DetailItem label="Email / Phone" value={p.contactEmailPhone} />
            <DetailItem label="Partnership Type" value={p.partnershipType} />
            <DetailItem label="Agreement Type" value={p.agreementType} />
            <DetailItem label="Sector" value={p.valueChainSector} />
            <DetailItem label="Country" value={p.country} />
            <DetailItem label="Start Date" value={p.startDate ? new Date(p.startDate).toLocaleDateString() : null} />
            <div>
              <dt className="text-xs text-gray-400 font-medium">End / Renewal Date</dt>
              <dd className={`mt-0.5 ${es === "expired" ? "text-red-600 font-medium" : es === "expiring-soon" ? "text-orange-600 font-medium" : "text-gray-800"}`}>
                {p.endRenewalDate ? new Date(p.endRenewalDate).toLocaleDateString() : "—"}
              </dd>
            </div>
          </dl>

          {p.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3">{p.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{label}</p>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", span }: { label: string; value: string; onChange: (v: string) => void; type?: string; span?: number }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
    </div>
  );
}

function FormSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
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
