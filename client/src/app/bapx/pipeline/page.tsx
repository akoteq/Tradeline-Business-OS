"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { DealHealthBadge, DealStageBadge, PriorityBadge } from "@/components/Badges";

type BapxDeal = {
  id: string;
  bizId: string | null;
  dealHealth: string;
  date: string | null;
  businessName: string;
  clientName: string | null;
  holdingFirm: string | null;
  industry: string | null;
  telephone: string | null;
  region: string | null;
  email: string | null;
  bdo: { name: string } | null;
  activityType: string | null;
  keyTopics: string | null;
  callOutcome: string | null;
  product: string | null;
  dealStage: string;
  priority: string;
  nextSteps: string | null;
  nextCallDate: string | null;
  targetGhs: number | null;
};

const DEAL_HEALTH_OPTIONS = ["", "ACTIVE", "STALE", "AT_RISK", "CLOSED_WON", "CLOSED_LOST"];
const STAGE_OPTIONS = ["", "QUALIFICATION", "DISCOVERY", "PROPOSAL_SENT", "NEGOTIATION", "CONTRACT_REVIEW", "CLOSED_WON", "CLOSED_LOST", "ON_HOLD"];
const PRIORITY_OPTIONS = ["", "HIGH", "MEDIUM", "LOW"];

type BdoOption = { id: string; name: string };

export default function BapxPipelinePage() {
  const [filters, setFilters] = useState({ bdo: "", stage: "", health: "", priority: "" });
  const [editing, setEditing] = useState<BapxDeal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: bdos = [] } = useQuery<BdoOption[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
  });

  const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
  const { data = [], isLoading } = useQuery<BapxDeal[]>({
    queryKey: ["bapx", filters],
    queryFn: () => fetcher(`/bapx?${params}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bapx/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bapx"] }),
  });

  const columns = [
    { key: "dealHealth", label: "Health", render: (r: BapxDeal) => <DealHealthBadge value={r.dealHealth} />, sortable: true, width: "90px" },
    { key: "businessName", label: "Business", sortable: true },
    { key: "clientName", label: "Client" },
    { key: "bdo", label: "BDO", render: (r: BapxDeal) => r.bdo?.name ?? "—" },
    { key: "industry", label: "Industry" },
    { key: "region", label: "Region" },
    { key: "dealStage", label: "Stage", render: (r: BapxDeal) => <DealStageBadge value={r.dealStage} />, sortable: true },
    { key: "priority", label: "Priority", render: (r: BapxDeal) => <PriorityBadge value={r.priority} />, sortable: true },
    { key: "targetGhs", label: "Target (GHS)", render: (r: BapxDeal) => r.targetGhs ? `GHS ${r.targetGhs.toLocaleString()}` : "—", sortable: true },
    { key: "activityType", label: "Activity" },
    { key: "nextSteps", label: "Next Steps" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">BAPX Pipeline</h1>
        <p className="text-sm text-gray-500 mt-1">All active BAPX business development deals</p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        title={`${data.length} deals`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => {
          if (confirm(`Delete deal for "${row.businessName}"?`)) deleteMutation.mutate(row.id);
        }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <FilterSelect label="BDO" value={filters.bdo} options={[{ value: "", label: "All BDOs" }, ...bdos.map((b) => ({ value: b.name, label: b.name }))]} onChange={(v) => setFilters((f) => ({ ...f, bdo: v }))} />
            <FilterSelect label="Stage" value={filters.stage} options={STAGE_OPTIONS.map((s) => ({ value: s, label: s || "All Stages" }))} onChange={(v) => setFilters((f) => ({ ...f, stage: v }))} />
            <FilterSelect label="Health" value={filters.health} options={DEAL_HEALTH_OPTIONS.map((s) => ({ value: s, label: s || "All Health" }))} onChange={(v) => setFilters((f) => ({ ...f, health: v }))} />
            <FilterSelect label="Priority" value={filters.priority} options={PRIORITY_OPTIONS.map((s) => ({ value: s, label: s || "All Priorities" }))} onChange={(v) => setFilters((f) => ({ ...f, priority: v }))} />
          </div>
        }
      />

      {showForm && (
        <DealFormModal
          deal={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["bapx"] }); }}
          endpoint="/bapx"
        />
      )}
    </div>
  );
}

function FilterSelect({ value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function DealFormModal({ deal, onClose, onSaved, endpoint }: { deal: BapxDeal | null; onClose: () => void; onSaved: () => void; endpoint: string }) {
  const [form, setForm] = useState({
    businessName: deal?.businessName ?? "",
    clientName: deal?.clientName ?? "",
    industry: deal?.industry ?? "",
    region: deal?.region ?? "",
    telephone: deal?.telephone ?? "",
    email: deal?.email ?? "",
    dealStage: deal?.dealStage ?? "QUALIFICATION",
    dealHealth: deal?.dealHealth ?? "ACTIVE",
    priority: deal?.priority ?? "MEDIUM",
    activityType: deal?.activityType ?? "",
    keyTopics: deal?.keyTopics ?? "",
    callOutcome: deal?.callOutcome ?? "",
    nextSteps: deal?.nextSteps ?? "",
    targetGhs: deal?.targetGhs ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (deal) await api.put(`${endpoint}/${deal.id}`, form);
      else await api.post(endpoint, form);
      onSaved();
    } catch {
      setError("Failed to save. Check the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{deal ? "Edit Deal" : "Add Deal"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          {[
            ["businessName", "Business Name", "text"],
            ["clientName", "Client Name", "text"],
            ["industry", "Industry / Value Chain", "text"],
            ["region", "Region", "text"],
            ["telephone", "Telephone", "text"],
            ["email", "Email", "email"],
            ["activityType", "Activity Type", "text"],
            ["targetGhs", "Target (GHS)", "number"],
          ].map(([key, label, type]) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
              <input
                type={type}
                value={String(form[key as keyof typeof form])}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          ))}
          <div className="grid grid-cols-3 gap-3">
            <FormSelect label="Deal Stage" value={form.dealStage} options={["QUALIFICATION","DISCOVERY","PROPOSAL_SENT","NEGOTIATION","CONTRACT_REVIEW","CLOSED_WON","CLOSED_LOST","ON_HOLD"]} onChange={(v) => setForm((f) => ({ ...f, dealStage: v }))} />
            <FormSelect label="Health" value={form.dealHealth} options={["ACTIVE","STALE","AT_RISK","CLOSED_WON","CLOSED_LOST"]} onChange={(v) => setForm((f) => ({ ...f, dealHealth: v }))} />
            <FormSelect label="Priority" value={form.priority} options={["HIGH","MEDIUM","LOW"]} onChange={(v) => setForm((f) => ({ ...f, priority: v }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Key Topics</label>
            <textarea value={form.keyTopics} onChange={(e) => setForm((f) => ({ ...f, keyTopics: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Call Outcome / Updates</label>
            <textarea value={form.callOutcome} onChange={(e) => setForm((f) => ({ ...f, callOutcome: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Next Steps</label>
            <textarea value={form.nextSteps} onChange={(e) => setForm((f) => ({ ...f, nextSteps: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
