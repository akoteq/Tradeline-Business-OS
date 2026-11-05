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
import { useAuth } from "@/components/AuthProvider";
import { isStaff } from "@/lib/auth";
import { ClientSelect, type ClientOption } from "@/components/ClientSelect";
import { AssigneesField } from "@/components/AssigneesField";
import Link from "next/link";
import { X } from "lucide-react";
import { DealPayments } from "@/components/DealPayments";

type TradelineDeal = {
  id: string;
  bizId: string | null;
  serialNo: number | null;
  businessName: string;
  smeId: string | null;
  valueChain: string | null;
  bdoId: string | null;
  bdo: { id: string; name: string } | null;
  tier: string;
  email: string | null;
  telephone: string | null;
  currentStatus: string | null;
  nextAction: string | null;
  revenuePotentialGhs: number | null;
  dueDate: string | null;
  expectedRevenueReceivedGhs: number | null;
  revenueReceivedGhs: number | null;
  balanceGhs: number | null;
  paymentStatus: string;
  invoiceStatus: string;
  currency: string | null;
  exchangeRate: number | null;
  dealStage: string;
  priority: string;
  dealHealth: string;
  dealValue?: number | null;
  expectedPaymentDate?: string | null;
};

type BdoOption = { id: string; name: string; company: string };

const TIER_OPTS = ["TIER_1", "TIER_2", "TIER_3"];
const PRIORITY_OPTS = ["HIGH", "MEDIUM", "LOW"];
const INVOICE_OPTS = ["NOT_INVOICED", "INVOICED", "PAID", "OVERDUE"];

const EMPTY_FORM = {
  businessName: "", smeId: "", valueChain: "", email: "", telephone: "",
  currentStatus: "", nextAction: "",
  bdoId: "",
  dealValue: "", expectedPaymentDate: "",
  tier: "TIER_1",
  priority: "MEDIUM", invoiceStatus: "NOT_INVOICED",
  currency: "GHS", exchangeRate: "",
};

const fmt = (n: number) => n.toLocaleString();

export default function TradelinePipelinePage() {
  const { user } = useAuth();
  const isBdoRole = isStaff(user);
  const [filters, setFilters] = useState({ bdo: "", tier: "", priority: "" });
  const [prefill, setPrefill] = useState<NewDealLink | null>(null);
  useNewDealLink(useCallback((link: NewDealLink) => { setPrefill(link); setEditing(null); setShowForm(true); }, []));
  const [editing, setEditing] = useState<TradelineDeal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<TradelineDeal | null>(null);
  const qc = useQueryClient();

  // Scope to the logged-in BDO's own deals; otherwise pick up a ?bdo= link from elsewhere in the app.
  useEffect(() => {
    if (isBdoRole && user?.bdoName) {
      setFilters((f) => ({ ...f, bdo: user.bdoName as string }));
    } else {
      const bdo = new URLSearchParams(window.location.search).get("bdo");
      if (bdo) setFilters((f) => ({ ...f, bdo }));
    }
  }, [isBdoRole, user?.bdoName]);

  const { data: bdos = [] } = useQuery<BdoOption[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
    enabled: !isBdoRole,
  });
  const tradelineBdos = bdos.filter((b) => b.company === "TRADELINE");

  const { data: smeRes } = useQuery<{ data: ClientOption[] }>({
    queryKey: ["sme-options"],
    queryFn: () => fetcher("/sme"),
  });
  const clients = smeRes?.data ?? [];

  const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
  const { data = [], isLoading } = useQuery<TradelineDeal[]>({
    queryKey: ["tradeline", filters],
    queryFn: () => fetcher(`/tradeline?${params}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tradeline/${id}`),
    onSuccess: () => { toast.success("Deal deleted"); qc.invalidateQueries({ queryKey: ["tradeline"] }); },
    onError: (err) => toast.failed("Couldn't delete this deal", err),
  });

  const live = data.filter((d) => d.dealStage !== "CLOSED_LOST");
  const totalValue = live.reduce((s, d) => s + (d.expectedRevenueReceivedGhs ?? d.revenuePotentialGhs ?? 0), 0);
  const totalRevenue = data.reduce((s, d) => s + (d.revenueReceivedGhs ?? 0), 0);
  const totalOutstanding = live.reduce((s, d) => s + (d.balanceGhs ?? 0), 0);

  const columns = [
    { key: "serialNo", label: "#", sortable: true, width: "50px", render: (r: TradelineDeal) => r.serialNo ?? "—" },
    {
      key: "businessName", label: "Business", sortable: true,
      render: (r: TradelineDeal) => (
        <button onClick={() => setDetail(r)} className="text-left font-medium text-accent hover:underline truncate max-w-[180px] block">
          {r.businessName}
        </button>
      ),
    },
    { key: "valueChain", label: "Value Chain", render: (r: TradelineDeal) => r.valueChain ?? "—" },
    { key: "bdo", label: "BDO", render: (r: TradelineDeal) => r.bdo?.name ?? "—" },
    {
      key: "tier", label: "Tier", sortable: true,
      render: (r: TradelineDeal) => (
        <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
          {r.tier?.replace("_", " ")}
        </span>
      ),
    },
    { key: "priority", label: "Priority", render: (r: TradelineDeal) => <PriorityBadge value={r.priority} />, sortable: true },
    { key: "dealValue", label: "Deal value", render: (r: TradelineDeal) => dealValueOf(r) ? `${r.currency ?? "GHS"} ${Number(dealValueOf(r)).toLocaleString()}` : "—", sortable: true },
    { key: "revenueReceivedGhs", label: "Received (GHS)", render: (r: TradelineDeal) => r.revenueReceivedGhs ? fmt(r.revenueReceivedGhs) : "—", sortable: true },
    { key: "balanceGhs", label: "Balance (GHS)", render: (r: TradelineDeal) => r.balanceGhs ? fmt(r.balanceGhs) : "—", sortable: true },
    { key: "paymentStatus", label: "Status", render: (r: TradelineDeal) => <DealStatusBadge deal={r} /> },
    { key: "invoiceStatus", label: "Invoice", sortable: true, render: (r: TradelineDeal) => <InvoiceStatusBadge value={r.invoiceStatus ?? "NOT_INVOICED"} /> },
    { key: "nextAction", label: "Next Action", render: (r: TradelineDeal) => <span className="truncate block max-w-[160px]">{r.nextAction ?? "—"}</span> },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tradeline deals</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isBdoRole ? "Your won work: value, money received and balance" : "Won work: value, money received and balance"}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-accent font-medium">Deal value (GHS)</div>
            <div className="font-bold text-accent">{fmt(totalValue)}</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-emerald-600 font-medium">Received (GHS)</div>
            <div className="font-bold text-emerald-700">{fmt(totalRevenue)}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-red-600 font-medium">Balance (GHS)</div>
            <div className="font-bold text-red-700">{fmt(totalOutstanding)}</div>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        title={`${data.length} deal${data.length === 1 ? "" : "s"}`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => {
          confirmAction({ title: `Delete the deal for ${row.businessName}?`, body: "This can't be undone.", confirmLabel: "Delete deal" }).then((ok) => { if (ok) deleteMutation.mutate(row.id); });
        }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            {!isBdoRole && (
              <FilterSelect value={filters.bdo} options={[{ value: "", label: "All BDOs" }, ...tradelineBdos.map((b) => ({ value: b.name, label: b.name }))]} onChange={(v) => setFilters((f) => ({ ...f, bdo: v }))} />
            )}
            <FilterSelect value={filters.tier} options={[{ value: "", label: "All Tiers" }, ...TIER_OPTS.map((t) => ({ value: t, label: t.replace("_", " ") }))]} onChange={(v) => setFilters((f) => ({ ...f, tier: v }))} />
            <FilterSelect value={filters.priority} options={[{ value: "", label: "All Priorities" }, ...PRIORITY_OPTS.map((s) => ({ value: s, label: s }))]} onChange={(v) => setFilters((f) => ({ ...f, priority: v }))} />
          </div>
        }
      />

      {showForm && (
        <DealFormModal
          deal={editing}
          prefill={prefill}
          bdos={tradelineBdos}
          clients={clients}
          isBdoRole={isBdoRole}
          currentBdoId={user?.bdoId ?? null}
          onClose={() => { setShowForm(false); setPrefill(null); }}
          onSaved={() => { setShowForm(false); setPrefill(null); qc.invalidateQueries({ queryKey: ["tradeline"] }); }}
        />
      )}

      {detail && (
        <DetailDrawer
          deal={detail}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); setShowForm(true); }}
          onChanged={() => { setDetail(null); qc.invalidateQueries({ queryKey: ["tradeline"] }); }}
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

// ─── Add / Edit modal ──────────────────────────────────────────────────────────

function DealFormModal({ deal, prefill, bdos, clients, isBdoRole, currentBdoId, onClose, onSaved }: { deal: TradelineDeal | null; prefill: NewDealLink | null; bdos: BdoOption[]; clients: ClientOption[]; isBdoRole: boolean; currentBdoId: string | null; onClose: () => void; onSaved: () => void }) {
  const dCur = deal?.currency ?? "GHS";
  const dRate = deal?.exchangeRate ?? 1;
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(isBdoRole && currentBdoId ? { bdoId: currentBdoId } : {}),
    ...(deal ? {
      businessName: deal.businessName,
      smeId: deal.smeId ?? "",
      valueChain: deal.valueChain ?? "",
      email: deal.email ?? "",
      telephone: deal.telephone ?? "",
      currentStatus: deal.currentStatus ?? "",
      nextAction: deal.nextAction ?? "",
      bdoId: deal.bdoId ?? "",
      dealValue: dealValueOf(deal),
      expectedPaymentDate: (deal.expectedPaymentDate ?? deal.dueDate ?? "").slice(0, 10),
      currency: dCur,
      exchangeRate: dCur === "GHS" ? "" : String(dRate),
      tier: deal.tier,
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
    if (m) setForm((f) => ({ ...f, smeId: m.id, businessName: m.companyName, valueChain: m.valueChain ?? "", email: m.email ?? "", telephone: m.phone ?? "", dealValue: prefill.value || f.dealValue }));
  }, [prefill, clients, form.smeId]);

  const save = async () => {
    if (!deal && !form.smeId) { setError("Please select a client."); return; }
    if (!form.businessName.trim()) { setError("Please select a client."); return; }
    setSaving(true); setError("");
    const body = {
      ...form,
      ...dealValueBody(form),
      smeId: form.smeId || null,
      bdoId: form.bdoId || null,
      valueChain: form.valueChain || null,
      email: form.email || null,
      telephone: form.telephone || null,
      currentStatus: form.currentStatus || null,
      nextAction: form.nextAction || null,
      assignedBdoIds: assigned,
    };
    try {
      if (deal) await api.put(`/tradeline/${deal.id}`, body);
      else await api.post("/tradeline", body);
      toast.success(deal ? "Deal updated" : "Deal added", { description: form.businessName.trim() || undefined });
      onSaved();
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "We couldn't save this deal. Please try again.");
    }
    finally { setSaving(false); }
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
                    valueChain: match?.valueChain ?? f.valueChain,
                    email: match?.email ?? f.email,
                    telephone: match?.phone ?? f.telephone,
                  }));
                }}
              />
              <p className="text-[11px] text-muted mt-1">
                Picking a client fills in their details. Don&apos;t see them? <Link href="/sme" className="text-accent hover:underline">Add them on the Clients page first →</Link>
              </p>
          </div>
          <div className="sm:col-span-2"><Field label="Value Chain / Sector" value={form.valueChain} onChange={(v) => set("valueChain", v)} /></div>
          <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
          <Field label="Telephone" value={form.telephone} onChange={(v) => set("telephone", v)} />
        </div>
      )}
      {step === 1 && (
        <div className="space-y-3">
          {!isBdoRole && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Who owns this deal?</label>
              <select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="">— Unassigned —</option>
                {bdos.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <AssigneesField value={assigned} onChange={setAssigned} people={bdos} ownerId={form.bdoId} />
          <div className="grid grid-cols-2 gap-3">
            <FormSelect label="Tier" value={form.tier} options={TIER_OPTS} onChange={(v) => set("tier", v)} />
            <FormSelect label="Priority" value={form.priority} options={PRIORITY_OPTS} onChange={(v) => set("priority", v)} />
          </div>
          <TextArea label="Current Status / Updates" value={form.currentStatus} onChange={(v) => set("currentStatus", v)} rows={3} />
          <TextArea label="Next Action Required" value={form.nextAction} onChange={(v) => set("nextAction", v)} rows={2} />
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

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ deal, onClose, onEdit, onChanged }: { deal: TradelineDeal; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{deal.businessName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{deal.bizId ?? `Serial #${deal.serialNo ?? "—"}`}</p>
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
            <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">{deal.tier?.replace("_", " ")}</span>
            <InvoiceStatusBadge value={deal.invoiceStatus ?? "NOT_INVOICED"} />
          </div>

          {/* Key fields */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailItem label="Value Chain" value={deal.valueChain} />
            <DetailItem label="BDO" value={deal.bdo?.name} />
            <DetailItem label="Email" value={deal.email} />
            <DetailItem label="Telephone" value={deal.telephone} />
            <DetailItem label="Expected payment" value={deal.expectedPaymentDate || deal.dueDate ? new Date((deal.expectedPaymentDate ?? deal.dueDate) as string).toLocaleDateString() : null} />
          </dl>

          {/* Revenue panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <RevenueCard label="Deal value" value={dealValueOf(deal) ? `${deal.currency ?? "GHS"} ${Number(dealValueOf(deal)).toLocaleString()}` : "—"} color="blue" />
            <RevenueCard label="Received" value={dealMoneyText(deal.revenueReceivedGhs, deal)} color="green" />
            <RevenueCard label="Balance" value={dealStatus(deal) === "CANCELLED" ? "—" : dealMoneyText(deal.balanceGhs, deal)} color="red" />
          </div>

          <DealPayments source="TRADELINE" dealId={deal.id} company="TRADELINE" dealName={deal.businessName} cancelled={deal.dealStage === "CLOSED_LOST"} endpoint={`/tradeline/${deal.id}`} onChanged={onChanged} />
          {/* Long text */}
          {deal.currentStatus && <LongField label="Current Status / Updates" value={deal.currentStatus} />}
          {deal.nextAction && <LongField label="Next Action Required" value={deal.nextAction} accent />}
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text", span, min }: { label: string; value: string; onChange: (v: string) => void; type?: string; span?: number; min?: number }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} min={min} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
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

function RevenueCard({ label, value, color }: { label: string; value: string; color: "blue" | "green" | "red" }) {
  const styles = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-emerald-50 border-emerald-200 text-emerald-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };
  return (
    <div className={`border rounded-lg p-3 text-center ${styles[color]}`}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="font-bold text-sm mt-0.5">{value}</div>
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
