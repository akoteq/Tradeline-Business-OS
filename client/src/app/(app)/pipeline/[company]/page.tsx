"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { useCompanies } from "@/lib/companies";
import { DataTable } from "@/components/DataTable";
import { PriorityBadge, InvoiceStatusBadge } from "@/components/Badges";
import { WizardShell, useWizard } from "@/app/(app)/leads/components/WizardShell";
import { DEAL_STEPS, DealStatusBadge, DealValueFields, dealMoneyText, dealStatus, dealValueBody, dealValueOf, useNewDealLink, type NewDealLink } from "@/components/deals/dealMoney";
import { ClientSelect, type ClientOption } from "@/components/ClientSelect";
import { AssigneesField } from "@/components/AssigneesField";
import { GHANA_REGIONS } from "@/lib/regions";
import Link from "next/link";
import { X, Layers, CircleDollarSign, Wallet, TrendingUp } from "lucide-react";
import { DealPayments } from "@/components/DealPayments";

// ─── Types ─────────────────────────────────────────────────────────────────────
// A deal is won work: a lead becomes a client, and the client gets a deal. Sales stages live on
// leads. A deal holds its value, and its status comes from the money the CEO has added.

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
  dealValue?: number | null;
  expectedPaymentDate?: string | null;
  nextSteps?: string | null;
  nextCallDate?: string | null;
  notes?: string | null;
};

type BdoOption = { id: string; name: string; company: string };

const INVOICE_OPTS = ["NOT_INVOICED", "INVOICED", "PAID", "OVERDUE"];

const EMPTY_FORM = {
  smeId: "", businessName: "", clientName: "", email: "", telephone: "", region: "",
  industry: "", valueChain: "", product: "", bdoId: "",
  priority: "MEDIUM", invoiceStatus: "NOT_INVOICED",
  dealValue: "", expectedPaymentDate: "",
  currency: "GHS", exchangeRate: "",
  nextSteps: "", nextCallDate: "", notes: "",
};

const fmt = (n: number | null | undefined) =>
  n != null
    ? n.toLocaleString("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 })
    : "—";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30";
const labelCls = "text-xs font-medium text-muted block mb-1";
const selectCls = "text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30";

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CompanyPipelinePage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = use(params);
  // The company comes from the live list, so any company added in the admin screen gets a
  // pipeline here. Built-ins resolve instantly from the static fallback; added ones once loaded.
  const { bySlug } = useCompanies();
  const co = bySlug[slug];
  const companyKey = co?.key ?? "";
  const label = co?.name ?? "Deals";

  const qc = useQueryClient();
  const [editing, setEditing]           = useState<Deal | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [detail, setDetail]             = useState<Deal | null>(null);
  const [prefill, setPrefill]           = useState<NewDealLink | null>(null);
  useNewDealLink(useCallback((link: NewDealLink) => { setPrefill(link); setEditing(null); setShowForm(true); }, []));

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

  const { data: deals = [], isLoading } = useQuery<Deal[]>({
    queryKey: ["company-deals", companyKey],
    queryFn: () => fetcher(`/company-deals?${qp}`),
    enabled: !!companyKey,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["company-deals", companyKey] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/company-deals/${id}`),
    onSuccess: () => { toast.success("Deal deleted"); invalidate(); },
    onError: (err) => toast.failed("Couldn't delete this deal", err),
  });

  const totalRevenue  = deals.reduce((s, d) => s + (d.revenueReceivedGhs ?? 0), 0);
  const live = deals.filter((d) => d.dealStage !== "CLOSED_LOST");
  const totalValue = live.reduce((s, d) => s + (d.revenuePotentialGhs ?? 0), 0);
  const totalBalance = live.reduce((s, d) => s + (d.balanceGhs ?? 0), 0);

  const columns = [
    {
      key: "businessName", label: "Business", sortable: true,
      render: (r: Deal) => (
        <button onClick={() => setDetail(r)} className="block max-w-[180px] truncate text-left font-semibold text-accent hover:underline">
          {r.businessName}
        </button>
      ),
    },
    { key: "clientName", label: "Client",   render: (r: Deal) => r.clientName ?? "—" },
    { key: "industry",   label: "Industry", render: (r: Deal) => r.industry   ?? "—" },
    { key: "paymentStatus", label: "Status", render: (r: Deal) => <DealStatusBadge deal={r} /> },
    { key: "priority",   label: "Priority", sortable: true, render: (r: Deal) => <PriorityBadge  value={r.priority} /> },
    { key: "dealValue", label: "Deal value", render: (r: Deal) => <span className="tabular-nums text-foreground">{dealValueOf(r) ? `${r.currency ?? "GHS"} ${Number(dealValueOf(r)).toLocaleString()}` : "—"}</span> },
    {
      key: "revenueReceivedGhs", label: "Received",
      render: (r: Deal) => <span className="font-medium tabular-nums text-foreground">{dealMoneyText(r.revenueReceivedGhs ?? 0, r)}</span>,
    },
    {
      key: "balanceGhs", label: "Balance",
      render: (r: Deal) => (
        <span className={`tabular-nums ${r.balanceGhs && r.balanceGhs > 0 ? "font-medium text-accent" : "text-muted"}`}>
          {dealStatus(r) === "CANCELLED" ? "—" : dealMoneyText(r.balanceGhs, r)}
        </span>
      ),
    },
    { key: "invoiceStatus", label: "Invoice", sortable: true, render: (r: Deal) => <InvoiceStatusBadge value={r.invoiceStatus ?? "NOT_INVOICED"} /> },
    { key: "bdo", label: "BDO", render: (r: Deal) => r.bdo?.name ?? "—" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="border-b border-dashed border-border pb-5">
          <h1 className="font-serif text-[1.75rem] leading-[1.15] text-foreground md:text-[2rem]">{label}</h1>
          <p className="mt-1 text-sm text-muted">Deals: won work, money received and balance</p>
        </div>

        {/* Summary KPI row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
          <KpiTile icon={Layers} label="Total deals" value={deals.length} />
          <KpiTile icon={Wallet} label="Deal value" value={fmt(totalValue)} />
          <KpiTile icon={CircleDollarSign} label="Received" value={fmt(totalRevenue)} />
          <KpiTile icon={TrendingUp} label="Balance" value={fmt(totalBalance)} />
        </div>

        <div>
          <DataTable
            columns={columns}
            data={deals}
            isLoading={isLoading}
            title={`${deals.length} deal${deals.length !== 1 ? "s" : ""}`}
            onAdd={() => { setEditing(null); setShowForm(true); }}
            onEdit={(row) => { setEditing(row); setShowForm(true); }}
            onDelete={(row) => {
              confirmAction({ title: `Delete the deal for ${row.businessName}?`, body: "This can't be undone.", confirmLabel: "Delete deal" }).then((ok) => { if (ok) deleteMutation.mutate(row.id); });
            }}
          />
        </div>

        {showForm && (
          <DealFormModal
            deal={editing}
            prefill={prefill}
            companyKey={companyKey}
            bdos={bdos}
            clients={clients}
            onClose={() => { setShowForm(false); setPrefill(null); }}
            onSaved={() => { setShowForm(false); setPrefill(null); invalidate(); }}
          />
        )}

        {detail && (
          <DetailDrawer
            deal={detail}
            onClose={() => setDetail(null)}
            onEdit={() => { setEditing(detail); setDetail(null); setShowForm(true); }}
            onChanged={() => { setDetail(null); invalidate(); }}
          />
        )}
      </div>
    </div>
  );
}

// ─── KPI tile ──────────────────────────────────────────────────────────────────
// Matches the StatTile/MoneyTile pattern from the Company Dashboard page.

function KpiTile({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Icon size={13} strokeWidth={2.25} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">{label}</span>
      </div>
      <div className="mt-2.5 font-serif text-xl leading-none tabular-nums text-foreground md:text-2xl">{value}</div>
    </div>
  );
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────────

function DealFormModal({
  deal, prefill, companyKey, bdos, clients, onClose, onSaved,
}: {
  deal: Deal | null;
  prefill: NewDealLink | null;
  companyKey: string;
  bdos: BdoOption[];
  clients: ClientOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const dCur = deal?.currency ?? "GHS";
  const dRate = deal?.exchangeRate ?? 1;
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
      priority:            deal.priority,
      invoiceStatus:       deal.invoiceStatus       ?? "NOT_INVOICED",
      dealValue:           dealValueOf(deal),
      expectedPaymentDate: (deal.expectedPaymentDate ?? "").slice(0, 10),
      currency:            dCur,
      exchangeRate:        dCur === "GHS" ? "" : String(dRate),
      nextSteps:           deal.nextSteps           ?? "",
      nextCallDate:        deal.nextCallDate        ? deal.nextCallDate.slice(0, 10) : "",
      notes:               deal.notes              ?? "",
    } : {}),
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [assigned, setAssigned] = useState<string[]>((deal as { assignedBdoIds?: string[] } | null)?.assignedBdoIds ?? []);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const { step, dir, reached, go, last } = useWizard(DEAL_STEPS.length, deal ? DEAL_STEPS.length - 1 : 0);
  const hasClient = !!form.businessName.trim();

  // Coming from a converted lead: the client and estimated value are filled in.
  useEffect(() => {
    if (!prefill || form.smeId) return;
    const m = clients.find((c) => c.id === prefill.smeId);
    if (m) setForm((f) => ({ ...f, smeId: m.id, businessName: m.companyName, clientName: m.contactName ?? "", email: m.email ?? "", telephone: m.phone ?? "", valueChain: m.valueChain ?? "", region: m.region ?? "", dealValue: prefill.value || f.dealValue }));
  }, [prefill, clients, form.smeId]);

  const save = async () => {
    if (!deal && !form.smeId) { setError("Please select a client."); return; }
    if (!form.businessName.trim()) { setError("Please select a client."); return; }
    setSaving(true); setError("");
    const body = {
      company: companyKey,
      ...form,
      ...dealValueBody(form),
      smeId:               form.smeId               || null,
      bdoId:               form.bdoId               || null,
      clientName:          form.clientName           || null,
      email:               form.email                || null,
      telephone:           form.telephone            || null,
      region:              form.region               || null,
      industry:            form.industry             || null,
      valueChain:          form.valueChain           || null,
      product:             form.product              || null,
      nextSteps:           form.nextSteps            || null,
      nextCallDate:        form.nextCallDate         || null,
      notes:               form.notes               || null,
      assignedBdoIds:      assigned,
    };
    try {
      deal ? await api.put(`/company-deals/${deal.id}`, body) : await api.post("/company-deals", body);
      toast.success(deal ? "Deal updated" : "Deal added", { description: form.businessName.trim() || undefined });
      onSaved();
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "We couldn't save this deal. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <WizardShell
      steps={DEAL_STEPS} step={step} dir={dir} reached={reached} onGo={go} onClose={onClose} error={error}
      primary={last
        ? { label: saving ? "Saving…" : deal ? "Update deal" : "Add deal", disabled: saving || !hasClient, onClick: save }
        : { label: "Continue", disabled: !hasClient, onClick: () => go(step + 1) }}
    >
      {step === 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
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
              <p className="text-[11px] text-muted mt-1">
                Picking a client fills in their details. Don&apos;t see them? <Link href="/sme" className="text-accent hover:underline">Add them on the Clients page first →</Link>
              </p>
          </div>
          <Field label="Client contact" value={form.clientName} onChange={(v) => set("clientName", v)} />
          <Field label="Industry" value={form.industry} onChange={(v) => set("industry", v)} />
          <Field label="Email" value={form.email} onChange={(v) => set("email", v)} type="email" />
          <Field label="Telephone" value={form.telephone} onChange={(v) => set("telephone", v)} />
          <SelectField label="Region" value={form.region} onChange={(v) => set("region", v)}>
            <option value="">— Select region —</option>
            {form.region && !GHANA_REGIONS.includes(form.region) && <option value={form.region}>{form.region}</option>}
            {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </SelectField>
          <Field label="Value chain" value={form.valueChain} onChange={(v) => set("valueChain", v)} />
        </div>
      )}
      {step === 1 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField label="Who owns this deal?" value={form.bdoId} onChange={(v) => set("bdoId", v)}>
              <option value="">— Unassigned —</option>
              {bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}
            </SelectField>
            <AssigneesField value={assigned} onChange={setAssigned} people={bdos.filter((b) => b.company === companyKey)} ownerId={form.bdoId} />
            <Field label="Product" value={form.product} onChange={(v) => set("product", v)} />
            <SelectField label="Priority" value={form.priority} onChange={(v) => set("priority", v)}>
              {["HIGH", "MEDIUM", "LOW"].map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectField>
            <Field label="Next call date" value={form.nextCallDate} onChange={(v) => set("nextCallDate", v)} type="date" />
          </div>
          <div>
            <label className={labelCls}>Next steps</label>
            <textarea value={form.nextSteps} onChange={(e) => set("nextSteps", e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <DealValueFields form={form} set={(k, v) => set(k, v)} inputClass={inputCls} labelClass={labelCls} />
          <SelectField label="Invoice status" value={form.invoiceStatus} onChange={(v) => set("invoiceStatus", v)}>
            {INVOICE_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </SelectField>
        </div>
      )}
    </WizardShell>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ deal, onClose, onEdit, onChanged }: { deal: Deal; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-serif text-lg text-foreground">{deal.businessName}</h2>
            <p className="mt-0.5 text-xs text-muted">{deal.clientName ?? "No client name"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90">Edit</button>
            <button onClick={onClose} className="text-muted hover:text-foreground"><X size={18} /></button>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <DealStatusBadge deal={deal} />
            <PriorityBadge   value={deal.priority} />
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <DItem label="Email"            value={deal.email} />
            <DItem label="Telephone"        value={deal.telephone} />
            <DItem label="Region"           value={deal.region} />
            <DItem label="Industry"         value={deal.industry} />
            <DItem label="BDO"              value={deal.bdo?.name} />
            <DItem label="Invoice status"   value={deal.invoiceStatus ? deal.invoiceStatus.replace(/_/g, " ") : null} />
            <DItem label="Deal value"       value={dealValueOf(deal) ? `${deal.currency ?? "GHS"} ${Number(dealValueOf(deal)).toLocaleString()}` : null} />
            <DItem label="Received"         value={dealMoneyText(deal.revenueReceivedGhs ?? 0, deal)} />
            <DItem label="Balance"          value={dealStatus(deal) === "CANCELLED" ? null : dealMoneyText(deal.balanceGhs, deal)} />
            <DItem label="Expected payment" value={deal.expectedPaymentDate ? new Date(deal.expectedPaymentDate).toLocaleDateString() : null} />
            <DItem label="Next call"        value={deal.nextCallDate ? new Date(deal.nextCallDate).toLocaleDateString() : null} />
          </dl>
          <DealPayments source="COMPANY" dealId={deal.id} company={deal.company} dealName={deal.businessName} cancelled={deal.dealStage === "CLOSED_LOST"} endpoint={`/company-deals/${deal.id}`} onChanged={onChanged} />
          {deal.nextSteps && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">Next steps</p>
              <p className="rounded-lg bg-background p-3 text-sm text-foreground">{deal.nextSteps}</p>
            </div>
          )}
          {deal.notes && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">Notes</p>
              <p className="whitespace-pre-wrap rounded-lg bg-background p-3 text-sm text-foreground">{deal.notes}</p>
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
      <label className={labelCls}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </div>
  );
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {children}
      </select>
    </div>
  );
}

function DItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value ?? "—"}</dd>
    </div>
  );
}