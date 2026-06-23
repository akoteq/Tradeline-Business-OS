"use client";

import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { PriorityBadge, TaskStatusBadge } from "@/components/Badges";

type BDO = { id: string; name: string; email: string | null; company: string; role: string | null };
type Task = { id: string; year: number | null; priority: string; deliverable: string; targetDate: string | null; bdoId: string | null; status: string; company: string | null; notes: string | null };
type Deal = { id: string; businessName: string; dealStage: string; dealHealth: string; priority: string; targetGhs?: number | null; revenuePotentialGhs?: number | null; bdo: { name: string } | null };
type Lead = { id: string; businessName: string; status: string; priority: string | null; source: string | null; followUpDate: string | null };
type Grant = { id: string; clientName: string; grantLoanType: string | null; status: string; amountApplied: string | null; amountApproved: number | null };

const TABS = ["Tasks", "BAPX Deals", "Tradeline Deals", "Leads", "Grants / Loans"] as const;
type Tab = typeof TABS[number];

export default function BdoDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>("Tasks");
  const qc = useQueryClient();

  const { data: bdo, isLoading: bdoLoading } = useQuery<BDO>({ queryKey: ["bdo", id], queryFn: () => fetcher(`/bdo/${id}`) });
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["tasks", { bdoId: id }], queryFn: () => fetcher(`/tasks?bdoId=${id}`) });
  const { data: bapxDeals = [] } = useQuery<Deal[]>({ queryKey: ["bapx", { bdoId: id }], queryFn: () => fetcher(`/bapx?bdoId=${id}`) });
  const { data: tradelineDeals = [] } = useQuery<Deal[]>({ queryKey: ["tradeline", { bdoId: id }], queryFn: () => fetcher(`/tradeline?bdoId=${id}`) });
  const { data: leadsData } = useQuery<{ data: Lead[]; total: number }>({ queryKey: ["leads", { bdoId: id }], queryFn: () => fetcher(`/leads?bdoId=${id}&limit=200`) });
  const leads = leadsData?.data ?? [];
  const { data: grants = [] } = useQuery<Grant[]>({ queryKey: ["grants", { bdoId: id }], queryFn: () => fetcher(`/grant-loans?bdoId=${id}`) });

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const deleteTask = useMutation({ mutationFn: (tid: string) => api.delete(`/tasks/${tid}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", { bdoId: id }] }) });

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

  const dealColumns = [
    { key: "businessName", label: "Business", sortable: true },
    { key: "dealStage", label: "Stage", sortable: true },
    { key: "dealHealth", label: "Health", render: (r: Deal) => <HealthBadge value={r.dealHealth} /> },
    { key: "priority", label: "Priority", render: (r: Deal) => <PriorityBadge value={r.priority} /> },
  ];

  const leadColumns = [
    { key: "businessName", label: "Business", sortable: true },
    { key: "status", label: "Status", render: (r: Lead) => <StatusChip value={r.status} /> },
    { key: "priority", label: "Priority", render: (r: Lead) => r.priority ? <PriorityBadge value={r.priority} /> : <span className="text-gray-400">—</span> },
    { key: "source", label: "Source" },
    { key: "followUpDate", label: "Follow-up" },
  ];

  const grantColumns = [
    { key: "clientName", label: "Client", sortable: true },
    { key: "grantLoanType", label: "Type" },
    { key: "status", label: "Status", sortable: true },
    { key: "amountApplied", label: "Applied" },
    { key: "amountApproved", label: "Approved (GHS)", render: (r: Grant) => r.amountApproved != null ? r.amountApproved.toLocaleString() : "—" },
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
            { label: "Deals", value: bapxDeals.length + tradelineDeals.length, color: "purple" },
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
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "Tasks" && (
        <DataTable
          columns={taskColumns}
          data={tasks}
          title={`${tasks.length} task${tasks.length !== 1 ? "s" : ""}`}
          onAdd={() => { setEditingTask(null); setShowTaskForm(true); }}
          onEdit={(row) => { setEditingTask(row); setShowTaskForm(true); }}
          onDelete={(row) => { if (confirm(`Delete "${row.deliverable}"?`)) deleteTask.mutate(row.id); }}
        />
      )}

      {tab === "BAPX Deals" && (
        <DataTable columns={dealColumns} data={bapxDeals} title={`${bapxDeals.length} BAPX deal${bapxDeals.length !== 1 ? "s" : ""}`} />
      )}

      {tab === "Tradeline Deals" && (
        <DataTable columns={dealColumns} data={tradelineDeals} title={`${tradelineDeals.length} Tradeline deal${tradelineDeals.length !== 1 ? "s" : ""}`} />
      )}

      {tab === "Leads" && (
        <DataTable columns={leadColumns} data={leads} title={`${leads.length} lead${leads.length !== 1 ? "s" : ""}`} />
      )}

      {tab === "Grants / Loans" && (
        <DataTable columns={grantColumns} data={grants} title={`${grants.length} record${grants.length !== 1 ? "s" : ""}`} />
      )}

      {showTaskForm && (
        <TaskFormModal
          task={editingTask}
          bdoId={id}
          bdoCompany={bdo.company}
          onClose={() => setShowTaskForm(false)}
          onSaved={() => { setShowTaskForm(false); qc.invalidateQueries({ queryKey: ["tasks", { bdoId: id }] }); }}
        />
      )}
    </div>
  );
}

function HealthBadge({ value }: { value: string }) {
  const colors: Record<string, string> = { ACTIVE: "bg-green-100 text-green-700", STALE: "bg-yellow-100 text-yellow-700", AT_RISK: "bg-orange-100 text-orange-700", CLOSED_WON: "bg-blue-100 text-blue-700", CLOSED_LOST: "bg-red-100 text-red-700" };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[value] ?? "bg-gray-100 text-gray-600"}`}>{value.replace("_", " ")}</span>;
}

function StatusChip({ value }: { value: string }) {
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{value}</span>;
}

function TaskFormModal({ task, bdoId, bdoCompany, onClose, onSaved }: { task: Task | null; bdoId: string; bdoCompany: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ year: task?.year ?? new Date().getFullYear(), priority: task?.priority ?? "MEDIUM", deliverable: task?.deliverable ?? "", targetDate: task?.targetDate ?? "", status: task?.status ?? "PENDING", company: task?.company ?? bdoCompany, notes: task?.notes ?? "", bdoId });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      task ? await api.put(`/tasks/${task.id}`, form) : await api.post("/tasks", form);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between"><h2 className="font-semibold">{task ? "Edit Task" : "Add Task"}</h2><button onClick={onClose}>&times;</button></div>
        <div className="p-5 space-y-3">
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Task / Deliverable</label><textarea value={form.deliverable} onChange={(e) => setForm((f) => ({ ...f, deliverable: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Year</label><input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Target Date</label><input value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. June" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Priority</label><select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm">{["HIGH", "MEDIUM", "LOW"].map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Status</label><select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm">{["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Company</label><select value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm">{["TRADELINE", "BAPX"].map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving || !form.deliverable.trim()} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
