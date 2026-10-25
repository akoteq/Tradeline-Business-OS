"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { DataTable } from "@/components/DataTable";
import { DealHealthBadge, DealStageBadge, PriorityBadge, InvoiceStatusBadge } from "@/components/Badges";
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
};

type BdoOption = { id: string; name: string; company: string };

const TIER_OPTS = ["TIER_1", "TIER_2", "TIER_3"];
const HEALTH_OPTS = ["ACTIVE", "STALE", "AT_RISK", "CLOSED_WON", "CLOSED_LOST"];
const STAGE_OPTS = ["QUALIFICATION", "DISCOVERY", "PROPOSAL_SENT", "NEGOTIATION", "CONTRACT_REVIEW", "CLOSED_WON", "CLOSED_LOST", "ON_HOLD"];
const PRIORITY_OPTS = ["HIGH", "MEDIUM", "LOW"];
const PAYMENT_OPTS = ["PAID", "UNPAID", "PARTIAL", "OVERDUE"];
const INVOICE_OPTS = ["NOT_INVOICED", "INVOICED", "PAID", "OVERDUE"];
const CURRENCIES = ["GHS", "USD", "EUR", "NGN", "RWF"];

const EMPTY_FORM = {
  businessName: "", smeId: "", valueChain: "", email: "", telephone: "",
  currentStatus: "", nextAction: "",
  bdoId: "", dueDate: "",
  revenuePotentialGhs: "", expectedRevenueReceivedGhs: "", revenueReceivedGhs: "",
  tier: "TIER_1", dealStage: "QUALIFICATION", dealHealth: "ACTIVE",
  priority: "MEDIUM", paymentStatus: "UNPAID", invoiceStatus: "NOT_INVOICED",
  currency: "GHS", exchangeRate: "",
};

const fmt = (n: number) => n.toLocaleString();

export default function TradelinePipelinePage() {
  const { user } = useAuth();
  const isBdoRole = isStaff(user);
  const [filters, setFilters] = useState({ bdo: "", tier: "", stage: "", health: "", priority: "" });
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

  const totalPotential = data.reduce((s, d) => s + (d.revenuePotentialGhs ?? 0), 0);
  const totalExpected = data.reduce((s, d) => s + (d.expectedRevenueReceivedGhs ?? 0), 0);
  const totalRevenue = data.reduce((s, d) => s + (d.revenueReceivedGhs ?? 0), 0);
  const totalOutstanding = data.reduce((s, d) => s + (d.balanceGhs ?? 0), 0);

  const columns = [
    { key: "dealHealth", label: "Health", render: (r: TradelineDeal) => <DealHealthBadge value={r.dealHealth} />, sortable: true, width: "90px" },
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
    { key: "dealStage", label: "Stage", render: (r: TradelineDeal) => <DealStageBadge value={r.dealStage} />, sortable: true },
    { key: "priority", label: "Priority", render: (r: TradelineDeal) => <PriorityBadge value={r.priority} />, sortable: true },
    { key: "revenuePotentialGhs", label: "Potential (GHS)", render: (r: TradelineDeal) => r.revenuePotentialGhs ? fmt(r.revenuePotentialGhs) : "—", sortable: true },
    { key: "expectedRevenueReceivedGhs", label: "Expected (GHS)", render: (r: TradelineDeal) => r.expectedRevenueReceivedGhs ? fmt(r.expectedRevenueReceivedGhs) : "—", sortable: true },
    { key: "revenueReceivedGhs", label: "Received (GHS)", render: (r: TradelineDeal) => r.revenueReceivedGhs ? fmt(r.revenueReceivedGhs) : "—", sortable: true },
    { key: "balanceGhs", label: "Balance (GHS)", render: (r: TradelineDeal) => r.balanceGhs ? fmt(r.balanceGhs) : "—", sortable: true },
    { key: "paymentStatus", label: "Payment", render: (r: TradelineDeal) => <PaymentBadge value={r.paymentStatus} /> },
    { key: "invoiceStatus", label: "Invoice", sortable: true, render: (r: TradelineDeal) => <InvoiceStatusBadge value={r.invoiceStatus ?? "NOT_INVOICED"} /> },
    { key: "nextAction", label: "Next Action", render: (r: TradelineDeal) => <span className="truncate block max-w-[160px]">{r.nextAction ?? "—"}</span> },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tradeline Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isBdoRole ? "Your institutional clients · Investment & grant facilitation" : "Institutional clients · Investment & grant facilitation"}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-accent font-medium">Potential Revenue</div>
            <div className="font-bold text-accent">{fmt(totalPotential)}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-blue-600 font-medium">Expected Revenue</div>
            <div className="font-bold text-blue-700">{fmt(totalExpected)}</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-emerald-600 font-medium">Revenue Received</div>
            <div className="font-bold text-emerald-700">{fmt(totalRevenue)}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-red-600 font-medium">Outstanding</div>
            <div className="font-bold text-red-700">{fmt(totalOutstanding)}</div>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        title={`${data.length} clients`}
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
            <FilterSelect value={filters.health} options={[{ value: "", label: "All Health" }, ...HEALTH_OPTS.map((h) => ({ value: h, label: h.replace(/_/g, " ") }))]} onChange={(v) => setFilters((f) => ({ ...f, health: v }))} />
            <FilterSelect value={filters.stage} options={[{ value: "", label: "All Stages" }, ...STAGE_OPTS.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(v) => setFilters((f) => ({ ...f, stage: v }))} />
            <FilterSelect value={filters.priority} options={[{ value: "", label: "All Priorities" }, ...PRIORITY_OPTS.map((s) => ({ value: s, label: s }))]} onChange={(v) => setFilters((f) => ({ ...f, priority: v }))} />
          </div>
        }
      />

      {showForm && (
        <DealFormModal
          deal={editing}
          bdos={tradelineBdos}
          clients={clients}
          isBdoRole={isBdoRole}
          currentBdoId={user?.bdoId ?? null}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["tradeline"] }); }}
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

// ─── Filter select ─────────────────────────────────────────────────────────────

function FilterSelect({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────────

function DealFormModal({ deal, bdos, clients, isBdoRole, currentBdoId, onClose, onSaved }: { deal: TradelineDeal | null; bdos: BdoOption[]; clients: ClientOption[]; isBdoRole: boolean; currentBdoId: string | null; onClose: () => void; onSaved: () => void }) {
  const dCur = deal?.currency ?? "GHS";
  const dRate = deal?.exchangeRate ?? 1;
  const disp = (ghs: number | null | undefined) =>
    ghs == null ? "" : String(dCur === "GHS" || !dRate ? ghs : Math.round((ghs / dRate) * 100) / 100);
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
      dueDate: deal.dueDate ? deal.dueDate.slice(0, 10) : "",
      revenuePotentialGhs: disp(deal.revenuePotentialGhs),
      expectedRevenueReceivedGhs: disp(deal.expectedRevenueReceivedGhs),
      revenueReceivedGhs: disp(deal.revenueReceivedGhs),
      currency: dCur,
      exchangeRate: dCur === "GHS" ? "" : String(dRate),
      tier: deal.tier,
      dealStage: deal.dealStage,
      dealHealth: deal.dealHealth,
      priority: deal.priority,
      paymentStatus: deal.paymentStatus,
      invoiceStatus: deal.invoiceStatus ?? "NOT_INVOICED",
    } : {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assigned, setAssigned] = useState<string[]>((deal as { assignedBdoIds?: string[] } | null)?.assignedBdoIds ?? []);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const computedBalance = Math.max(0, (Number(form.expectedRevenueReceivedGhs) || 0) - (Number(form.revenueReceivedGhs) || 0));

  const save = async () => {
    if (!deal && !form.smeId) { setError("Please select a client."); return; }
    if (!form.businessName.trim()) { setError("Please select a client."); return; }
    const potential = form.revenuePotentialGhs !== "" ? Number(form.revenuePotentialGhs) : null;
    const expected = form.expectedRevenueReceivedGhs !== "" ? Number(form.expectedRevenueReceivedGhs) : null;
    const received = form.revenueReceivedGhs !== "" ? Number(form.revenueReceivedGhs) : null;
    if ((potential != null && potential < 0) || (expected != null && expected < 0) || (received != null && received < 0)) {
      setError("Revenue fields cannot be negative."); return;
    }
    if (potential != null && expected != null && expected > potential) {
      setError("Expected Revenue Received cannot exceed Revenue Potential."); return;
    }
    setSaving(true); setError("");
    // Convert entered amounts to GHS (the stored / reporting currency).
    const rate = form.currency === "GHS" ? 1 : (Number(form.exchangeRate) || 1);
    const body = {
      ...form,
      smeId: form.smeId || null,
      bdoId: form.bdoId || null,
      dueDate: form.dueDate || null,
      revenuePotentialGhs: potential != null ? potential * rate : null,
      expectedRevenueReceivedGhs: expected != null ? expected * rate : null,
      revenueReceivedGhs: received != null ? received * rate : null,
      balanceGhs: Math.max(0, ((expected ?? 0) - (received ?? 0)) * rate),
      exchangeRate: rate,
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
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Failed to save. Check the server.");
    }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-gray-900">{deal ? "Edit Client" : "Add Client"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Basic info */}
          <Section label="Client Information">
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
                      // Pre-fill known details from the client record (only where empty is fine to overwrite on a fresh pick).
                      valueChain: match?.valueChain ?? f.valueChain,
                      email: match?.email ?? f.email,
                      telephone: match?.phone ?? f.telephone,
                    }));
                  }}
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Picking a client fills in their details. Don&apos;t see them? <Link href="/sme" className="text-accent hover:underline">Add in Client Overview first →</Link>
                </p>
              </div>
              <Field label="Value Chain / Sector" value={form.valueChain} onChange={(v) => set("valueChain", v)} span={2} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
              <Field label="Telephone" value={form.telephone} onChange={(v) => set("telephone", v)} />
            </div>
          </Section>

          {/* Deal details */}
          <Section label="Deal Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!isBdoRole && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">BDO</label>
                  <select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                    <option value="">— Unassigned —</option>
                    {bdos.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <Field label="Due Date" type="date" value={form.dueDate} onChange={(v) => set("dueDate", v)} span={isBdoRole ? 2 : undefined} />
              <div className="col-span-2"><AssigneesField value={assigned} onChange={setAssigned} people={bdos} ownerId={form.bdoId} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 sm:grid-cols-4">
              <FormSelect label="Tier" value={form.tier} options={TIER_OPTS} onChange={(v) => set("tier", v)} />
              <FormSelect label="Stage" value={form.dealStage} options={STAGE_OPTS} onChange={(v) => set("dealStage", v)} />
              <FormSelect label="Health" value={form.dealHealth} options={HEALTH_OPTS} onChange={(v) => set("dealHealth", v)} />
              <FormSelect label="Priority" value={form.priority} options={PRIORITY_OPTS} onChange={(v) => set("priority", v)} />
            </div>
          </Section>

          {/* Revenue */}
          <Section label="Revenue & Payment">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <FormSelect label="Currency" value={form.currency} options={CURRENCIES} onChange={(v) => set("currency", v)} />
              {form.currency !== "GHS" && (
                <Field label={`Exchange rate (1 ${form.currency} = ? GHS)`} type="number" min={0} value={form.exchangeRate} onChange={(v) => set("exchangeRate", v)} />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={`Revenue Potential (${form.currency})`} type="number" min={0} value={form.revenuePotentialGhs} onChange={(v) => set("revenuePotentialGhs", v)} />
              <Field label={`Expected Revenue Received (${form.currency})`} type="number" min={0} value={form.expectedRevenueReceivedGhs} onChange={(v) => set("expectedRevenueReceivedGhs", v)} />
              <Field label={`Revenue Received (${form.currency})`} type="number" min={0} value={form.revenueReceivedGhs} onChange={(v) => set("revenueReceivedGhs", v)} />
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Balance ({form.currency})</label>
                <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700">
                  {computedBalance.toLocaleString()}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Auto-calculated: Expected − Received</p>
              </div>
            </div>
            <div className="mt-3">
              <FormSelect label="Payment Status" value={form.paymentStatus} options={PAYMENT_OPTS} onChange={(v) => set("paymentStatus", v)} />
              <FormSelect label="Invoice Status" value={form.invoiceStatus} options={INVOICE_OPTS} onChange={(v) => set("invoiceStatus", v)} />
            </div>
          </Section>

          {/* Notes */}
          <Section label="Status & Actions">
            <TextArea label="Current Status / Updates" value={form.currentStatus} onChange={(v) => set("currentStatus", v)} rows={3} />
            <TextArea label="Next Action Required" value={form.nextAction} onChange={(v) => set("nextAction", v)} rows={2} />
          </Section>

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : deal ? "Update Client" : "Add Client"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ deal, onClose, onEdit }: { deal: TradelineDeal; onClose: () => void; onEdit: () => void }) {
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
            <DealHealthBadge value={deal.dealHealth} />
            <DealStageBadge value={deal.dealStage} />
            <PriorityBadge value={deal.priority} />
            <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">{deal.tier?.replace("_", " ")}</span>
            <PaymentBadge value={deal.paymentStatus} />
            <InvoiceStatusBadge value={deal.invoiceStatus ?? "NOT_INVOICED"} />
          </div>

          {/* Key fields */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailItem label="Value Chain" value={deal.valueChain} />
            <DetailItem label="BDO" value={deal.bdo?.name} />
            <DetailItem label="Email" value={deal.email} />
            <DetailItem label="Telephone" value={deal.telephone} />
            <DetailItem label="Due Date" value={deal.dueDate ? new Date(deal.dueDate).toLocaleDateString() : null} />
          </dl>

          {/* Revenue panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <RevenueCard label="Potential" value={deal.revenuePotentialGhs} color="blue" />
            <RevenueCard label="Expected" value={deal.expectedRevenueReceivedGhs} color="blue" />
            <RevenueCard label="Received" value={deal.revenueReceivedGhs} color="green" />
            <RevenueCard label="Balance" value={deal.balanceGhs} color="red" />
          </div>

          <DealPayments source="TRADELINE" dealId={deal.id} />
          {/* Long text */}
          {deal.currentStatus && <LongField label="Current Status / Updates" value={deal.currentStatus} />}
          {deal.nextAction && <LongField label="Next Action Required" value={deal.nextAction} accent />}
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{label}</p>
      {children}
    </div>
  );
}

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

function PaymentBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    PAID: "bg-green-100 text-green-700",
    UNPAID: "bg-red-100 text-red-700",
    PARTIAL: "bg-yellow-100 text-yellow-700",
    OVERDUE: "bg-red-200 text-red-800",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[value] ?? "bg-gray-100 text-gray-500"}`}>{value}</span>;
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 font-medium">{label}</dt>
      <dd className="text-gray-800 mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}

function RevenueCard({ label, value, color }: { label: string; value: number | null; color: "blue" | "green" | "red" }) {
  const styles = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-emerald-50 border-emerald-200 text-emerald-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };
  return (
    <div className={`border rounded-lg p-3 text-center ${styles[color]}`}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="font-bold text-sm mt-0.5">{value != null ? fmt(value) : "—"}</div>
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
