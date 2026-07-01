"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { DealHealthBadge, DealStageBadge, PriorityBadge } from "@/components/Badges";
import { X } from "lucide-react";

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
  bdoId: string | null;
  bdo: { id: string; name: string } | null;
  activityType: string | null;
  keyTopics: string | null;
  callOutcome: string | null;
  product: string | null;
  dealStage: string;
  priority: string;
  nextSteps: string | null;
  nextCallDate: string | null;
  targetGhs: number | null;
  daysSinceLastContact: number | null;
  aiCoachRecommendation: string | null;
};

type BdoOption = { id: string; name: string; company: string };

const HEALTH_OPTS = ["ACTIVE", "STALE", "AT_RISK", "CLOSED_WON", "CLOSED_LOST"];
const STAGE_OPTS = ["QUALIFICATION", "DISCOVERY", "PROPOSAL_SENT", "NEGOTIATION", "CONTRACT_REVIEW", "CLOSED_WON", "CLOSED_LOST", "ON_HOLD"];
const PRIORITY_OPTS = ["HIGH", "MEDIUM", "LOW"];

const EMPTY_FORM = {
  businessName: "", clientName: "", holdingFirm: "", industry: "", telephone: "",
  email: "", region: "", date: "", bdoId: "", activityType: "", product: "",
  keyTopics: "", callOutcome: "", nextSteps: "", nextCallDate: "",
  targetGhs: "", dealStage: "QUALIFICATION", dealHealth: "ACTIVE", priority: "MEDIUM",
};

export default function BapxPipelinePage() {
  const [filters, setFilters] = useState({ bdo: "", stage: "", health: "", priority: "" });
  const [editing, setEditing] = useState<BapxDeal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<BapxDeal | null>(null);
  const qc = useQueryClient();

  const { data: bdos = [] } = useQuery<BdoOption[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
  });
  const bapxBdos = bdos.filter((b) => b.company === "BAPX");

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
    {
      key: "businessName", label: "Business", sortable: true,
      render: (r: BapxDeal) => (
        <button onClick={() => setDetail(r)} className="text-left font-medium text-indigo-700 hover:underline truncate max-w-[180px] block">
          {r.businessName}
        </button>
      ),
    },
    { key: "clientName", label: "Client", render: (r: BapxDeal) => r.clientName ?? "—" },
    { key: "bdo", label: "BDO", render: (r: BapxDeal) => r.bdo?.name ?? "—" },
    { key: "industry", label: "Industry", render: (r: BapxDeal) => r.industry ?? "—" },
    { key: "region", label: "Region", render: (r: BapxDeal) => r.region ?? "—" },
    { key: "dealStage", label: "Stage", render: (r: BapxDeal) => <DealStageBadge value={r.dealStage} />, sortable: true },
    { key: "priority", label: "Priority", render: (r: BapxDeal) => <PriorityBadge value={r.priority} />, sortable: true },
    { key: "product", label: "Product", render: (r: BapxDeal) => r.product ?? "—" },
    { key: "targetGhs", label: "Target (GHS)", render: (r: BapxDeal) => r.targetGhs ? `GHS ${r.targetGhs.toLocaleString()}` : "—", sortable: true },
    { key: "nextSteps", label: "Next Steps", render: (r: BapxDeal) => <span className="truncate block max-w-[160px]">{r.nextSteps ?? "—"}</span> },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">BAPX Pipeline</h1>
        <p className="text-sm text-gray-500 mt-1">{data.length} active deals</p>
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
            <FilterSelect value={filters.bdo} options={[{ value: "", label: "All BDOs" }, ...bapxBdos.map((b) => ({ value: b.name, label: b.name }))]} onChange={(v) => setFilters((f) => ({ ...f, bdo: v }))} />
            <FilterSelect value={filters.stage} options={[{ value: "", label: "All Stages" }, ...STAGE_OPTS.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(v) => setFilters((f) => ({ ...f, stage: v }))} />
            <FilterSelect value={filters.health} options={[{ value: "", label: "All Health" }, ...HEALTH_OPTS.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(v) => setFilters((f) => ({ ...f, health: v }))} />
            <FilterSelect value={filters.priority} options={[{ value: "", label: "All Priorities" }, ...PRIORITY_OPTS.map((s) => ({ value: s, label: s }))]} onChange={(v) => setFilters((f) => ({ ...f, priority: v }))} />
          </div>
        }
      />

      {showForm && (
        <DealFormModal
          deal={editing}
          bdos={bapxBdos}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["bapx"] }); }}
        />
      )}

      {detail && <DetailDrawer deal={detail} onClose={() => setDetail(null)} onEdit={() => { setEditing(detail); setDetail(null); setShowForm(true); }} />}
    </div>
  );
}

// ─── Filter select ────────────────────────────────────────────────────────────

function FilterSelect({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────

function DealFormModal({ deal, bdos, onClose, onSaved }: { deal: BapxDeal | null; bdos: BdoOption[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(deal ? {
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
      targetGhs: deal.targetGhs != null ? String(deal.targetGhs) : "",
      dealStage: deal.dealStage,
      dealHealth: deal.dealHealth,
      priority: deal.priority,
    } : {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.businessName.trim()) { setError("Business name is required."); return; }
    setSaving(true);
    setError("");
    const body = {
      ...form,
      targetGhs: form.targetGhs !== "" ? Number(form.targetGhs) : null,
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
    };
    try {
      if (deal) await api.put(`/bapx/${deal.id}`, body);
      else await api.post("/bapx", body);
      onSaved();
    } catch {
      setError("Failed to save. Check the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-gray-900">{deal ? "Edit Deal" : "Add Deal"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Basic info */}
          <Section label="Basic Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Business Name *" value={form.businessName} onChange={(v) => set("businessName", v)} span={2} />
              <Field label="Client Name" value={form.clientName} onChange={(v) => set("clientName", v)} />
              <Field label="Holding Firm" value={form.holdingFirm} onChange={(v) => set("holdingFirm", v)} />
              <Field label="Industry / Value Chain" value={form.industry} onChange={(v) => set("industry", v)} />
              <Field label="Region" value={form.region} onChange={(v) => set("region", v)} />
              <Field label="Telephone" value={form.telephone} onChange={(v) => set("telephone", v)} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
            </div>
          </Section>

          {/* Deal info */}
          <Section label="Deal Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">BDO</label>
                <select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">— Unassigned —</option>
                  {bdos.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <Field label="Product / Service" value={form.product} onChange={(v) => set("product", v)} />
              <Field label="Activity Type" value={form.activityType} onChange={(v) => set("activityType", v)} />
              <Field label="Target (GHS)" type="number" value={form.targetGhs} onChange={(v) => set("targetGhs", v)} />
              <Field label="Date" type="date" value={form.date} onChange={(v) => set("date", v)} />
              <Field label="Next Call Date" type="date" value={form.nextCallDate} onChange={(v) => set("nextCallDate", v)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              <FormSelect label="Deal Stage" value={form.dealStage} options={STAGE_OPTS} onChange={(v) => set("dealStage", v)} />
              <FormSelect label="Health" value={form.dealHealth} options={HEALTH_OPTS} onChange={(v) => set("dealHealth", v)} />
              <FormSelect label="Priority" value={form.priority} options={PRIORITY_OPTS} onChange={(v) => set("priority", v)} />
            </div>
          </Section>

          {/* Notes */}
          <Section label="Notes & Updates">
            <TextArea label="Key Topics" value={form.keyTopics} onChange={(v) => set("keyTopics", v)} rows={2} />
            <TextArea label="Call Outcome / Updates" value={form.callOutcome} onChange={(v) => set("callOutcome", v)} rows={3} />
            <TextArea label="Next Steps" value={form.nextSteps} onChange={(v) => set("nextSteps", v)} rows={2} />
          </Section>

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : deal ? "Update Deal" : "Create Deal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ deal, onClose, onEdit }: { deal: BapxDeal; onClose: () => void; onEdit: () => void }) {
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
            <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Edit</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <DealHealthBadge value={deal.dealHealth} />
            <DealStageBadge value={deal.dealStage} />
            <PriorityBadge value={deal.priority} />
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
            <DetailItem label="Target (GHS)" value={deal.targetGhs != null ? `GHS ${deal.targetGhs.toLocaleString()}` : null} />
            <DetailItem label="Date" value={deal.date ? new Date(deal.date).toLocaleDateString() : null} />
            <DetailItem label="Next Call Date" value={deal.nextCallDate ? new Date(deal.nextCallDate).toLocaleDateString() : null} />
            <DetailItem label="Days Since Contact" value={deal.daysSinceLastContact != null ? String(deal.daysSinceLastContact) : null} />
          </dl>

          {/* Long text fields */}
          {deal.keyTopics && <LongField label="Key Topics" value={deal.keyTopics} />}
          {deal.callOutcome && <LongField label="Call Outcome / Updates" value={deal.callOutcome} />}
          {deal.nextSteps && <LongField label="Next Steps" value={deal.nextSteps} />}
          {deal.aiCoachRecommendation && <LongField label="AI Coach Recommendation" value={deal.aiCoachRecommendation} accent />}
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

function Field({ label, value, onChange, type = "text", span }: { label: string; value: string; onChange: (v: string) => void; type?: string; span?: number }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
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

function LongField({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={accent ? "bg-indigo-50 rounded-lg p-3" : ""}>
      <p className={`text-xs font-semibold mb-1.5 ${accent ? "text-indigo-600" : "text-gray-400"}`}>{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}
