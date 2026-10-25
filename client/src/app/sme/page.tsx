"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { DataTable } from "@/components/DataTable";
import { useAuth } from "@/components/AuthProvider";
import { GHANA_REGIONS } from "@/lib/regions";
import { useCompanies, companyBadgeClass } from "@/lib/companies";
import { accessLevel } from "@/lib/auth";
import { EngagementSection, ClientComplianceSection, ClientContactsSection } from "@/components/ClientModules";
import Link from "next/link";
import { AddClientSheet } from "./components/AddClientSheet";
import { REVENUE_YEARS, STATUS_OPTS, TIER_OPTS, type BdoOption, type LinkedDeal, type SME } from "./components/lib";
import { X, FileText, Trash2, Share2 } from "lucide-react";

const PAGE_SIZE = 100;

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

function fmt(n: number) {
  return `GHS ${n.toLocaleString()}`;
}

const CORE_CHECKS = 7;
const COMPLETENESS_CHECKS: [string, (s: SME) => boolean][] = [
  ["Contact Person", (s) => !!s.contactName],
  ["Phone", (s) => !!s.phone],
  ["Email", (s) => !!s.email],
  ["Location", (s) => !!(s.region || s.district || s.address)],
  ["Value Chain", (s) => !!s.valueChain],
  ["Date of Incorporation", (s) => !!s.dateOfIncorporation],
  ["Years in Operation", (s) => s.yearsInOperation != null],
  ["Assigned BDO", (s) => !!s.bdoId],
  ["Revenue Data", (s) => [s.revenueGhs2023, s.revenueGhs2024, s.revenueGhs2025, s.revenueGhs2026].some((v) => v != null)],
  ["Bankability Assessed", (s) => s.bankabilityTier !== "UNSCORED"],
  ["Collateral Status", (s) => !!s.collateralStatus],
];

// Tradeline's financing fields only count for viewers who can see them.
function completeness(sme: SME) {
  const checks = "bankabilityTier" in sme ? COMPLETENESS_CHECKS : COMPLETENESS_CHECKS.slice(0, CORE_CHECKS);
  const missing = checks.filter(([, check]) => !check(sme)).map(([label]) => label);
  const percent = Math.round(((checks.length - missing.length) / checks.length) * 100);
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
  const { user } = useAuth();
  const { companies, byKey } = useCompanies();
  const tradelineKey = companies.find((c) => c.dealSource === "TRADELINE")?.key;
  // Tradeline's financing fields and deal links are Tradeline's own (decided 2026-10-14).
  const tradelineView = !!user && (accessLevel(user.role) === "GROUP_OWNER" || user.bdoCompany === tradelineKey);
  const [mine, setMine] = useState(false);

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
    ...(mine ? { mine: "1" } : {}),
    limit: String(PAGE_SIZE),
    skip: String(page * PAGE_SIZE),
  });

  const { data: res, isLoading } = useQuery<{ data: SME[]; total: number }>({
    queryKey: ["sme", filters, page, mine],
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
    onSuccess: () => { toast.success("Client deleted"); qc.invalidateQueries({ queryKey: ["sme"] }); },
    onError: (err) => toast.failed("Couldn't delete this client", err),
  });

  const columns = [
    {
      key: "companyName", label: "Company", sortable: true,
      render: (r: SME) => (
        <button onClick={() => setDetailId(r.id)} className="text-left font-medium text-accent hover:underline truncate max-w-[180px] block">
          {r.companyName}
        </button>
      ),
    },
    { key: "contactName", label: "Contact", render: (r: SME) => r.contactName ?? "—" },
    { key: "phone", label: "Phone", render: (r: SME) => r.phone ?? "—" },
    { key: "valueChain", label: "Value Chain", sortable: true, render: (r: SME) => r.valueChain ?? "—" },
    { key: "region", label: "Region", sortable: true, render: (r: SME) => r.region ?? "—" },
    { key: "bdo", label: "Owner", render: (r: SME) => r.bdo?.name ?? "—" },
    {
      key: "servedBy", label: "Served by",
      render: (r: SME) => (r.servedBy?.length ? (
        <div className="flex flex-wrap gap-1">
          {r.servedBy.map((k) => <span key={k} className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${companyBadgeClass(byKey[k]?.color)}`}>{byKey[k]?.name ?? k}</span>)}
        </div>
      ) : <span className="text-xs text-gray-400">—</span>),
      exportValue: (r: SME) => (r.servedBy ?? []).map((k) => byKey[k]?.name ?? k).join(", "),
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (r: SME) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-500"}`}>
          {r.status.replace(/_/g, " ")}
        </span>
      ),
    },
    ...(tradelineView ? [{
      key: "bankabilityTier", label: "Bankability", sortable: true,
      render: (r: SME) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[r.bankabilityTier ?? "UNSCORED"] ?? "bg-gray-100 text-gray-500"}`}>
          {(r.bankabilityTier ?? "UNSCORED").replace("_", " ")}
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
    }] : []),
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
          {total.toLocaleString()} clients across the group. Everyone can find any client and start a deal for them; each company&apos;s own details stay private to it.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={smes}
        isLoading={isLoading}
        title={`${total.toLocaleString()} clients`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => confirmAction({ title: `Delete ${row.companyName}?`, body: "The client is removed for everyone. This can't be undone.", confirmLabel: "Delete client" }).then((ok) => { if (ok) deleteMutation.mutate(row.id); })}
        canEditRow={(row) => row.canEdit !== false}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <FilterSelect value={filters.status} options={[{ value: "", label: "All Statuses" }, ...STATUS_OPTS.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(v) => setFilter("status", v)} />
            {tradelineView && <FilterSelect value={filters.tier} options={[{ value: "", label: "All Tiers" }, ...TIER_OPTS.map((t) => ({ value: t, label: t.replace("_", " ") }))]} onChange={(v) => setFilter("tier", v)} />}
            <label className="flex items-center gap-1.5 text-sm text-gray-600 px-1"><input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(0); }} /> Only mine</label>
            <FilterSelect value={filters.bdo} options={[{ value: "", label: "All BDOs" }, ...bdos.map((b) => ({ value: b.name, label: b.name }))]} onChange={(v) => setFilter("bdo", v)} />
            <input value={filters.valueChain} onChange={(e) => setFilter("valueChain", e.target.value)} placeholder="Value chain…" className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-32" />
            <FilterSelect value={filters.region} options={[{ value: "", label: "All Regions" }, ...GHANA_REGIONS.map((r) => ({ value: r, label: r }))]} onChange={(v) => setFilter("region", v)} />
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
        <AddClientSheet
          sme={editing}
          bdos={bdos}
          tradelineView={tradelineView}
          onOpenExisting={(id) => { setShowForm(false); setDetailId(id); }}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["sme"] }); qc.invalidateQueries({ queryKey: ["sme-detail"] }); }}
        />
      )}

      {detailId && detail && (
        <DetailDrawer
          sme={detail}
          serving={(detail.servedBy ?? []).map((k) => byKey[k]?.name ?? k)}
          onClose={() => setDetailId(null)}
          onEdit={() => { setEditing(detail); setDetailId(null); setShowForm(true); }}
        />
      )}
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

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ sme, serving, onClose, onEdit }: { sme: SME; serving: string[]; onClose: () => void; onEdit: () => void }) {
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
            {sme.canEdit !== false && <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90">Edit</button>}
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
            {sme.bankabilityTier && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[sme.bankabilityTier] ?? "bg-gray-100 text-gray-500"}`}>
                {sme.bankabilityTier.replace("_", " ")}
              </span>
            )}
            {serving.map((n) => <span key={n} className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">Served by {n}</span>)}
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
            {"bankabilityTier" in sme && <DetailItem label="Bankability / Collateral" value={sme.collateralStatus} />}
            <DetailItem label="Activities" value={sme.activities?.length ? sme.activities.join(", ") : null} />
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

          <EngagementSection smeId={sme.id} />
          <ClientComplianceSection smeId={sme.id} clientName={sme.companyName} />
          <ClientContactsSection smeId={sme.id} />

          {sme.fullAccess === false ? (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
              Notes and documents for this client show once your company works with them. Start a deal for them in your pipeline to begin.
            </p>
          ) : (
            <>
              <DocumentsSection smeId={sme.id} />
              <FollowUpLogSection smeId={sme.id} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Documents ─────────────────────────────────────────────────────────────────

type ClientDoc = { id: string; fileName: string; fileUrl: string; fileType: string | null; uploadedBy: string | null; createdAt: string; company: string | null; sharedWithGroup?: boolean; category?: string | null };

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
    onSuccess: () => { toast.success("Document deleted"); qc.invalidateQueries({ queryKey: ["client-documents", smeId] }); },
    onError: (err) => toast.failed("Couldn't delete the document", err),
  });
  const shareMutation = useMutation({
    mutationFn: (d: ClientDoc) => api.put(`/client-documents/${d.id}`, { sharedWithGroup: !d.sharedWithGroup }),
    onSuccess: (_res, d) => {
      toast.success(d.sharedWithGroup ? "Now private to your company" : "Shared with the group", { description: d.fileName });
      qc.invalidateQueries({ queryKey: ["client-documents", smeId] });
    },
    onError: (e: unknown) => toast.failed("Couldn't change sharing", e),
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
      toast.success("Document uploaded", { description: file.name });
      qc.invalidateQueries({ queryKey: ["client-documents", smeId] });
    } catch (err) {
      toast.failed("Couldn't upload the document", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-gray-400">Documents</p>
        <label className="text-xs font-medium text-accent hover:text-accent/80 cursor-pointer">
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
              <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0 text-sm text-gray-700 hover:text-accent hover:underline">
                <FileText size={14} className="shrink-0 text-gray-400" />
                <span className="truncate">{d.fileName}</span>
              </a>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => shareMutation.mutate(d)}
                  title={d.sharedWithGroup ? "Shared with the other companies serving this client — click to make private" : "Only your company sees this — click to share with the group"}
                  className={`flex items-center gap-1 text-[11px] ${d.sharedWithGroup ? "text-accent" : "text-gray-400 hover:text-accent"}`}
                >
                  <Share2 size={12} /> {d.sharedWithGroup ? "Shared" : "Private"}
                </button>
                <button
                  onClick={() => confirmAction({ title: `Delete ${d.fileName}?`, body: "This can't be undone.", confirmLabel: "Delete document" }).then((ok) => { if (ok) deleteMutation.mutate(d.id); })}
                  className="text-gray-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
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
    onSuccess: () => { toast.success("Follow-up deleted"); qc.invalidateQueries({ queryKey: ["client-notes", smeId] }); },
    onError: (err) => toast.failed("Couldn't delete the follow-up", err),
  });

  const addNote = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.post("/client-notes", { smeId, note: text, type, date, authorName: user?.bdoName ?? user?.email ?? null });
      setText("");
      toast.success("Follow-up saved");
      qc.invalidateQueries({ queryKey: ["client-notes", smeId] });
    } catch (err) {
      toast.failed("Couldn't save the follow-up", err);
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
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none bg-white"
        />
        <div className="flex flex-wrap gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            {NOTE_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
          <button
            onClick={addNote}
            disabled={saving || !text.trim()}
            className="ml-auto px-3 py-1.5 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
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
            <div key={n.id} className="border-l-2 border-accent/30 pl-3 py-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">{n.type}</span>
                  <span className="text-xs text-gray-400">{new Date(n.date).toLocaleDateString()}</span>
                  {n.authorName && <span className="text-xs text-gray-400">· {n.authorName}</span>}
                </div>
                <button onClick={() => confirmAction({ title: "Delete this follow-up?", body: "This can't be undone.", confirmLabel: "Delete" }).then((ok) => { if (ok) deleteMutation.mutate(n.id); })} className="text-gray-300 hover:text-red-600 shrink-0">
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

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 font-medium">{label}</dt>
      <dd className="text-gray-800 mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}
