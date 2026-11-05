"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { DataTable } from "@/components/DataTable";
import { PriorityBadge, InvoiceStatusBadge } from "@/components/Badges";
import { WizardShell, useWizard } from "@/app/(app)/leads/components/WizardShell";
import { DEAL_STEPS, DealStatusBadge, DealValueFields, dealMoneyText, dealStatus, dealValueBody, dealValueOf, useNewDealLink, type NewDealLink } from "@/components/deals/dealMoney";
import { ClientSelect, type ClientOption } from "@/components/ClientSelect";
import { AssigneesField } from "@/components/AssigneesField";
import { GHANA_REGIONS } from "@/lib/regions";
import Link from "next/link";
import { X, Sparkles } from "lucide-react";
import { DealPayments } from "@/components/DealPayments";

type BapxDeal = {
  id: string;
  bizId: string | null;
  smeId: string | null;
  dealHealth: string;
  date: string | null;
  businessName: string;
  clientName: string | null;
  holdingFirm: string | null;
  industry: string | null;
  telephone: string | null;
  region: string | null;
  email: string | null;
  bdoId: string | null;
  bdo: { id: string; name: string } | null;
  activityType: string | null;
  keyTopics: string | null;
  callOutcome: string | null;
  product: string | null;
  dealStage: string;
  priority: string;
  invoiceStatus: string | null;
  currency: string | null;
  exchangeRate: number | null;
  nextSteps: string | null;
  nextCallDate: string | null;
  targetGhs: number | null;
  dealValue?: number | null;
  expectedPaymentDate?: string | null;
  revenueReceivedGhs?: number | null;
  balanceGhs?: number | null;
  paymentStatus?: string | null;
  daysSinceLastContact: number | null;
  aiCoachRecommendation: string | null;
  aiCoachGeneratedAt?: string | null;
};

type BdoOption = { id: string; name: string; company: string };

const PRIORITY_OPTS = ["HIGH", "MEDIUM", "LOW"];
const INVOICE_OPTS = ["NOT_INVOICED", "INVOICED", "PAID", "OVERDUE"];

const EMPTY_FORM = {
  smeId: "", businessName: "", clientName: "", holdingFirm: "", industry: "", telephone: "",
  email: "", region: "", date: "", bdoId: "", activityType: "", product: "",
  keyTopics: "", callOutcome: "", nextSteps: "", nextCallDate: "",
  dealValue: "", expectedPaymentDate: "", priority: "MEDIUM",
  invoiceStatus: "NOT_INVOICED", currency: "GHS", exchangeRate: "",
};

export default function BapxPipelinePage() {
  const [filters, setFilters] = useState({ bdo: "", priority: "" });
  const [prefill, setPrefill] = useState<NewDealLink | null>(null);
  useNewDealLink(useCallback((link: NewDealLink) => { setPrefill(link); setEditing(null); setShowForm(true); }, []));
  const [editing, setEditing] = useState<BapxDeal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<BapxDeal | null>(null);
  const qc = useQueryClient();

  const { data: bdos = [] } = useQuery<BdoOption[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
  });
  const bapxBdos = bdos.filter((b) => b.company === "BAPX");

  const { data: smeRes } = useQuery<{ data: ClientOption[] }>({
    queryKey: ["sme-options"],
    queryFn: () => fetcher("/sme"),
  });
  const clients = smeRes?.data ?? [];

  const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
  const { data = [], isLoading } = useQuery<BapxDeal[]>({
    queryKey: ["bapx", filters],
    queryFn: () => fetcher(`/bapx?${params}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bapx/${id}`),
    onSuccess: () => { toast.success("Deal deleted"); qc.invalidateQueries({ queryKey: ["bapx"] }); },
    onError: (err) => toast.failed("Couldn't delete this deal", err),
  });

  const columns = [
    {
      key: "businessName", label: "Business", sortable: true,
      render: (r: BapxDeal) => (
        <button onClick={() => setDetail(r)} className="text-left font-medium text-accent hover:underline truncate max-w-[180px] block">
          {r.businessName}
        </button>
      ),
    },
    { key: "clientName", label: "Client", render: (r: BapxDeal) => r.clientName ?? "—" },
    { key: "bdo", label: "BDO", render: (r: BapxDeal) => r.bdo?.name ?? "—" },
    { key: "industry", label: "Industry", render: (r: BapxDeal) => r.industry ?? "—" },
    { key: "region", label: "Region", render: (r: BapxDeal) => r.region ?? "—" },
    { key: "paymentStatus", label: "Status", render: (r: BapxDeal) => <DealStatusBadge deal={r} /> },
    { key: "priority", label: "Priority", render: (r: BapxDeal) => <PriorityBadge value={r.priority} />, sortable: true },
    { key: "invoiceStatus", label: "Invoice", sortable: true, render: (r: BapxDeal) => <InvoiceStatusBadge value={r.invoiceStatus ?? "NOT_INVOICED"} /> },
    { key: "product", label: "Product", render: (r: BapxDeal) => r.product ?? "—" },
    { key: "dealValue", label: "Deal value", render: (r: BapxDeal) => dealValueOf(r) ? `${r.currency ?? "GHS"} ${Number(dealValueOf(r)).toLocaleString()}` : "—", sortable: true },
    { key: "revenueReceivedGhs", label: "Received", render: (r: BapxDeal) => dealMoneyText(r.revenueReceivedGhs ?? 0, r) },
    { key: "balanceGhs", label: "Balance", render: (r: BapxDeal) => dealStatus(r) === "CANCELLED" ? "—" : dealMoneyText(r.balanceGhs, r) },
    { key: "nextSteps", label: "Next Steps", render: (r: BapxDeal) => <span className="truncate block max-w-[160px]">{r.nextSteps ?? "—"}</span> },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">BAPX deals</h1>
        <p className="text-sm text-gray-500 mt-1">Won work: value, money received and balance</p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        title={`${data.length} deals`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => {
          confirmAction({ title: `Delete the deal for ${row.businessName}?`, body: "This can't be undone.", confirmLabel: "Delete deal" }).then((ok) => { if (ok) deleteMutation.mutate(row.id); });
        }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <FilterSelect value={filters.bdo} options={[{ value: "", label: "All BDOs" }, ...bapxBdos.map((b) => ({ value: b.name, label: b.name }))]} onChange={(v) => setFilters((f) => ({ ...f, bdo: v }))} />
            <FilterSelect value={filters.priority} options={[{ value: "", label: "All Priorities" }, ...PRIORITY_OPTS.map((s) => ({ value: s, label: s }))]} onChange={(v) => setFilters((f) => ({ ...f, priority: v }))} />
          </div>
        }
      />

      {showForm && (
        <DealFormModal
          deal={editing}
          prefill={prefill}
          bdos={bapxBdos}
          clients={clients}
          onClose={() => { setShowForm(false); setPrefill(null); }}
          onSaved={() => { setShowForm(false); setPrefill(null); qc.invalidateQueries({ queryKey: ["bapx"] }); }}
        />
      )}

      {detail && <DetailDrawer deal={detail} onClose={() => setDetail(null)} onEdit={() => { setEditing(detail); setDetail(null); setShowForm(true); }} onChanged={() => { setDetail(null); qc.invalidateQueries({ queryKey: ["bapx"] }); }} />}
    </div>
  );
}

// ─── Filter select ────────────────────────────────────────────────────────────

function FilterSelect({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────

function DealFormModal({ deal, prefill, bdos, clients, onClose, onSaved }: { deal: BapxDeal | null; prefill: NewDealLink | null; bdos: BdoOption[]; clients: ClientOption[]; onClose: () => void; onSaved: () => void }) {
  const dCur = deal?.currency ?? "GHS";
  const dRate = deal?.exchangeRate ?? 1;
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(deal ? {
      smeId: deal.smeId ?? "",
      businessName: deal.businessName,
      clientName: deal.clientName ?? "",
      holdingFirm: deal.holdingFirm ?? "",
      industry: deal.industry ?? "",
      telephone: deal.telephone ?? "",
      email: deal.email ?? "",
      region: deal.region ?? "",
      date: deal.date ? deal.date.slice(0, 10) : "",
      bdoId: deal.bdoId ?? "",
      activityType: deal.activityType ?? "",
      product: deal.product ?? "",
      keyTopics: deal.keyTopics ?? "",
      callOutcome: deal.callOutcome ?? "",
      nextSteps: deal.nextSteps ?? "",
      nextCallDate: deal.nextCallDate ? deal.nextCallDate.slice(0, 10) : "",
      dealValue: dealValueOf(deal),
      expectedPaymentDate: (deal.expectedPaymentDate ?? "").slice(0, 10),
      currency: dCur,
      exchangeRate: dCur === "GHS" ? "" : String(dRate),
      priority: deal.priority,
      invoiceStatus: deal.invoiceStatus ?? "NOT_INVOICED",
    } : {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assigned, setAssigned] = useState<string[]>((deal as { assignedBdoIds?: string[] } | null)?.assignedBdoIds ?? []);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const { step, dir, reached, go, last } = useWizard(DEAL_STEPS.length, deal ? DEAL_STEPS.length - 1 : 0);
  const hasClient = !!form.businessName.trim();

  // Coming from a converted lead: the client and estimated value are filled in.
  useEffect(() => {
    if (!prefill || form.smeId) return;
    const m = clients.find((c) => c.id === prefill.smeId);
    if (m) setForm((f) => ({ ...f, smeId: m.id, businessName: m.companyName, clientName: m.contactName ?? "", email: m.email ?? "", telephone: m.phone ?? "", industry: m.valueChain ?? "", region: m.region ?? "", dealValue: prefill.value || f.dealValue }));
  }, [prefill, clients, form.smeId]);

  const save = async () => {
    if (!deal && !form.smeId) { setError("Please select a client."); return; }
    if (!form.businessName.trim()) { setError("Please select a client."); return; }
    setSaving(true);
    setError("");
    const body = {
      ...form,
      ...dealValueBody(form),
      smeId: form.smeId || null,
      date: form.date || null,
      nextCallDate: form.nextCallDate || null,
      bdoId: form.bdoId || null,
      clientName: form.clientName || null,
      holdingFirm: form.holdingFirm || null,
      industry: form.industry || null,
      telephone: form.telephone || null,
      email: form.email || null,
      region: form.region || null,
      activityType: form.activityType || null,
      product: form.product || null,
      keyTopics: form.keyTopics || null,
      callOutcome: form.callOutcome || null,
      nextSteps: form.nextSteps || null,
      assignedBdoIds: assigned,
    };
    try {
      if (deal) await api.put(`/bapx/${deal.id}`, body);
      else await api.post("/bapx", body);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    industry: match?.valueChain ?? f.industry,
                    region: match?.region ?? f.region,
                  }));
                }}
              />
              <p className="text-[11px] text-muted mt-1">
                Picking a client fills in their details. Don&apos;t see them? <Link href="/sme" className="text-accent hover:underline">Add them on the Clients page first →</Link>
              </p>
          </div>
          <Field label="Client Name" value={form.clientName} onChange={(v) => set("clientName", v)} />
          <Field label="Holding Firm" value={form.holdingFirm} onChange={(v) => set("holdingFirm", v)} />
          <Field label="Industry / Value Chain" value={form.industry} onChange={(v) => set("industry", v)} />
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Region</label>
            <select value={form.region} onChange={(e) => set("region", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
              <option value="">— Select region —</option>
              {form.region && !GHANA_REGIONS.includes(form.region) && <option value={form.region}>{form.region}</option>}
              {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Field label="Telephone" value={form.telephone} onChange={(v) => set("telephone", v)} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
        </div>
      )}
      {step === 1 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Who owns this deal?</label>
              <select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="">— Unassigned —</option>
                {bdos.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <AssigneesField value={assigned} onChange={setAssigned} people={bdos} ownerId={form.bdoId} />
            <Field label="Product / Service" value={form.product} onChange={(v) => set("product", v)} />
            <Field label="Activity Type" value={form.activityType} onChange={(v) => set("activityType", v)} />
            <Field label="Date" type="date" value={form.date} onChange={(v) => set("date", v)} />
            <Field label="Next Call Date" type="date" value={form.nextCallDate} onChange={(v) => set("nextCallDate", v)} />
            <FormSelect label="Priority" value={form.priority} options={PRIORITY_OPTS} onChange={(v) => set("priority", v)} />
          </div>
          <TextArea label="Key Topics" value={form.keyTopics} onChange={(v) => set("keyTopics", v)} rows={2} />
          <TextArea label="Call Outcome / Updates" value={form.callOutcome} onChange={(v) => set("callOutcome", v)} rows={2} />
          <TextArea label="Next Steps" value={form.nextSteps} onChange={(v) => set("nextSteps", v)} rows={2} />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <DealValueFields form={form} set={(k, v) => set(k, v)} inputClass="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" labelClass="text-xs font-medium text-gray-600 block mb-1" />
          <FormSelect label="Invoice Status" value={form.invoiceStatus} options={INVOICE_OPTS} onChange={(v) => set("invoiceStatus", v)} />
        </div>
      )}
    </WizardShell>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ deal, onClose, onEdit, onChanged }: { deal: BapxDeal; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{deal.businessName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{deal.bizId ?? "No Biz ID"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90">Edit</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <DealStatusBadge deal={deal} />
            <PriorityBadge value={deal.priority} />
            <InvoiceStatusBadge value={deal.invoiceStatus ?? "NOT_INVOICED"} />
          </div>

          {/* Key fields */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailItem label="Client" value={deal.clientName} />
            <DetailItem label="Holding Firm" value={deal.holdingFirm} />
            <DetailItem label="Industry" value={deal.industry} />
            <DetailItem label="Region" value={deal.region} />
            <DetailItem label="Telephone" value={deal.telephone} />
            <DetailItem label="Email" value={deal.email} />
            <DetailItem label="BDO" value={deal.bdo?.name} />
            <DetailItem label="Product" value={deal.product} />
            <DetailItem label="Activity Type" value={deal.activityType} />
            <DetailItem label="Deal value" value={dealValueOf(deal) ? `${deal.currency ?? "GHS"} ${Number(dealValueOf(deal)).toLocaleString()}` : null} />
            <DetailItem label="Received" value={dealMoneyText(deal.revenueReceivedGhs ?? 0, deal)} />
            <DetailItem label="Balance" value={dealStatus(deal) === "CANCELLED" ? null : dealMoneyText(deal.balanceGhs, deal)} />
            <DetailItem label="Expected payment" value={deal.expectedPaymentDate ? new Date(deal.expectedPaymentDate).toLocaleDateString() : null} />
            <DetailItem label="Date" value={deal.date ? new Date(deal.date).toLocaleDateString() : null} />
            <DetailItem label="Next Call Date" value={deal.nextCallDate ? new Date(deal.nextCallDate).toLocaleDateString() : null} />
            <DetailItem label="Days Since Contact" value={deal.daysSinceLastContact != null ? String(deal.daysSinceLastContact) : null} />
          </dl>

          {/* Long text fields */}
          {deal.keyTopics && <LongField label="Key Topics" value={deal.keyTopics} />}
          {deal.callOutcome && <LongField label="Call Outcome / Updates" value={deal.callOutcome} />}
          {deal.nextSteps && <LongField label="Next Steps" value={deal.nextSteps} />}
          <DealPayments source="BAPX" dealId={deal.id} company="BAPX" dealName={deal.businessName} cancelled={deal.dealStage === "CLOSED_LOST"} endpoint={`/bapx/${deal.id}`} onChanged={onChanged} />
          <CoachBox deal={deal} />
        </div>
      </div>
    </div>
  );
}

// ─── AI coach ─────────────────────────────────────────────────────────────────
// The recommendation is written by the server from the deal's fields. Older deals may still
// show the text imported from the spreadsheet until it is rewritten (nightly, or here).

function CoachBox({ deal }: { deal: BapxDeal }) {
  const qc = useQueryClient();
  const [coach, setCoach] = useState({ text: deal.aiCoachRecommendation, at: deal.aiCoachGeneratedAt ?? null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const rewrite = async () => {
    setBusy(true); setError("");
    try {
      const { data } = await api.post<{ aiCoachRecommendation: string; aiCoachGeneratedAt: string }>(`/bapx/${deal.id}/coach`);
      setCoach({ text: data.aiCoachRecommendation, at: data.aiCoachGeneratedAt });
      toast.success("New recommendation ready");
      qc.invalidateQueries({ queryKey: ["bapx"] });
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Couldn't write a recommendation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-accent/10 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-accent"><Sparkles size={12} /> AI Coach Recommendation</p>
        <button onClick={rewrite} disabled={busy} className="text-[11px] font-semibold text-accent hover:underline disabled:opacity-50">
          {busy ? "Writing…" : coach.text ? "Rewrite" : "Get a recommendation"}
        </button>
      </div>
      {coach.text
        ? <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{coach.text}</p>
        : <p className="text-sm text-gray-400">No recommendation yet.</p>}
      <p className="text-[11px] text-gray-400 mt-1.5">
        {coach.at ? `Written by the AI coach on ${new Date(coach.at).toLocaleDateString()}` : coach.text ? "Imported from the spreadsheet" : ""}
      </p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text", span }: { label: string; value: string; onChange: (v: string) => void; type?: string; span?: number }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
    </div>
  );
}

function FormSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
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

function LongField({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={accent ? "bg-accent/10 rounded-lg p-3" : ""}>
      <p className={`text-xs font-semibold mb-1.5 ${accent ? "text-accent" : "text-gray-400"}`}>{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}
