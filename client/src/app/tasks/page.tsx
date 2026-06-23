"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { PriorityBadge, TaskStatusBadge } from "@/components/Badges";

type Task = {
  id: string;
  year: number | null;
  priority: string;
  deliverable: string;
  targetDate: string | null;
  bdo: { name: string } | null;
  status: string;
  company: string | null;
  notes: string | null;
};

export default function TasksPage() {
  const [filters, setFilters] = useState({ priority: "", status: "", year: "", company: "" });
  const [editing, setEditing] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
  const { data = [], isLoading } = useQuery<Task[]>({ queryKey: ["tasks", filters], queryFn: () => fetcher(`/tasks?${params}`) });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/tasks/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }) });

  const done = data.filter((t) => t.status === "COMPLETED").length;
  const overdue = data.filter((t) => t.status === "OVERDUE").length;

  const columns = [
    { key: "year", label: "Year", sortable: true, width: "60px" },
    { key: "priority", label: "Priority", render: (r: Task) => <PriorityBadge value={r.priority} />, sortable: true },
    { key: "deliverable", label: "Task / Deliverable", sortable: true },
    { key: "targetDate", label: "Target Date" },
    { key: "bdo", label: "Owner", render: (r: Task) => r.bdo?.name ?? "—" },
    { key: "company", label: "Company", render: (r: Task) => r.company ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.company === "TRADELINE" ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"}`}>{r.company}</span> : "—" },
    { key: "status", label: "Status", render: (r: Task) => <TaskStatusBadge value={r.status} />, sortable: true },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheme of Work</h1>
          <p className="text-sm text-gray-500">All tasks and deliverables across Tradeline & BAPX</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-green-600 font-medium">Completed</div>
            <div className="font-bold text-green-700">{done}/{data.length}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-red-600 font-medium">Overdue</div>
            <div className="font-bold text-red-700">{overdue}</div>
          </div>
        </div>
      </div>
      <DataTable
        columns={columns} data={data} isLoading={isLoading} title={`${data.length} tasks`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => { if (confirm(`Delete task "${row.deliverable}"?`)) deleteMutation.mutate(row.id); }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {["","HIGH","MEDIUM","LOW"].map((s) => <option key={s} value={s}>{s || "All Priorities"}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {["","PENDING","IN_PROGRESS","COMPLETED","OVERDUE","CANCELLED"].map((s) => <option key={s} value={s}>{s || "All Statuses"}</option>)}
            </select>
            <select value={filters.company} onChange={(e) => setFilters((f) => ({ ...f, company: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {["","TRADELINE","BAPX"].map((s) => <option key={s} value={s}>{s || "Both Companies"}</option>)}
            </select>
          </div>
        }
      />
      {showForm && <TaskFormModal task={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["tasks"] }); }} />}
    </div>
  );
}

function TaskFormModal({ task, onClose, onSaved }: { task: Task | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ year: task?.year ?? new Date().getFullYear(), priority: task?.priority ?? "MEDIUM", deliverable: task?.deliverable ?? "", targetDate: task?.targetDate ?? "", status: task?.status ?? "PENDING", company: task?.company ?? "TRADELINE", notes: task?.notes ?? "" });
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { task ? await api.put(`/tasks/${task.id}`, form) : await api.post("/tasks", form); onSaved(); } finally { setSaving(false); } };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between"><h2 className="font-semibold">{task ? "Edit Task" : "Add Task"}</h2><button onClick={onClose}>&times;</button></div>
        <div className="p-5 space-y-3">
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Task / Deliverable</label><textarea value={form.deliverable} onChange={(e) => setForm((f) => ({...f,deliverable:e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Year</label><input type="number" value={form.year} onChange={(e) => setForm((f) => ({...f,year:parseInt(e.target.value)}))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Target Date</label><input value={form.targetDate} onChange={(e) => setForm((f) => ({...f,targetDate:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. June" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Priority</label><select value={form.priority} onChange={(e) => setForm((f) => ({...f,priority:e.target.value}))} className="w-full border rounded-lg px-2 py-2 text-sm">{["HIGH","MEDIUM","LOW"].map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Status</label><select value={form.status} onChange={(e) => setForm((f) => ({...f,status:e.target.value}))} className="w-full border rounded-lg px-2 py-2 text-sm">{["PENDING","IN_PROGRESS","COMPLETED","OVERDUE","CANCELLED"].map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Company</label><select value={form.company} onChange={(e) => setForm((f) => ({...f,company:e.target.value}))} className="w-full border rounded-lg px-2 py-2 text-sm">{["TRADELINE","BAPX"].map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({...f,notes:e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></div>
      </div>
    </div>
  );
}
