"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { X } from "lucide-react";

const PAGE_SIZE = 100;

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

const STATUS_OPTS = ["IN_PROGRESS", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
const TIER_OPTS = ["UNSCORED", "TIER_1", "TIER_2", "TIER_3"] as const;

const STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-500",
  ARCHIVED: "bg-red-100 text-red-600",
};

const TIER_COLORS: Record<string, string> = {
  TIER_1: "bg-green-100 text-green-700",
  TIER_2: "bg-blue-100 text-blue-700",
  TIER_3: "bg-purple-100 text-purple-700",
  UNSCORED: "bg-gray-100 text-gray-500",
};

const EMPTY_FORM = {
  companyName: "", contactName: "", email: "", phone: "",
  valueChain: "", region: "", district: "", businessDescription: "",
  status: "IN_PROGRESS", bankabilityTier: "UNSCORED",
  investorReadinessScore: "", followUpDate: "", notes: "",
};

export default function SmePage() {
  const [filters, setFilters] = useState({ status: "", tier: "", valueChain: "", region: "" });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<SME | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<SME | null>(null);
  const qc = useQueryClient();

  const setFilter = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };

  const queryParams = new URLSearchParams({
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    limit: String(PAGE_SIZE),
    skip: String(page * PAGE_SIZE),
  });

  const { data: res, isLoading } = useQuery<{ data: SME[]; total: number }>({
    queryKey: ["sme", filters, page],
    queryFn: () => fetcher(`/sme?${queryParams}`),
  });

  const smes = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sme/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sme"] }),
  });

  const columns = [
    {
      key: "companyName", label: "Company", sortable: true,
      render: (r: SME) => (
        <button onClick={() => setDetail(r)} className="text-left font-medium text-indigo-700 hover:underline truncate max-w-[180px] block">
          {r.companyName}
        </button>
      ),
    },
    { key: "contactName", label: "Contact", render: (r: SME) => r.contactName ?? "—" },
    { key: "phone", label: "Phone", render: (r: SME) => r.phone ?? "—" },
    { key: "valueChain", label: "Value Chain", sortable: true, render: (r: SME) => r.valueChain ?? "—" },
    { key: "region", label: "Region", sortable: true, render: (r: SME) => r.region ?? "—" },
    { key: "district", label: "District", render: (r: SME) => r.district ?? "—" },
    {
      key: "status", label: "Status", sortable: true,
      render: (r: SME) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-500"}`}>
          {r.status.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      key: "investorReadinessScore", label: "IR Score", sortable: true,
      render: (r: SME) => r.investorReadinessScore != null ? <ScoreBar score={r.investorReadinessScore} /> : <span className="text-gray-400 text-xs">Unscored</span>,
    },
    {
      key: "bankabilityTier", label: "Bankability", sortable: true,
      render: (r: SME) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[r.bankabilityTier] ?? "bg-gray-100 text-gray-500"}`}>
          {r.bankabilityTier.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "followUpDate", label: "Follow Up",
      render: (r: SME) => {
        if (!r.followUpDate) return <span className="text-gray-400">—</span>;
        const overdue = new Date(r.followUpDate) < new Date();
        return <span className={overdue ? "text-red-600 font-medium" : ""}>{new Date(r.followUpDate).toLocaleDateString()}</span>;
      },
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SME Database</h1>
        <p className="text-sm text-gray-500 mt-1">{total.toLocaleString()} SMEs · investor readiness &amp; bankability</p>
      </div>

      <DataTable
        columns={columns}
        data={smes}
        isLoading={isLoading}
        title={`${total.toLocaleString()} SMEs`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => { if (confirm(`Delete "${row.companyName}"?`)) deleteMutation.mutate(row.id); }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <FilterSelect value={filters.status} options={[{ value: "", label: "All Statuses" }, ...STATUS_OPTS.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(v) => setFilter("status", v)} />
            <FilterSelect value={filters.tier} options={[{ value: "", label: "All Tiers" }, ...TIER_OPTS.map((t) => ({ value: t, label: t.replace("_", " ") }))]} onChange={(v) => setFilter("tier", v)} />
            <input value={filters.valueChain} onChange={(e) => setFilter("valueChain", e.target.value)} placeholder="Value chain…" className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-32" />
            <input value={filters.region} onChange={(e) => setFilter("region", e.target.value)} placeholder="Region…" className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-28" />
          </div>
        }
      />

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
        <SmeFormModal
          sme={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["sme"] }); }}
        />
      )}

      {detail && (
        <DetailDrawer
          sme={detail}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); setShowForm(true); }}
        />
      )}
    </div>
  );
}

// ─── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs font-medium">{score}</span>
    </div>
  );
}

// ─── Filter select ─────────────────────────────────────────────────────────────

function FilterSelect({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────────

function SmeFormModal({ sme, onClose, onSaved }: { sme: SME | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(sme ? {
      companyName: sme.companyName,
      contactName: sme.contactName ?? "",
      email: sme.email ?? "",
      phone: sme.phone ?? "",
      valueChain: sme.valueChain ?? "",
      region: sme.region ?? "",
      district: sme.district ?? "",
      businessDescription: sme.businessDescription ?? "",
      status: sme.status,
      bankabilityTier: sme.bankabilityTier,
      investorReadinessScore: sme.investorReadinessScore != null ? String(sme.investorReadinessScore) : "",
      followUpDate: sme.followUpDate ? sme.followUpDate.slice(0, 10) : "",
      notes: sme.notes ?? "",
    } : {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.companyName.trim()) { setError("Company name is required."); return; }
    setSaving(true); setError("");
    const body = {
      ...form,
      contactName: form.contactName || null,
      email: form.email || null,
      phone: form.phone || null,
      valueChain: form.valueChain || null,
      region: form.region || null,
      district: form.district || null,
      businessDescription: form.businessDescription || null,
      investorReadinessScore: form.investorReadinessScore !== "" ? Number(form.investorReadinessScore) : null,
      followUpDate: form.followUpDate || null,
      notes: form.notes || null,
    };
    try {
      sme ? await api.put(`/sme/${sme.id}`, body) : await api.post("/sme", body);
      onSaved();
    } catch { setError("Failed to save. Check the server."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-gray-900">{sme ? "Edit SME" : "Add SME"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <Section label="Company Information">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company Name *" value={form.companyName} onChange={(v) => set("companyName", v)} span={2} />
              <Field label="Contact Name" value={form.contactName} onChange={(v) => set("contactName", v)} />
              <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} span={2} />
              <Field label="Value Chain / Sector" value={form.valueChain} onChange={(v) => set("valueChain", v)} />
              <Field label="Region" value={form.region} onChange={(v) => set("region", v)} />
              <Field label="District" value={form.district} onChange={(v) => set("district", v)} span={2} />
            </div>
            <div className="mt-3">
              <label className="text-xs font-medium text-gray-600 block mb-1">Business Description</label>
              <textarea value={form.businessDescription} onChange={(e) => set("businessDescription", e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
            </div>
          </Section>

          <Section label="Assessment & Status">
            <div className="grid grid-cols-2 gap-3">
              <FormSelect label="Status" value={form.status} options={STATUS_OPTS as unknown as string[]} onChange={(v) => set("status", v)} />
              <FormSelect label="Bankability Tier" value={form.bankabilityTier} options={TIER_OPTS as unknown as string[]} onChange={(v) => set("bankabilityTier", v)} />
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Investor Readiness Score (0–100)</label>
                <input type="number" min="0" max="100" value={form.investorReadinessScore} onChange={(e) => set("investorReadinessScore", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                {form.investorReadinessScore !== "" && (
                  <div className="mt-1.5"><ScoreBar score={Number(form.investorReadinessScore)} /></div>
                )}
              </div>
              <Field label="Follow Up Date" type="date" value={form.followUpDate} onChange={(v) => set("followUpDate", v)} />
            </div>
          </Section>

          <Section label="Notes">
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </Section>

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : sme ? "Update SME" : "Add SME"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ sme, onClose, onEdit }: { sme: SME; onClose: () => void; onEdit: () => void }) {
  const overdue = sme.followUpDate && new Date(sme.followUpDate) < new Date();
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{sme.companyName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{sme.bizId ?? "No Biz ID"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Edit</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sme.status] ?? "bg-gray-100 text-gray-500"}`}>
              {sme.status.replace(/_/g, " ")}
            </span>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[sme.bankabilityTier] ?? "bg-gray-100 text-gray-500"}`}>
              {sme.bankabilityTier.replace("_", " ")}
            </span>
          </div>

          {/* IR Score */}
          {sme.investorReadinessScore != null && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-400 mb-2">Investor Readiness Score</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${sme.investorReadinessScore >= 70 ? "bg-green-500" : sme.investorReadinessScore >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(sme.investorReadinessScore, 100)}%` }}
                  />
                </div>
                <span className="text-xl font-bold text-gray-800">{sme.investorReadinessScore}</span>
              </div>
            </div>
          )}

          {/* Key fields */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailItem label="Contact Name" value={sme.contactName} />
            <DetailItem label="Phone" value={sme.phone} />
            <DetailItem label="Email" value={sme.email} />
            <DetailItem label="Value Chain" value={sme.valueChain} />
            <DetailItem label="Region" value={sme.region} />
            <DetailItem label="District" value={sme.district} />
            <div>
              <dt className="text-xs text-gray-400 font-medium">Follow Up Date</dt>
              <dd className={`mt-0.5 ${overdue ? "text-red-600 font-medium" : "text-gray-800"}`}>
                {sme.followUpDate ? new Date(sme.followUpDate).toLocaleDateString() : "—"}
                {overdue && <span className="ml-1 text-xs">(overdue)</span>}
              </dd>
            </div>
          </dl>

          {sme.businessDescription && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Business Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3">{sme.businessDescription}</p>
            </div>
          )}

          {sme.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{sme.notes}</p>
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
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
    </div>
  );
}

function FormSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
        {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
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
