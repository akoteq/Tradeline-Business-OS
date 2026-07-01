"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { X, FileText, Trash2 } from "lucide-react";

const PAGE_SIZE = 100;

type LinkedDeal = { id: string; type: "TRADELINE" | "GRANT"; label: string; status: string };

type SME = {
  id: string;
  bizId: string | null;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  address: string | null;
  valueChain: string | null;
  region: string | null;
  district: string | null;
  businessDescription: string | null;
  status: string;
  followUpDate: string | null;
  investorReadinessScore: number | null;
  bankabilityTier: string;
  collateralStatus: string | null;
  dateOfIncorporation: string | null;
  yearsInOperation: number | null;
  revenueGhs2023: number | null;
  revenueGhs2024: number | null;
  revenueGhs2025: number | null;
  revenueGhs2026: number | null;
  bdoId: string | null;
  bdo: { id: string; name: string } | null;
  notes: string | null;
  tradelineCount?: number;
  grantCount?: number;
  linkedDeals?: LinkedDeal[];
};

type BdoOption = { id: string; name: string; company: string };

const STATUS_OPTS = ["IN_PROGRESS", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
const TIER_OPTS = ["UNSCORED", "TIER_1", "TIER_2", "TIER_3"] as const;
const REVENUE_YEARS = ["2023", "2024", "2025", "2026"] as const;

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

const PIPELINE_HREF: Record<LinkedDeal["type"], string> = {
  TRADELINE: "/tradeline/pipeline",
  GRANT: "/grant-loans",
};

const EMPTY_FORM = {
  companyName: "", contactName: "", email: "", phone: "", altPhone: "", address: "",
  valueChain: "", region: "", district: "", businessDescription: "",
  status: "IN_PROGRESS", bankabilityTier: "UNSCORED", collateralStatus: "",
  investorReadinessScore: "", followUpDate: "", notes: "",
  dateOfIncorporation: "", yearsInOperation: "",
  revenueGhs2023: "", revenueGhs2024: "", revenueGhs2025: "", revenueGhs2026: "",
  bdoId: "",
};

function fmt(n: number) {
  return `GHS ${n.toLocaleString()}`;
}

const COMPLETENESS_CHECKS: [string, (s: SME) => boolean][] = [
  ["Contact Person", (s) => !!s.contactName],
  ["Phone", (s) => !!s.phone],
  ["Email", (s) => !!s.email],
  ["Location", (s) => !!(s.region || s.district || s.address)],
  ["Value Chain", (s) => !!s.valueChain],
  ["Date of Incorporation", (s) => !!s.dateOfIncorporation],
  ["Years in Operation", (s) => s.yearsInOperation != null],
  ["Revenue Data", (s) => [s.revenueGhs2023, s.revenueGhs2024, s.revenueGhs2025, s.revenueGhs2026].some((v) => v != null)],
  ["Assigned BDO", (s) => !!s.bdoId],
  ["Bankability Assessed", (s) => s.bankabilityTier !== "UNSCORED"],
  ["Collateral Status", (s) => !!s.collateralStatus],
];

function completeness(sme: SME) {
  const missing = COMPLETENESS_CHECKS.filter(([, check]) => !check(sme)).map(([label]) => label);
  const percent = Math.round(((COMPLETENESS_CHECKS.length - missing.length) / COMPLETENESS_CHECKS.length) * 100);
  return { percent, missing };
}

function CompletenessBadge({ sme }: { sme: SME }) {
  const { percent } = completeness(sme);
  const color = percent >= 80 ? "bg-green-500" : percent >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-gray-500">{percent}%</span>
    </div>
  );
}

export default function SmePage() {
  const [filters, setFilters] = useState({ status: "", tier: "", valueChain: "", region: "", bdo: "" });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<SME | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const qc = useQueryClient();

  const setFilter = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };

  // Pick up a ?bdo= link from elsewhere in the app (e.g. a BDO's dashboard).
  useEffect(() => {
    const bdo = new URLSearchParams(window.location.search).get("bdo");
    if (bdo) setFilters((f) => ({ ...f, bdo }));
  }, []);

  const { data: bdos = [] } = useQuery<BdoOption[]>({ queryKey: ["bdos"], queryFn: () => fetcher("/bdo") });

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

  const { data: detail } = useQuery<SME>({
    queryKey: ["sme-detail", detailId],
    queryFn: () => fetcher(`/sme/${detailId}`),
    enabled: !!detailId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sme/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sme"] }),
  });

  const columns = [
    {
      key: "companyName", label: "Company", sortable: true,
      render: (r: SME) => (
        <button onClick={() => setDetailId(r.id)} className="text-left font-medium text-indigo-700 hover:underline truncate max-w-[180px] block">
          {r.companyName}
        </button>
      ),
    },
    { key: "contactName", label: "Contact", render: (r: SME) => r.contactName ?? "—" },
    { key: "phone", label: "Phone", render: (r: SME) => r.phone ?? "—" },
    { key: "valueChain", label: "Value Chain", sortable: true, render: (r: SME) => r.valueChain ?? "—" },
    { key: "region", label: "Region", sortable: true, render: (r: SME) => r.region ?? "—" },
    { key: "bdo", label: "BDO", render: (r: SME) => r.bdo?.name ?? "—" },
    {
      key: "status", label: "Status", sortable: true,
      render: (r: SME) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-500"}`}>
          {r.status.replace(/_/g, " ")}
        </span>
      ),
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
      key: "deals", label: "Deals / Grants",
      render: (r: SME) => {
        const t = r.tradelineCount ?? 0, g = r.grantCount ?? 0;
        if (t === 0 && g === 0) return <span className="text-gray-400 text-xs">None yet</span>;
        return <span className="text-xs text-gray-600">{t > 0 && `${t} Tradeline`}{t > 0 && g > 0 && " · "}{g > 0 && `${g} Grant`}</span>;
      },
      exportValue: (r: SME) => {
        const t = r.tradelineCount ?? 0, g = r.grantCount ?? 0;
        const parts = [t > 0 ? `${t} Tradeline` : "", g > 0 ? `${g} Grant` : ""].filter(Boolean);
        return parts.join(", ") || "None";
      },
    },
    {
      key: "completeness", label: "Completeness",
      render: (r: SME) => <CompletenessBadge sme={r} />,
      exportValue: (r: SME) => `${completeness(r).percent}%`,
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Client Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          {total.toLocaleString()} clients · pulled in automatically from Tradeline &amp; Grant deals, plus SME profiles you add here
        </p>
      </div>

      <DataTable
        columns={columns}
        data={smes}
        isLoading={isLoading}
        title={`${total.toLocaleString()} clients`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => { if (confirm(`Delete "${row.companyName}"?`)) deleteMutation.mutate(row.id); }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <FilterSelect value={filters.status} options={[{ value: "", label: "All Statuses" }, ...STATUS_OPTS.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(v) => setFilter("status", v)} />
            <FilterSelect value={filters.tier} options={[{ value: "", label: "All Tiers" }, ...TIER_OPTS.map((t) => ({ value: t, label: t.replace("_", " ") }))]} onChange={(v) => setFilter("tier", v)} />
            <FilterSelect value={filters.bdo} options={[{ value: "", label: "All BDOs" }, ...bdos.map((b) => ({ value: b.name, label: b.name }))]} onChange={(v) => setFilter("bdo", v)} />
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
          bdos={bdos}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["sme"] }); }}
        />
      )}

      {detailId && detail && (
        <DetailDrawer
          sme={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => { setEditing(detail); setDetailId(null); setShowForm(true); }}
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

function SmeFormModal({ sme, bdos, onClose, onSaved }: { sme: SME | null; bdos: BdoOption[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(sme ? {
      companyName: sme.companyName,
      contactName: sme.contactName ?? "",
      email: sme.email ?? "",
      phone: sme.phone ?? "",
      altPhone: sme.altPhone ?? "",
      address: sme.address ?? "",
      valueChain: sme.valueChain ?? "",
      region: sme.region ?? "",
      district: sme.district ?? "",
      businessDescription: sme.businessDescription ?? "",
      status: sme.status,
      bankabilityTier: sme.bankabilityTier,
      collateralStatus: sme.collateralStatus ?? "",
      investorReadinessScore: sme.investorReadinessScore != null ? String(sme.investorReadinessScore) : "",
      followUpDate: sme.followUpDate ? sme.followUpDate.slice(0, 10) : "",
      notes: sme.notes ?? "",
      dateOfIncorporation: sme.dateOfIncorporation ? sme.dateOfIncorporation.slice(0, 10) : "",
      yearsInOperation: sme.yearsInOperation != null ? String(sme.yearsInOperation) : "",
      revenueGhs2023: sme.revenueGhs2023 != null ? String(sme.revenueGhs2023) : "",
      revenueGhs2024: sme.revenueGhs2024 != null ? String(sme.revenueGhs2024) : "",
      revenueGhs2025: sme.revenueGhs2025 != null ? String(sme.revenueGhs2025) : "",
      revenueGhs2026: sme.revenueGhs2026 != null ? String(sme.revenueGhs2026) : "",
      bdoId: sme.bdoId ?? "",
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
      altPhone: form.altPhone || null,
      address: form.address || null,
      valueChain: form.valueChain || null,
      region: form.region || null,
      district: form.district || null,
      businessDescription: form.businessDescription || null,
      collateralStatus: form.collateralStatus || null,
      investorReadinessScore: form.investorReadinessScore !== "" ? Number(form.investorReadinessScore) : null,
      followUpDate: form.followUpDate || null,
      notes: form.notes || null,
      dateOfIncorporation: form.dateOfIncorporation || null,
      yearsInOperation: form.yearsInOperation !== "" ? Number(form.yearsInOperation) : null,
      revenueGhs2023: form.revenueGhs2023 !== "" ? Number(form.revenueGhs2023) : null,
      revenueGhs2024: form.revenueGhs2024 !== "" ? Number(form.revenueGhs2024) : null,
      revenueGhs2025: form.revenueGhs2025 !== "" ? Number(form.revenueGhs2025) : null,
      revenueGhs2026: form.revenueGhs2026 !== "" ? Number(form.revenueGhs2026) : null,
      bdoId: form.bdoId || null,
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
          <h2 className="font-semibold text-gray-900">{sme ? "Edit Client" : "Add Client"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <Section label="Company Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Business Name *" value={form.companyName} onChange={(v) => set("companyName", v)} span={2} />
              <Field label="Contact Person" value={form.contactName} onChange={(v) => set("contactName", v)} />
              <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
              <Field label="Alternate Phone" value={form.altPhone} onChange={(v) => set("altPhone", v)} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
              <Field label="Region" value={form.region} onChange={(v) => set("region", v)} />
              <Field label="Town / District" value={form.district} onChange={(v) => set("district", v)} />
              <Field label="Address" value={form.address} onChange={(v) => set("address", v)} span={2} />
              <Field label="Value Chain / Sector" value={form.valueChain} onChange={(v) => set("valueChain", v)} span={2} />
            </div>
            <div className="mt-3">
              <label className="text-xs font-medium text-gray-600 block mb-1">Business Description</label>
              <textarea value={form.businessDescription} onChange={(e) => set("businessDescription", e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
            </div>
          </Section>

          <Section label="Business Profile">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Date of Incorporation" type="date" value={form.dateOfIncorporation} onChange={(v) => set("dateOfIncorporation", v)} />
              <Field label="Years in Operation" type="number" min={0} value={form.yearsInOperation} onChange={(v) => set("yearsInOperation", v)} />
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Assigned BDO</label>
                <select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">— Unassigned —</option>
                  {bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}
                </select>
              </div>
            </div>
          </Section>

          <Section label="Financial Records — Revenue by Year (GHS)">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {REVENUE_YEARS.map((y) => (
                <Field key={y} label={y} type="number" min={0} value={form[`revenueGhs${y}` as keyof typeof form] as string} onChange={(v) => set(`revenueGhs${y}`, v)} />
              ))}
            </div>
          </Section>

          <Section label="Assessment & Status">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <Field label="Bankability / Collateral Status" value={form.collateralStatus} onChange={(v) => set("collateralStatus", v)} span={2} placeholder="e.g. Land title available, no collateral yet…" />
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
            {saving ? "Saving…" : sme ? "Update Client" : "Add Client"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ sme, onClose, onEdit }: { sme: SME; onClose: () => void; onEdit: () => void }) {
  const overdue = sme.followUpDate && new Date(sme.followUpDate) < new Date();
  const { percent, missing } = completeness(sme);
  const revenueYears = REVENUE_YEARS.map((y) => ({ year: y, value: sme[`revenueGhs${y}` as keyof SME] as number | null }));
  const hasRevenue = revenueYears.some((r) => r.value != null);

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
          {/* Completeness */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-500">Profile Completeness</p>
              <span className="text-sm font-bold text-gray-800">{percent}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div className={`h-full rounded-full ${percent >= 80 ? "bg-green-500" : percent >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${percent}%` }} />
            </div>
            {missing.length > 0 && (
              <p className="text-xs text-gray-400">Missing: {missing.join(", ")}</p>
            )}
          </div>

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
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailItem label="Contact Person" value={sme.contactName} />
            <DetailItem label="Phone" value={sme.phone} />
            <DetailItem label="Alternate Phone" value={sme.altPhone} />
            <DetailItem label="Email" value={sme.email} />
            <DetailItem label="Region" value={sme.region} />
            <DetailItem label="Town / District" value={sme.district} />
            <DetailItem label="Address" value={sme.address} />
            <DetailItem label="Value Chain" value={sme.valueChain} />
            <DetailItem label="Assigned BDO" value={sme.bdo?.name} />
            <DetailItem label="Date of Incorporation" value={sme.dateOfIncorporation ? new Date(sme.dateOfIncorporation).toLocaleDateString() : null} />
            <DetailItem label="Years in Operation" value={sme.yearsInOperation != null ? String(sme.yearsInOperation) : null} />
            <DetailItem label="Bankability / Collateral" value={sme.collateralStatus} />
            <div>
              <dt className="text-xs text-gray-400 font-medium">Follow Up Date</dt>
              <dd className={`mt-0.5 ${overdue ? "text-red-600 font-medium" : "text-gray-800"}`}>
                {sme.followUpDate ? new Date(sme.followUpDate).toLocaleDateString() : "—"}
                {overdue && <span className="ml-1 text-xs">(overdue)</span>}
              </dd>
            </div>
          </dl>

          {/* Revenue */}
          {hasRevenue && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">Revenue by Year</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {revenueYears.map(({ year, value }) => (
                  <div key={year} className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-[11px] text-gray-400">{year}</div>
                    <div className="text-sm font-bold text-gray-800">{value != null ? fmt(value) : "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked deals / grants — pulled automatically, not editable here */}
          {sme.linkedDeals && sme.linkedDeals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">Linked Deals & Grants (auto-pulled)</p>
              <div className="space-y-1.5">
                {sme.linkedDeals.map((d) => (
                  <Link key={`${d.type}-${d.id}`} href={PIPELINE_HREF[d.type]} className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors">
                    <span className="text-sm text-gray-700">{d.type === "TRADELINE" ? "Tradeline" : "Grant / Loan"}</span>
                    <span className="text-xs font-medium text-gray-500">{d.status.replace(/_/g, " ")}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

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

          <DocumentsSection smeId={sme.id} />
          <FollowUpLogSection smeId={sme.id} />
        </div>
      </div>
    </div>
  );
}

// ─── Documents ─────────────────────────────────────────────────────────────────

type ClientDoc = { id: string; fileName: string; fileUrl: string; fileType: string | null; uploadedBy: string | null; createdAt: string };

function DocumentsSection({ smeId }: { smeId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: docs = [] } = useQuery<ClientDoc[]>({
    queryKey: ["client-documents", smeId],
    queryFn: () => fetcher(`/client-documents?smeId=${smeId}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/client-documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-documents", smeId] }),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("smeId", smeId);
    if (user?.email) formData.append("uploadedBy", user.email);
    try {
      await api.post("/client-documents", formData, { headers: { "Content-Type": "multipart/form-data" } });
      qc.invalidateQueries({ queryKey: ["client-documents", smeId] });
    } catch {
      alert("Failed to upload document.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-gray-400">Documents</p>
        <label className="text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer">
          {uploading ? "Uploading…" : "+ Upload"}
          <input type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      </div>
      {docs.length === 0 ? (
        <p className="text-sm text-gray-400">No documents yet — e.g. business registration certificate, financial statements.</p>
      ) : (
        <div className="space-y-1.5">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0 text-sm text-gray-700 hover:text-indigo-700 hover:underline">
                <FileText size={14} className="shrink-0 text-gray-400" />
                <span className="truncate">{d.fileName}</span>
              </a>
              <button
                onClick={() => { if (confirm(`Delete "${d.fileName}"?`)) deleteMutation.mutate(d.id); }}
                className="text-gray-400 hover:text-red-600 shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Follow-up log ─────────────────────────────────────────────────────────────

type ClientNoteT = { id: string; note: string; type: string; authorName: string | null; date: string };

const NOTE_TYPE_OPTS = ["CALL", "VISIT", "MEETING", "EMAIL", "OTHER"] as const;

function FollowUpLogSection({ smeId }: { smeId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [type, setType] = useState<string>("CALL");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const { data: notes = [] } = useQuery<ClientNoteT[]>({
    queryKey: ["client-notes", smeId],
    queryFn: () => fetcher(`/client-notes?smeId=${smeId}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/client-notes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-notes", smeId] }),
  });

  const addNote = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.post("/client-notes", { smeId, note: text, type, date, authorName: user?.bdoName ?? user?.email ?? null });
      setText("");
      qc.invalidateQueries({ queryKey: ["client-notes", smeId] });
    } catch {
      alert("Failed to save follow-up.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 mb-1.5">Follow-Up Log</p>
      <div className="bg-gray-50 rounded-lg p-3 space-y-2 mb-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Log a call, visit, or update…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-white"
        />
        <div className="flex flex-wrap gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            {NOTE_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
          <button
            onClick={addNote}
            disabled={saving || !text.trim()}
            className="ml-auto px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add"}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-gray-400">No follow-ups logged yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="border-l-2 border-indigo-200 pl-3 py-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{n.type}</span>
                  <span className="text-xs text-gray-400">{new Date(n.date).toLocaleDateString()}</span>
                  {n.authorName && <span className="text-xs text-gray-400">· {n.authorName}</span>}
                </div>
                <button onClick={() => { if (confirm("Delete this log entry?")) deleteMutation.mutate(n.id); }} className="text-gray-300 hover:text-red-600 shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
              <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{n.note}</p>
            </div>
          ))}
        </div>
      )}
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

function Field({ label, value, onChange, type = "text", span, min, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; span?: number; min?: number; placeholder?: string }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} min={min} placeholder={placeholder} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
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
