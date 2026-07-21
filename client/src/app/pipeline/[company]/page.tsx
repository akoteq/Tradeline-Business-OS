"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { DataTable } from "@/components/DataTable";
import { DealHealthBadge, DealStageBadge, PriorityBadge, InvoiceStatusBadge } from "@/components/Badges";
import { ClientSelect, type ClientOption } from "@/components/ClientSelect";
import { GHANA_REGIONS } from "@/lib/regions";
import Link from "next/link";
import { X } from "lucide-react";

// ─── Config per company ────────────────────────────────────────────────────────

const COMPANY_META: Record<string, { label: string; color: string }> = {
  ALPHA_AFRICA:      { label: "Alpha Africa Consult Ltd",  color: "indigo" },
  FINANCE_FACTORY:   { label: "Finance Factory Limited",   color: "emerald" },
  COMMUNITY_FINANCE: { label: "Community Finance Ltd",     color: "sky" },
  AKOTEQ:            { label: "Akoteq Ltd",                color: "violet" },
};

const SLUG_TO_KEY: Record<string, string> = {
  "alpha-africa":      "ALPHA_AFRICA",
  "finance-factory":   "FINANCE_FACTORY",
  "community-finance": "COMMUNITY_FINANCE",
  "akoteq":            "AKOTEQ",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

type Deal = {
  id: string;
  company: string;
  smeId?: string | null;
  businessName: string;
  clientName?: string | null;
  email?: string | null;
  telephone?: string | null;
  region?: string | null;
  industry?: string | null;
  valueChain?: string | null;
  product?: string | null;
  bdoId?: string | null;
  bdo?: { id: string; name: string } | null;
  dealStage: string;
  dealHealth: string;
  priority: string;
  paymentStatus?: string | null;
  invoiceStatus?: string | null;
  revenuePotentialGhs?: number | null;
  revenueReceivedGhs?: number | null;
  balanceGhs?: number | null;
  currency?: string | null;
  exchangeRate?: number | null;
  nextSteps?: string | null;
  nextCallDate?: string | null;
  notes?: string | null;
};

type BdoOption = { id: string; name: string; company: string };

const STAGE_OPTS  = ["QUALIFICATION", "DISCOVERY", "PROPOSAL_SENT", "NEGOTIATION", "CONTRACT_REVIEW", "CLOSED_WON", "CLOSED_LOST", "ON_HOLD"];
const HEALTH_OPTS = ["ACTIVE", "STALE", "AT_RISK", "CLOSED_WON", "CLOSED_LOST"];
const PAY_OPTS    = ["PAID", "UNPAID", "PARTIAL", "OVERDUE"];
const INVOICE_OPTS = ["NOT_INVOICED", "INVOICED", "PAID", "OVERDUE"];
const CURRENCIES = ["GHS", "USD", "EUR", "NGN", "RWF"];

const EMPTY_FORM = {
  smeId: "", businessName: "", clientName: "", email: "", telephone: "", region: "",
  industry: "", valueChain: "", product: "", bdoId: "",
  dealStage: "QUALIFICATION", dealHealth: "ACTIVE", priority: "MEDIUM",
  paymentStatus: "UNPAID", invoiceStatus: "NOT_INVOICED",
  revenuePotentialGhs: "", revenueReceivedGhs: "", balanceGhs: "",
  currency: "GHS", exchangeRate: "",
  nextSteps: "", nextCallDate: "", notes: "",
};

const fmt = (n: number | null | undefined) =>
  n != null
    ? n.toLocaleString("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 })
    : "—";

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CompanyPipelinePage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = use(params);
  const { bySlug } = useCompanies();
  const co = bySlug[slug];
  const companyKey = co?.key ?? SLUG_TO_KEY[slug] ?? slug.toUpperCase();
  const label = co?.name ?? COMPANY_META[companyKey]?.label ?? companyKey;

  const qc = useQueryClient();
  const [filterStage, setFilterStage]   = useState("");
  const [filterHealth, setFilterHealth] = useState("");
  const [editing, setEditing]           = useState<Deal | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [detail, setDetail]             = useState<Deal | null>(null);

  const { data: bdos = [] } = useQuery<BdoOption[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
  });

  const { data: smeRes } = useQuery<{ data: ClientOption[] }>({
    queryKey: ["sme-options"],
    queryFn: () => fetcher("/sme"),
  });
  const clients = smeRes?.data ?? [];

  const qp = new URLSearchParams({ company: companyKey });
  if (filterStage)  qp.set("stage",  filterStage);
  if (filterHealth) qp.set("health", filterHealth);

  const { data: deals = [], isLoading } = useQuery<Deal[]>({
    queryKey: ["company-deals", companyKey, filterStage, filterHealth],
    queryFn: () => fetcher(`/company-deals?${qp}`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["company-deals", companyKey] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/company-deals/${id}`),
    onSuccess: invalidate,
  });

  const totalRevenue  = deals.reduce((s, d) => s + (d.revenueReceivedGhs ?? 0), 0);
  const totalPotential = deals.reduce((s, d) => s + (d.revenuePotentialGhs ?? 0), 0);

  const columns = [
    {
      key: "businessName", label: "Business", sortable: true,
      render: (r: Deal) => (
        <button onClick={() => setDetail(r)} className="text-left font-semibold text-indigo-700 hover:underline truncate max-w-[180px] block">
          {r.businessName}
        </button>
      ),
    },
    { key: "clientName", label: "Client",   render: (r: Deal) => r.clientName ?? "—" },
    { key: "industry",   label: "Industry", render: (r: Deal) => r.industry   ?? "—" },
    { key: "dealStage",  label: "Stage",    sortable: true, render: (r: Deal) => <DealStageBadge  value={r.dealStage} /> },
    { key: "dealHealth", label: "Health",   sortable: true, render: (r: Deal) => <DealHealthBadge value={r.dealHealth} /> },
    { key: "priority",   label: "Priority", sortable: true, render: (r: Deal) => <PriorityBadge  value={r.priority} /> },
    {
      key: "revenueReceivedGhs", label: "Received",
      render: (r: Deal) => <span className="font-medium text-green-700">{fmt(r.revenueReceivedGhs)}</span>,
    },
    {
      key: "balanceGhs", label: "Balance",
      render: (r: Deal) => <span className={r.balanceGhs && r.balanceGhs > 0 ? "text-red-600" : "text-gray-500"}>{fmt(r.balanceGhs)}</span>,
    },
    { key: "invoiceStatus", label: "Invoice", sortable: true, render: (r: Deal) => <InvoiceStatusBadge value={r.invoiceStatus ?? "NOT_INVOICED"} /> },
    { key: "bdo", label: "BDO", render: (r: Deal) => r.bdo?.name ?? "—" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{label}</h1>
        <p className="text-sm text-gray-500 mt-1">Deal pipeline</p>
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile label="Total Deals"      value={deals.length} />
        <KpiTile label="Revenue Received" value={fmt(totalRevenue)} />
        <KpiTile label="Revenue Potential" value={fmt(totalPotential)} />
        <KpiTile label="Active"           value={deals.filter((d) => d.dealHealth === "ACTIVE").length} />
      </div>

      <DataTable
        columns={columns}
        data={deals}
        isLoading={isLoading}
        title={`${deals.length} deal${deals.length !== 1 ? "s" : ""}`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => {
          if (confirm(`Delete deal "${row.businessName}"?`)) deleteMutation.mutate(row.id);
        }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <select value={filterStage}  onChange={(e) => setFilterStage(e.target.value)}  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="">All Stages</option>
              {STAGE_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <select value={filterHealth} onChange={(e) => setFilterHealth(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="">All Health</option>
              {HEALTH_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
        }
      />

      {showForm && (
        <DealFormModal
          deal={editing}
          companyKey={companyKey}
          bdos={bdos}
          clients={clients}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); invalidate(); }}
        />
      )}

      {detail && (
        <DetailDrawer
          deal={detail}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); setShowForm(true); }}
        />
      )}
    </div>
  );
}

// ─── KPI tile ──────────────────────────────────────────────────────────────────

function KpiTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────────

function DealFormModal({
  deal, companyKey, bdos, clients, onClose, onSaved,
}: {
  deal: Deal | null;
  companyKey: string;
  bdos: BdoOption[];
  clients: ClientOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // Round-trip: stored amounts are GHS; if the deal was entered in another currency,
  // show the original-currency values in the form (GHS ÷ rate).
  const dCur = deal?.currency ?? "GHS";
  const dRate = deal?.exchangeRate ?? 1;
  const disp = (ghs: number | null | undefined) =>
    ghs == null ? "" : String(dCur === "GHS" || !dRate ? ghs : Math.round((ghs / dRate) * 100) / 100);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(deal ? {
      smeId:               deal.smeId               ?? "",
      businessName:        deal.businessName,
      clientName:          deal.clientName          ?? "",
      email:               deal.email               ?? "",
      telephone:           deal.telephone           ?? "",
      region:              deal.region              ?? "",
      industry:            deal.industry            ?? "",
      valueChain:          deal.valueChain          ?? "",
      product:             deal.product             ?? "",
      bdoId:               deal.bdoId               ?? "",
      dealStage:           deal.dealStage,
      dealHealth:          deal.dealHealth,
      priority:            deal.priority,
      paymentStatus:       deal.paymentStatus       ?? "UNPAID",
      invoiceStatus:       deal.invoiceStatus       ?? "NOT_INVOICED",
      revenuePotentialGhs: disp(deal.revenuePotentialGhs),
      revenueReceivedGhs:  disp(deal.revenueReceivedGhs),
      balanceGhs:          disp(deal.balanceGhs),
      currency:            dCur,
      exchangeRate:        dCur === "GHS" ? "" : String(dRate),
      nextSteps:           deal.nextSteps           ?? "",
      nextCallDate:        deal.nextCallDate        ? deal.nextCallDate.slice(0, 10) : "",
      notes:               deal.notes              ?? "",
    } : {}),
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!deal && !form.smeId) { setError("Please select a client."); return; }
    if (!form.businessName.trim()) { setError("Please select a client."); return; }
    setSaving(true); setError("");
    // Convert entered amounts to GHS (the stored / reporting currency).
    const rate = form.currency === "GHS" ? 1 : (Number(form.exchangeRate) || 1);
    const toGhs = (v: string) => (v ? Number(v) * rate : null);
    const body = {
      company: companyKey,
      ...form,
      smeId:               form.smeId               || null,
      bdoId:               form.bdoId               || null,
      clientName:          form.clientName           || null,
      email:               form.email                || null,
      telephone:           form.telephone            || null,
      region:              form.region               || null,
      industry:            form.industry             || null,
      valueChain:          form.valueChain           || null,
      product:             form.product              || null,
      exchangeRate:        rate,
      revenuePotentialGhs: toGhs(form.revenuePotentialGhs),
      revenueReceivedGhs:  toGhs(form.revenueReceivedGhs),
      balanceGhs:          toGhs(form.balanceGhs),
      nextSteps:           form.nextSteps            || null,
      nextCallDate:        form.nextCallDate         || null,
      notes:               form.notes               || null,
    };
    try {
      deal ? await api.put(`/company-deals/${deal.id}`, body) : await api.post("/company-deals", body);
      onSaved();
    } catch {
      setError("Failed to save. Check the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-gray-900">{deal ? "Edit Deal" : "Add Deal"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <ClientSelect
                label="Client *"
                value={form.smeId}
                options={clients}
                fallbackLabel={form.businessName || undefined}
                onChange={(id) => {
                  const match = clients.find((c) => c.id === id);
                  setForm((f) => ({
                    ...f,
                    smeId: id,
                    businessName: match?.companyName ?? "",
                    clientName: match?.contactName ?? f.clientName,
                    email: match?.email ?? f.email,
                    telephone: match?.phone ?? f.telephone,
                    valueChain: match?.valueChain ?? f.valueChain,
                    region: match?.region ?? f.region,
                  }));
                }}
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Picking a client fills in their details. Don&apos;t see them? <Link href="/sme" className="text-indigo-600 hover:underline">Add in Client Overview first →</Link>
              </p>
            </div>
            <Field label="Client Contact"  value={form.clientName}   onChange={(v) => set("clientName", v)} />
            <Field label="Industry"        value={form.industry}     onChange={(v) => set("industry", v)} />
            <Field label="Email"           value={form.email}        onChange={(v) => set("email", v)} type="email" />
            <Field label="Telephone"       value={form.telephone}    onChange={(v) => set("telephone", v)} />
            <SelectField label="Region" value={form.region} onChange={(v) => set("region", v)}>
              <option value="">— Select region —</option>
              {form.region && !GHANA_REGIONS.includes(form.region) && <option value={form.region}>{form.region}</option>}
              {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </SelectField>
            <Field label="Value Chain"     value={form.valueChain}   onChange={(v) => set("valueChain", v)} />
            <Field label="Product"         value={form.product}      onChange={(v) => set("product", v)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField label="Assigned BDO" value={form.bdoId} onChange={(v) => set("bdoId", v)}>
              <option value="">— Unassigned —</option>
              {bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}
            </SelectField>
            <SelectField label="Deal Stage"     value={form.dealStage}     onChange={(v) => set("dealStage", v)}>
              {STAGE_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </SelectField>
            <SelectField label="Deal Health"    value={form.dealHealth}    onChange={(v) => set("dealHealth", v)}>
              {HEALTH_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </SelectField>
            <SelectField label="Priority"       value={form.priority}      onChange={(v) => set("priority", v)}>
              {["HIGH", "MEDIUM", "LOW"].map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectField>
            <SelectField label="Payment Status" value={form.paymentStatus} onChange={(v) => set("paymentStatus", v)}>
              {PAY_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectField>
            <SelectField label="Invoice Status" value={form.invoiceStatus} onChange={(v) => set("invoiceStatus", v)}>
              {INVOICE_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </SelectField>
            <Field label="Next Call Date" value={form.nextCallDate} onChange={(v) => set("nextCallDate", v)} type="date" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField label="Currency" value={form.currency} onChange={(v) => set("currency", v)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectField>
            {form.currency !== "GHS" && (
              <Field label={`Exchange rate (1 ${form.currency} = ? GHS)`} value={form.exchangeRate} onChange={(v) => set("exchangeRate", v)} type="number" />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label={`Revenue Potential (${form.currency})`} value={form.revenuePotentialGhs} onChange={(v) => set("revenuePotentialGhs", v)} type="number" />
            <Field label={`Revenue Received (${form.currency})`}  value={form.revenueReceivedGhs}  onChange={(v) => set("revenueReceivedGhs", v)}  type="number" />
            <Field label={`Balance (${form.currency})`}           value={form.balanceGhs}          onChange={(v) => set("balanceGhs", v)}          type="number" />
          </div>
          {form.currency !== "GHS" && form.exchangeRate && (
            <p className="text-[11px] text-gray-400">Entered in {form.currency}, stored as GHS at 1 {form.currency} = {form.exchangeRate} GHS.</p>
          )}

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Next Steps</label>
            <textarea value={form.nextSteps} onChange={(e) => set("nextSteps", e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : deal ? "Update Deal" : "Add Deal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ deal, onClose, onEdit }: { deal: Deal; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{deal.businessName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{deal.clientName ?? "No client name"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Edit</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <DealStageBadge  value={deal.dealStage} />
            <DealHealthBadge value={deal.dealHealth} />
            <PriorityBadge   value={deal.priority} />
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DItem label="Email"            value={deal.email} />
            <DItem label="Telephone"        value={deal.telephone} />
            <DItem label="Region"           value={deal.region} />
            <DItem label="Industry"         value={deal.industry} />
            <DItem label="BDO"              value={deal.bdo?.name} />
            <DItem label="Payment Status"   value={deal.paymentStatus} />
            <DItem label="Invoice Status"   value={deal.invoiceStatus ? deal.invoiceStatus.replace(/_/g, " ") : null} />
            <DItem label="Entered In"       value={deal.currency && deal.currency !== "GHS" ? `${deal.currency} @ ${deal.exchangeRate} GHS` : "GHS"} />
            <DItem label="Revenue Received" value={fmt(deal.revenueReceivedGhs)} />
            <DItem label="Balance"          value={fmt(deal.balanceGhs)} />
            <DItem label="Next Call"        value={deal.nextCallDate ? new Date(deal.nextCallDate).toLocaleDateString() : null} />
          </dl>
          {deal.nextSteps && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Next Steps</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{deal.nextSteps}</p>
            </div>
          )}
          {deal.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{deal.notes}</p>
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

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
        {children}
      </select>
    </div>
  );
}

function DItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 font-medium">{label}</dt>
      <dd className="text-gray-800 mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}
