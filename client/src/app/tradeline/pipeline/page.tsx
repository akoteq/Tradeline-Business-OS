"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { DealHealthBadge, DealStageBadge, PriorityBadge } from "@/components/Badges";

type TradelineDeal = {
  id: string;
  bizId: string | null;
  serialNo: number | null;
  businessName: string;
  valueChain: string | null;
  bdo: { name: string } | null;
  tier: string;
  email: string | null;
  telephone: string | null;
  currentStatus: string | null;
  nextAction: string | null;
  requiredInvestment: string | null;
  revenuePotentialGhs: number | null;
  dueDate: string | null;
  revenueReceivedGhs: number | null;
  balanceGhs: number | null;
  paymentStatus: string;
  dealStage: string;
  priority: string;
  dealHealth: string;
};

const TIER_OPTIONS = ["", "TIER_1", "TIER_2", "TIER_3"];

type BdoOption = { id: string; name: string };

export default function TradelinePipelinePage() {
  const [filters, setFilters] = useState({ bdo: "", tier: "", stage: "", health: "", priority: "" });
  const [editing, setEditing] = useState<TradelineDeal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: bdos = [] } = useQuery<BdoOption[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
  });

  const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
  const { data = [], isLoading } = useQuery<TradelineDeal[]>({
    queryKey: ["tradeline", filters],
    queryFn: () => fetcher(`/tradeline?${params}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tradeline/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tradeline"] }),
  });

  const totalRevenue = data.reduce((s, d) => s + (d.revenueReceivedGhs ?? 0), 0);
  const totalOutstanding = data.reduce((s, d) => s + (d.balanceGhs ?? 0), 0);
  const fmt = (n: number) => `GHS ${n.toLocaleString()}`;

  const columns = [
    { key: "dealHealth", label: "Health", render: (r: TradelineDeal) => <DealHealthBadge value={r.dealHealth} />, sortable: true, width: "90px" },
    { key: "serialNo", label: "#", sortable: true, width: "50px" },
    { key: "businessName", label: "Business", sortable: true },
    { key: "valueChain", label: "Value Chain", sortable: true },
    { key: "bdo", label: "BDO", render: (r: TradelineDeal) => r.bdo?.name ?? "—", sortable: false },
    { key: "tier", label: "Tier", render: (r: TradelineDeal) => <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{r.tier?.replace("_", " ")}</span>, sortable: true },
    { key: "dealStage", label: "Stage", render: (r: TradelineDeal) => <DealStageBadge value={r.dealStage} />, sortable: true },
    { key: "priority", label: "Priority", render: (r: TradelineDeal) => <PriorityBadge value={r.priority} />, sortable: true },
    { key: "currentStatus", label: "Status / Update" },
    { key: "revenueReceivedGhs", label: "Received (GHS)", render: (r: TradelineDeal) => r.revenueReceivedGhs ? fmt(r.revenueReceivedGhs) : "—", sortable: true },
    { key: "balanceGhs", label: "Balance (GHS)", render: (r: TradelineDeal) => r.balanceGhs ? fmt(r.balanceGhs) : "—", sortable: true },
    { key: "paymentStatus", label: "Payment", render: (r: TradelineDeal) => <PaymentBadge value={r.paymentStatus} /> },
    { key: "nextAction", label: "Next Action" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tradeline Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">Institutional clients · Investment & grant facilitation</p>
        </div>
        <div className="flex gap-4 text-sm">
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
          if (confirm(`Delete "${row.businessName}"?`)) deleteMutation.mutate(row.id);
        }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <FilterSelect label="BDO" value={filters.bdo} options={[{ value: "", label: "All BDOs" }, ...bdos.map((b) => ({ value: b.name, label: b.name }))]} onChange={(v) => setFilters((f) => ({ ...f, bdo: v }))} />
            <FilterSelect label="Tier" value={filters.tier} options={[{ value: "", label: "All Tiers" }, ...TIER_OPTIONS.filter(Boolean).map((t) => ({ value: t, label: t.replace("_", " ") }))]} onChange={(v) => setFilters((f) => ({ ...f, tier: v }))} />
            <FilterSelect label="Health" value={filters.health} options={[{ value: "", label: "All Health" }, ...["ACTIVE","STALE","AT_RISK","CLOSED_WON","CLOSED_LOST"].map((h) => ({ value: h, label: h }))]} onChange={(v) => setFilters((f) => ({ ...f, health: v }))} />
          </div>
        }
      />

      {showForm && (
        <TradelineFormModal
          deal={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["tradeline"] }); }}
        />
      )}
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

function FilterSelect({ value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function TradelineFormModal({ deal, onClose, onSaved }: { deal: TradelineDeal | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    businessName: deal?.businessName ?? "",
    valueChain: deal?.valueChain ?? "",
    tier: deal?.tier ?? "TIER_1",
    email: deal?.email ?? "",
    telephone: deal?.telephone ?? "",
    currentStatus: deal?.currentStatus ?? "",
    nextAction: deal?.nextAction ?? "",
    requiredInvestment: deal?.requiredInvestment ?? "",
    revenuePotentialGhs: deal?.revenuePotentialGhs ?? "",
    revenueReceivedGhs: deal?.revenueReceivedGhs ?? "",
    balanceGhs: deal?.balanceGhs ?? "",
    paymentStatus: deal?.paymentStatus ?? "UNPAID",
    dealStage: deal?.dealStage ?? "QUALIFICATION",
    priority: deal?.priority ?? "MEDIUM",
    dealHealth: deal?.dealHealth ?? "ACTIVE",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true); setError("");
    try {
      if (deal) await api.put(`/tradeline/${deal.id}`, form);
      else await api.post("/tradeline", form);
      onSaved();
    } catch { setError("Failed to save."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{deal ? "Edit Deal" : "Add Deal"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          {[["businessName","Business Name"],["valueChain","Value Chain"],["email","Email"],["telephone","Telephone"],["requiredInvestment","Required Investment"]].map(([k,l]) => (
            <div key={k}>
              <label className="text-xs font-medium text-gray-600 block mb-1">{l}</label>
              <input value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({...f,[k]:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            {[["revenuePotentialGhs","Revenue Potential (GHS)"],["revenueReceivedGhs","Revenue Received (GHS)"],["balanceGhs","Balance (GHS)"]].map(([k,l]) => (
              <div key={k}>
                <label className="text-xs font-medium text-gray-600 block mb-1">{l}</label>
                <input type="number" value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({...f,[k]:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([["tier","Tier",["TIER_1","TIER_2","TIER_3"]],["dealStage","Stage",["QUALIFICATION","DISCOVERY","PROPOSAL_SENT","NEGOTIATION","CONTRACT_REVIEW","CLOSED_WON","CLOSED_LOST","ON_HOLD"]],["dealHealth","Health",["ACTIVE","STALE","AT_RISK","CLOSED_WON","CLOSED_LOST"]],["priority","Priority",["HIGH","MEDIUM","LOW"]],["paymentStatus","Payment",["PAID","UNPAID","PARTIAL","OVERDUE"]]] as [string,string,string[]][]).map(([k,l,opts]) => (
              <div key={k}>
                <label className="text-xs font-medium text-gray-600 block mb-1">{l}</label>
                <select value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({...f,[k]:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  {opts.map((o) => <option key={o} value={o}>{o.replace(/_/g," ")}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Current Status / Updates</label>
            <textarea value={form.currentStatus} onChange={(e) => setForm((f) => ({...f,currentStatus:e.target.value}))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Next Action Required</label>
            <textarea value={form.nextAction} onChange={(e) => setForm((f) => ({...f,nextAction:e.target.value}))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
