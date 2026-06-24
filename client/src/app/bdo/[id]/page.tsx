"use client";

import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { PriorityBadge, TaskStatusBadge, DealHealthBadge, DealStageBadge } from "@/components/Badges";

type BDO = { id: string; name: string; email: string | null; company: string; role: string | null };
type Task = { id: string; year: number | null; priority: string; deliverable: string; targetDate: string | null; bdoId: string | null; status: string; company: string | null; notes: string | null };
type BapxDeal = { id: string; businessName: string; clientName: string | null; industry: string | null; region: string | null; telephone: string | null; email: string | null; dealStage: string; dealHealth: string; priority: string; activityType: string | null; keyTopics: string | null; callOutcome: string | null; nextSteps: string | null; targetGhs: number | null; bdo: { name: string } | null };
type TradelineDeal = { id: string; businessName: string; valueChain: string | null; tier: string; email: string | null; telephone: string | null; currentStatus: string | null; nextAction: string | null; requiredInvestment: string | null; revenuePotentialGhs: number | null; revenueReceivedGhs: number | null; balanceGhs: number | null; paymentStatus: string; dealStage: string; dealHealth: string; priority: string; bdo: { name: string } | null };
type Lead = { id: string; businessName: string; status: string; priority: string | null; source: string | null; followUpDate: string | null; contactPerson: string | null; email: string | null; roleTitle: string | null; notes: string | null };
type Grant = { id: string; clientName: string; grantLoanType: string | null; funderDfi: string | null; sectorValueChain: string | null; amountApplied: string | null; amountApproved: number | null; disbursed: number | null; status: string; commissionPct: number | null; commissionReceived: number | null; notes: string | null };
type CompanyDeal = { id: string; company: string; businessName: string; clientName: string | null; industry: string | null; dealStage: string; dealHealth: string; priority: string; paymentStatus: string | null; revenueReceivedGhs: number | null; balanceGhs: number | null; nextSteps: string | null; notes: string | null };

const COMPANY_LABELS: Record<string, string> = {
  ALPHA_AFRICA: "Alpha Africa", FINANCE_FACTORY: "Finance Factory",
  COMMUNITY_FINANCE: "Community Finance", AKOTEQ: "Akoteq",
};

const TABS = ["Tasks", "BAPX Deals", "Tradeline Deals", "Other Companies", "Leads", "Grants / Loans"] as const;
type Tab = typeof TABS[number];

export default function BdoDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>("Tasks");
  const qc = useQueryClient();

  const { data: bdo, isLoading: bdoLoading } = useQuery<BDO>({ queryKey: ["bdo", id], queryFn: () => fetcher(`/bdo/${id}`) });
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["tasks", { bdoId: id }], queryFn: () => fetcher(`/tasks?bdoId=${id}`) });
  const { data: bapxDeals = [] } = useQuery<BapxDeal[]>({ queryKey: ["bapx", { bdoId: id }], queryFn: () => fetcher(`/bapx?bdoId=${id}`) });
  const { data: tradelineDeals = [] } = useQuery<TradelineDeal[]>({ queryKey: ["tradeline", { bdoId: id }], queryFn: () => fetcher(`/tradeline?bdoId=${id}`) });
  const { data: leadsData } = useQuery<{ data: Lead[]; total: number }>({ queryKey: ["leads", { bdoId: id }], queryFn: () => fetcher(`/leads?bdoId=${id}&limit=200`) });
  const leads = leadsData?.data ?? [];
  const { data: grants = [] } = useQuery<Grant[]>({ queryKey: ["grants", { bdoId: id }], queryFn: () => fetcher(`/grant-loans?bdoId=${id}`) });
  const { data: companyDeals = [] } = useQuery<CompanyDeal[]>({ queryKey: ["company-deals", { bdoId: id }], queryFn: () => fetcher(`/company-deals?bdoId=${id}`) });

  // Modal state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingBapx, setEditingBapx] = useState<BapxDeal | null>(null);
  const [showBapxForm, setShowBapxForm] = useState(false);
  const [editingTradeline, setEditingTradeline] = useState<TradelineDeal | null>(null);
  const [showTradelineForm, setShowTradelineForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [editingCompanyDeal, setEditingCompanyDeal] = useState<CompanyDeal | null>(null);
  const [showCompanyDealForm, setShowCompanyDealForm] = useState(false);

  // Delete mutations
  const deleteTask = useMutation({ mutationFn: (tid: string) => api.delete(`/tasks/${tid}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", { bdoId: id }] }) });
  const deleteBapx = useMutation({ mutationFn: (did: string) => api.delete(`/bapx/${did}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["bapx", { bdoId: id }] }) });
  const deleteTradeline = useMutation({ mutationFn: (did: string) => api.delete(`/tradeline/${did}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["tradeline", { bdoId: id }] }) });
  const deleteLead = useMutation({ mutationFn: (lid: string) => api.delete(`/leads/${lid}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["leads", { bdoId: id }] }) });
  const deleteGrant = useMutation({ mutationFn: (gid: string) => api.delete(`/grant-loans/${gid}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["grants", { bdoId: id }] }) });
  const deleteCompanyDeal = useMutation({ mutationFn: (did: string) => api.delete(`/company-deals/${did}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["company-deals", { bdoId: id }] }) });

  if (bdoLoading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>;
  if (!bdo) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">BDO not found.</div>;

  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const overdueTasks = tasks.filter((t) => t.status === "OVERDUE").length;

  const taskColumns = [
    { key: "priority", label: "Priority", render: (r: Task) => <PriorityBadge value={r.priority} />, sortable: true },
    { key: "deliverable", label: "Task / Deliverable", sortable: true },
    { key: "targetDate", label: "Target Date" },
    { key: "status", label: "Status", render: (r: Task) => <TaskStatusBadge value={r.status} />, sortable: true },
    { key: "notes", label: "Notes" },
  ];

  const bapxColumns = [
    { key: "dealHealth", label: "Health", render: (r: BapxDeal) => <DealHealthBadge value={r.dealHealth} /> },
    { key: "businessName", label: "Business", sortable: true },
    { key: "clientName", label: "Client" },
    { key: "industry", label: "Industry" },
    { key: "dealStage", label: "Stage", render: (r: BapxDeal) => <DealStageBadge value={r.dealStage} /> },
    { key: "priority", label: "Priority", render: (r: BapxDeal) => <PriorityBadge value={r.priority} /> },
    { key: "targetGhs", label: "Target (GHS)", render: (r: BapxDeal) => r.targetGhs ? `GHS ${r.targetGhs.toLocaleString()}` : "—" },
    { key: "nextSteps", label: "Next Steps" },
  ];

  const tradelineColumns = [
    { key: "dealHealth", label: "Health", render: (r: TradelineDeal) => <DealHealthBadge value={r.dealHealth} /> },
    { key: "businessName", label: "Business", sortable: true },
    { key: "valueChain", label: "Value Chain" },
    { key: "tier", label: "Tier", render: (r: TradelineDeal) => <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{r.tier?.replace("_", " ")}</span> },
    { key: "dealStage", label: "Stage", render: (r: TradelineDeal) => <DealStageBadge value={r.dealStage} /> },
    { key: "priority", label: "Priority", render: (r: TradelineDeal) => <PriorityBadge value={r.priority} /> },
    { key: "revenueReceivedGhs", label: "Received (GHS)", render: (r: TradelineDeal) => r.revenueReceivedGhs ? `GHS ${r.revenueReceivedGhs.toLocaleString()}` : "—" },
    { key: "currentStatus", label: "Status / Update" },
  ];

  const leadColumns = [
    { key: "businessName", label: "Business", sortable: true },
    { key: "status", label: "Status", render: (r: Lead) => <StatusChip value={r.status} /> },
    { key: "priority", label: "Priority", render: (r: Lead) => r.priority ? <PriorityBadge value={r.priority} /> : <span className="text-gray-400">—</span> },
    { key: "contactPerson", label: "Contact" },
    { key: "source", label: "Source" },
    { key: "followUpDate", label: "Follow-up", render: (r: Lead) => r.followUpDate ? new Date(r.followUpDate).toLocaleDateString() : "—" },
  ];

  const grantColumns = [
    { key: "clientName", label: "Client", sortable: true },
    { key: "grantLoanType", label: "Type" },
    { key: "funderDfi", label: "Funder / DFI" },
    { key: "status", label: "Status", render: (r: Grant) => <StatusChip value={r.status.replace(/_/g, " ")} />, sortable: true },
    { key: "amountApplied", label: "Applied" },
    { key: "amountApproved", label: "Approved (GHS)", render: (r: Grant) => r.amountApproved != null ? `GHS ${r.amountApproved.toLocaleString()}` : "—" },
    { key: "commissionReceived", label: "Commission", render: (r: Grant) => r.commissionReceived != null ? `GHS ${r.commissionReceived.toLocaleString()}` : "—" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bdo.company === "TRADELINE" ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"}`}>
              {bdo.company}
            </span>
            {bdo.role && <span className="text-xs text-gray-500">{bdo.role}</span>}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{bdo.name}</h1>
          {bdo.email && <p className="text-sm text-gray-500 mt-0.5">{bdo.email}</p>}
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: "Tasks", value: tasks.length, color: "blue" },
            { label: "Completed", value: completedTasks, color: "green" },
            { label: "Overdue", value: overdueTasks, color: "red" },
            { label: "Deals", value: bapxDeals.length + tradelineDeals.length + companyDeals.length, color: "purple" },
            { label: "Leads", value: leads.length, color: "yellow" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-lg px-3 py-2 text-center min-w-[65px]`}>
              <div className={`text-xs text-${color}-600 font-medium`}>{label}</div>
              <div className={`font-bold text-${color}-700`}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "Tasks" && (
        <DataTable columns={taskColumns} data={tasks} title={`${tasks.length} task${tasks.length !== 1 ? "s" : ""}`}
          onAdd={() => { setEditingTask(null); setShowTaskForm(true); }}
          onEdit={(row) => { setEditingTask(row); setShowTaskForm(true); }}
          onDelete={(row) => { if (confirm(`Delete "${row.deliverable}"?`)) deleteTask.mutate(row.id); }}
        />
      )}

      {tab === "BAPX Deals" && (
        <DataTable columns={bapxColumns} data={bapxDeals} title={`${bapxDeals.length} BAPX deal${bapxDeals.length !== 1 ? "s" : ""}`}
          onAdd={() => { setEditingBapx(null); setShowBapxForm(true); }}
          onEdit={(row) => { setEditingBapx(row); setShowBapxForm(true); }}
          onDelete={(row) => { if (confirm(`Delete "${row.businessName}"?`)) deleteBapx.mutate(row.id); }}
        />
      )}

      {tab === "Tradeline Deals" && (
        <DataTable columns={tradelineColumns} data={tradelineDeals} title={`${tradelineDeals.length} Tradeline deal${tradelineDeals.length !== 1 ? "s" : ""}`}
          onAdd={() => { setEditingTradeline(null); setShowTradelineForm(true); }}
          onEdit={(row) => { setEditingTradeline(row); setShowTradelineForm(true); }}
          onDelete={(row) => { if (confirm(`Delete "${row.businessName}"?`)) deleteTradeline.mutate(row.id); }}
        />
      )}

      {tab === "Other Companies" && (
        <DataTable
          columns={[
            { key: "company",    label: "Company",  sortable: true, render: (r: CompanyDeal) => <span className="text-xs font-semibold text-indigo-700">{COMPANY_LABELS[r.company] ?? r.company}</span> },
            { key: "businessName", label: "Business", sortable: true },
            { key: "industry",   label: "Industry", render: (r: CompanyDeal) => r.industry ?? "—" },
            { key: "dealStage",  label: "Stage",    render: (r: CompanyDeal) => <DealStageBadge  value={r.dealStage} />, sortable: true },
            { key: "dealHealth", label: "Health",   render: (r: CompanyDeal) => <DealHealthBadge value={r.dealHealth} />, sortable: true },
            { key: "priority",   label: "Priority", render: (r: CompanyDeal) => <PriorityBadge   value={r.priority} />, sortable: true },
            { key: "revenueReceivedGhs", label: "Received", render: (r: CompanyDeal) => r.revenueReceivedGhs != null ? `GHS ${r.revenueReceivedGhs.toLocaleString()}` : "—" },
            { key: "nextSteps",  label: "Next Steps", render: (r: CompanyDeal) => r.nextSteps ?? "—" },
          ]}
          data={companyDeals}
          title={`${companyDeals.length} deal${companyDeals.length !== 1 ? "s" : ""} across other companies`}
          onAdd={() => { setEditingCompanyDeal(null); setShowCompanyDealForm(true); }}
          onEdit={(row) => { setEditingCompanyDeal(row); setShowCompanyDealForm(true); }}
          onDelete={(row) => { if (confirm(`Delete "${row.businessName}"?`)) deleteCompanyDeal.mutate(row.id); }}
        />
      )}

      {tab === "Leads" && (
        <DataTable columns={leadColumns} data={leads} title={`${leads.length} lead${leads.length !== 1 ? "s" : ""}`}
          onAdd={() => { setEditingLead(null); setShowLeadForm(true); }}
          onEdit={(row) => { setEditingLead(row); setShowLeadForm(true); }}
          onDelete={(row) => { if (confirm(`Delete "${row.businessName}"?`)) deleteLead.mutate(row.id); }}
        />
      )}

      {tab === "Grants / Loans" && (
        <DataTable columns={grantColumns} data={grants} title={`${grants.length} record${grants.length !== 1 ? "s" : ""}`}
          onAdd={() => { setEditingGrant(null); setShowGrantForm(true); }}
          onEdit={(row) => { setEditingGrant(row); setShowGrantForm(true); }}
          onDelete={(row) => { if (confirm(`Delete "${row.clientName}"?`)) deleteGrant.mutate(row.id); }}
        />
      )}

      {/* Modals */}
      {showTaskForm && (
        <TaskFormModal task={editingTask} bdoId={id} bdoCompany={bdo.company}
          onClose={() => setShowTaskForm(false)}
          onSaved={() => { setShowTaskForm(false); qc.invalidateQueries({ queryKey: ["tasks", { bdoId: id }] }); }}
        />
      )}
      {showBapxForm && (
        <BapxFormModal deal={editingBapx} bdoId={id}
          onClose={() => setShowBapxForm(false)}
          onSaved={() => { setShowBapxForm(false); qc.invalidateQueries({ queryKey: ["bapx", { bdoId: id }] }); }}
        />
      )}
      {showTradelineForm && (
        <TradelineFormModal deal={editingTradeline} bdoId={id}
          onClose={() => setShowTradelineForm(false)}
          onSaved={() => { setShowTradelineForm(false); qc.invalidateQueries({ queryKey: ["tradeline", { bdoId: id }] }); }}
        />
      )}
      {showLeadForm && (
        <LeadFormModal lead={editingLead} bdoId={id}
          onClose={() => setShowLeadForm(false)}
          onSaved={() => { setShowLeadForm(false); qc.invalidateQueries({ queryKey: ["leads", { bdoId: id }] }); }}
        />
      )}
      {showGrantForm && (
        <GrantFormModal grant={editingGrant} bdoId={id}
          onClose={() => setShowGrantForm(false)}
          onSaved={() => { setShowGrantForm(false); qc.invalidateQueries({ queryKey: ["grants", { bdoId: id }] }); }}
        />
      )}
      {showCompanyDealForm && (
        <CompanyDealFormModal deal={editingCompanyDeal} bdoId={id}
          onClose={() => setShowCompanyDealForm(false)}
          onSaved={() => { setShowCompanyDealForm(false); qc.invalidateQueries({ queryKey: ["company-deals", { bdoId: id }] }); }}
        />
      )}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function StatusChip({ value }: { value: string }) {
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{value}</span>;
}

function ModalShell({ title, onClose, children, onSave, saving, disabled }: { title: string; onClose: () => void; children: React.ReactNode; onSave: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg text-gray-600">Cancel</button>
          <button onClick={onSave} disabled={saving || disabled} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>{children}</div>;
}

const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";
const sel = "w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";

// ── Task Form ─────────────────────────────────────────────────────────────────

function TaskFormModal({ task, bdoId, bdoCompany, onClose, onSaved }: { task: Task | null; bdoId: string; bdoCompany: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ year: task?.year ?? new Date().getFullYear(), priority: task?.priority ?? "MEDIUM", deliverable: task?.deliverable ?? "", targetDate: task?.targetDate ?? "", status: task?.status ?? "PENDING", company: task?.company ?? bdoCompany, notes: task?.notes ?? "", bdoId });
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { task ? await api.put(`/tasks/${task.id}`, form) : await api.post("/tasks", form); onSaved(); } finally { setSaving(false); } };
  return (
    <ModalShell title={task ? "Edit Task" : "Add Task"} onClose={onClose} onSave={save} saving={saving} disabled={!form.deliverable.trim()}>
      <Field label="Task / Deliverable"><textarea value={form.deliverable} onChange={(e) => setForm((f) => ({ ...f, deliverable: e.target.value }))} rows={2} className={inp} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Year"><input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value) }))} className={inp} /></Field>
        <Field label="Target Date"><input value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} className={inp} placeholder="e.g. June" /></Field>
        <Field label="Priority"><select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className={sel}>{["HIGH","MEDIUM","LOW"].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Status"><select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={sel}>{["PENDING","IN_PROGRESS","COMPLETED","OVERDUE","CANCELLED"].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Company"><select value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} className={sel}>{["TRADELINE","BAPX"].map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={inp} /></Field>
    </ModalShell>
  );
}

// ── BAPX Deal Form ────────────────────────────────────────────────────────────

function BapxFormModal({ deal, bdoId, onClose, onSaved }: { deal: BapxDeal | null; bdoId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ businessName: deal?.businessName ?? "", clientName: deal?.clientName ?? "", industry: deal?.industry ?? "", region: deal?.region ?? "", telephone: deal?.telephone ?? "", email: deal?.email ?? "", dealStage: deal?.dealStage ?? "QUALIFICATION", dealHealth: deal?.dealHealth ?? "ACTIVE", priority: deal?.priority ?? "MEDIUM", activityType: deal?.activityType ?? "", keyTopics: deal?.keyTopics ?? "", callOutcome: deal?.callOutcome ?? "", nextSteps: deal?.nextSteps ?? "", targetGhs: deal?.targetGhs ?? "", bdoId });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => { setSaving(true); setError(""); try { deal ? await api.put(`/bapx/${deal.id}`, form) : await api.post("/bapx", form); onSaved(); } catch { setError("Failed to save."); } finally { setSaving(false); } };
  return (
    <ModalShell title={deal ? "Edit BAPX Deal" : "Add BAPX Deal"} onClose={onClose} onSave={save} saving={saving} disabled={!form.businessName.trim()}>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {[["businessName","Business Name"],["clientName","Client Name"],["industry","Industry / Value Chain"],["region","Region"],["telephone","Telephone"],["email","Email"],["activityType","Activity Type"]].map(([k,l]) => (
        <Field key={k} label={l}><input value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={inp} /></Field>
      ))}
      <Field label="Target (GHS)"><input type="number" value={String(form.targetGhs)} onChange={(e) => setForm((f) => ({ ...f, targetGhs: e.target.value }))} className={inp} /></Field>
      <div className="grid grid-cols-3 gap-3">
        {([["dealStage","Stage",["QUALIFICATION","DISCOVERY","PROPOSAL_SENT","NEGOTIATION","CONTRACT_REVIEW","CLOSED_WON","CLOSED_LOST","ON_HOLD"]],["dealHealth","Health",["ACTIVE","STALE","AT_RISK","CLOSED_WON","CLOSED_LOST"]],["priority","Priority",["HIGH","MEDIUM","LOW"]]] as [string,string,string[]][]).map(([k,l,opts]) => (
          <Field key={k} label={l}><select value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={sel}>{opts.map((o) => <option key={o} value={o}>{o.replace(/_/g," ")}</option>)}</select></Field>
        ))}
      </div>
      <Field label="Key Topics"><textarea value={form.keyTopics} onChange={(e) => setForm((f) => ({ ...f, keyTopics: e.target.value }))} rows={2} className={inp} /></Field>
      <Field label="Call Outcome / Updates"><textarea value={form.callOutcome} onChange={(e) => setForm((f) => ({ ...f, callOutcome: e.target.value }))} rows={2} className={inp} /></Field>
      <Field label="Next Steps"><textarea value={form.nextSteps} onChange={(e) => setForm((f) => ({ ...f, nextSteps: e.target.value }))} rows={2} className={inp} /></Field>
    </ModalShell>
  );
}

// ── Tradeline Deal Form ───────────────────────────────────────────────────────

function TradelineFormModal({ deal, bdoId, onClose, onSaved }: { deal: TradelineDeal | null; bdoId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ businessName: deal?.businessName ?? "", valueChain: deal?.valueChain ?? "", tier: deal?.tier ?? "TIER_1", email: deal?.email ?? "", telephone: deal?.telephone ?? "", currentStatus: deal?.currentStatus ?? "", nextAction: deal?.nextAction ?? "", requiredInvestment: deal?.requiredInvestment ?? "", revenuePotentialGhs: deal?.revenuePotentialGhs ?? "", revenueReceivedGhs: deal?.revenueReceivedGhs ?? "", balanceGhs: deal?.balanceGhs ?? "", paymentStatus: deal?.paymentStatus ?? "UNPAID", dealStage: deal?.dealStage ?? "QUALIFICATION", dealHealth: deal?.dealHealth ?? "ACTIVE", priority: deal?.priority ?? "MEDIUM", bdoId });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => { setSaving(true); setError(""); try { deal ? await api.put(`/tradeline/${deal.id}`, form) : await api.post("/tradeline", form); onSaved(); } catch { setError("Failed to save."); } finally { setSaving(false); } };
  return (
    <ModalShell title={deal ? "Edit Tradeline Deal" : "Add Tradeline Deal"} onClose={onClose} onSave={save} saving={saving} disabled={!form.businessName.trim()}>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {[["businessName","Business Name"],["valueChain","Value Chain"],["email","Email"],["telephone","Telephone"],["requiredInvestment","Required Investment"]].map(([k,l]) => (
        <Field key={k} label={l}><input value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={inp} /></Field>
      ))}
      <div className="grid grid-cols-2 gap-3">
        {[["revenuePotentialGhs","Revenue Potential (GHS)"],["revenueReceivedGhs","Revenue Received (GHS)"],["balanceGhs","Balance (GHS)"]].map(([k,l]) => (
          <Field key={k} label={l}><input type="number" value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={inp} /></Field>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {([["tier","Tier",["TIER_1","TIER_2","TIER_3"]],["dealStage","Stage",["QUALIFICATION","DISCOVERY","PROPOSAL_SENT","NEGOTIATION","CONTRACT_REVIEW","CLOSED_WON","CLOSED_LOST","ON_HOLD"]],["dealHealth","Health",["ACTIVE","STALE","AT_RISK","CLOSED_WON","CLOSED_LOST"]],["priority","Priority",["HIGH","MEDIUM","LOW"]],["paymentStatus","Payment",["PAID","UNPAID","PARTIAL","OVERDUE"]]] as [string,string,string[]][]).map(([k,l,opts]) => (
          <Field key={k} label={l}><select value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={sel}>{opts.map((o) => <option key={o} value={o}>{o.replace(/_/g," ")}</option>)}</select></Field>
        ))}
      </div>
      <Field label="Current Status / Updates"><textarea value={form.currentStatus} onChange={(e) => setForm((f) => ({ ...f, currentStatus: e.target.value }))} rows={2} className={inp} /></Field>
      <Field label="Next Action Required"><textarea value={form.nextAction} onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))} rows={2} className={inp} /></Field>
    </ModalShell>
  );
}

// ── Lead Form ─────────────────────────────────────────────────────────────────

function LeadFormModal({ lead, bdoId, onClose, onSaved }: { lead: Lead | null; bdoId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ businessName: lead?.businessName ?? "", email: lead?.email ?? "", contactPerson: lead?.contactPerson ?? "", roleTitle: lead?.roleTitle ?? "", source: lead?.source ?? "", status: lead?.status ?? "NEW", priority: lead?.priority ?? "MEDIUM", notes: lead?.notes ?? "", bdoId });
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { lead ? await api.put(`/leads/${lead.id}`, form) : await api.post("/leads", form); onSaved(); } finally { setSaving(false); } };
  return (
    <ModalShell title={lead ? "Edit Lead" : "Add Lead"} onClose={onClose} onSave={save} saving={saving} disabled={!form.businessName.trim()}>
      {[["businessName","Business Name"],["email","Email"],["contactPerson","Contact Person"],["roleTitle","Role / Title"],["source","Source"]].map(([k,l]) => (
        <Field key={k} label={l}><input value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={inp} /></Field>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status"><select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={sel}>{["NEW","CONTACTED","QUALIFIED","IN_PROGRESS","CONVERTED","LOST"].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Priority"><select value={form.priority ?? "MEDIUM"} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className={sel}>{["HIGH","MEDIUM","LOW"].map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={inp} /></Field>
    </ModalShell>
  );
}

// ── Company Deal Form ─────────────────────────────────────────────────────────

function CompanyDealFormModal({ deal, bdoId, onClose, onSaved }: { deal: CompanyDeal | null; bdoId: string; onClose: () => void; onSaved: () => void }) {
  const COMPANY_KEYS = ["ALPHA_AFRICA", "FINANCE_FACTORY", "COMMUNITY_FINANCE", "AKOTEQ"];
  const [form, setForm] = useState({
    company: deal?.company ?? "ALPHA_AFRICA",
    businessName: deal?.businessName ?? "", clientName: deal?.clientName ?? "",
    industry: deal?.industry ?? "", dealStage: deal?.dealStage ?? "QUALIFICATION",
    dealHealth: deal?.dealHealth ?? "ACTIVE", priority: deal?.priority ?? "MEDIUM",
    paymentStatus: deal?.paymentStatus ?? "UNPAID",
    revenueReceivedGhs: deal?.revenueReceivedGhs ?? "", balanceGhs: deal?.balanceGhs ?? "",
    nextSteps: deal?.nextSteps ?? "", notes: deal?.notes ?? "", bdoId,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true); setError("");
    try {
      deal ? await api.put(`/company-deals/${deal.id}`, form) : await api.post("/company-deals", form);
      onSaved();
    } catch { setError("Failed to save."); } finally { setSaving(false); }
  };
  return (
    <ModalShell title={deal ? "Edit Deal" : "Add Deal"} onClose={onClose} onSave={save} saving={saving} disabled={!form.businessName.trim()}>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Field label="Company">
        <select value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} className={sel}>
          {COMPANY_KEYS.map((k) => <option key={k} value={k}>{COMPANY_LABELS[k]}</option>)}
        </select>
      </Field>
      {[["businessName","Business Name"],["clientName","Client Name"],["industry","Industry"]].map(([k,l]) => (
        <Field key={k} label={l}><input value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={inp} /></Field>
      ))}
      <div className="grid grid-cols-2 gap-3">
        {([["dealStage","Stage",["QUALIFICATION","DISCOVERY","PROPOSAL_SENT","NEGOTIATION","CONTRACT_REVIEW","CLOSED_WON","CLOSED_LOST","ON_HOLD"]],["dealHealth","Health",["ACTIVE","STALE","AT_RISK","CLOSED_WON","CLOSED_LOST"]],["priority","Priority",["HIGH","MEDIUM","LOW"]],["paymentStatus","Payment",["PAID","UNPAID","PARTIAL","OVERDUE"]]] as [string,string,string[]][]).map(([k,l,opts]) => (
          <Field key={k} label={l}><select value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={sel}>{opts.map((o) => <option key={o} value={o}>{o.replace(/_/g," ")}</option>)}</select></Field>
        ))}
        {[["revenueReceivedGhs","Revenue Received (GHS)"],["balanceGhs","Balance (GHS)"]].map(([k,l]) => (
          <Field key={k} label={l}><input type="number" value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={inp} /></Field>
        ))}
      </div>
      <Field label="Next Steps"><textarea value={form.nextSteps} onChange={(e) => setForm((f) => ({ ...f, nextSteps: e.target.value }))} rows={2} className={inp} /></Field>
      <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={inp} /></Field>
    </ModalShell>
  );
}

// ── Grant / Loan Form ─────────────────────────────────────────────────────────

function GrantFormModal({ grant, bdoId, onClose, onSaved }: { grant: Grant | null; bdoId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ clientName: grant?.clientName ?? "", grantLoanType: grant?.grantLoanType ?? "", funderDfi: grant?.funderDfi ?? "", sectorValueChain: grant?.sectorValueChain ?? "", amountApplied: grant?.amountApplied ?? "", amountApproved: grant?.amountApproved ?? "", disbursed: grant?.disbursed ?? "", status: grant?.status ?? "SUBMITTED", commissionPct: grant?.commissionPct ?? 10, commissionReceived: grant?.commissionReceived ?? "", notes: grant?.notes ?? "", bdoId });
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { grant ? await api.put(`/grant-loans/${grant.id}`, form) : await api.post("/grant-loans", form); onSaved(); } finally { setSaving(false); } };
  return (
    <ModalShell title={grant ? "Edit Grant / Loan" : "Add Grant / Loan"} onClose={onClose} onSave={save} saving={saving} disabled={!form.clientName.trim()}>
      {[["clientName","Client Name"],["grantLoanType","Grant / Loan Type"],["funderDfi","Funder / DFI"],["sectorValueChain","Sector / Value Chain"],["amountApplied","Amount Applied"]].map(([k,l]) => (
        <Field key={k} label={l}><input value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={inp} /></Field>
      ))}
      <div className="grid grid-cols-2 gap-3">
        {[["amountApproved","Approved (GHS)"],["disbursed","Disbursed (GHS)"],["commissionPct","Commission %"],["commissionReceived","Commission Received (GHS)"]].map(([k,l]) => (
          <Field key={k} label={l}><input type="number" value={String(form[k as keyof typeof form])} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={inp} /></Field>
        ))}
        <Field label="Status"><select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={sel}>{["DRAFT","SUBMITTED","UNDER_REVIEW","APPROVED","DISBURSED","REJECTED","WITHDRAWN"].map((s) => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}</select></Field>
      </div>
      <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={inp} /></Field>
    </ModalShell>
  );
}
