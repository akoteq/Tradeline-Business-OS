"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, fetcher } from "@/lib/api";
import { DataTable, type Column } from "@/components/DataTable";
import { PriorityBadge, TaskStatusBadge } from "@/components/Badges";
import { ClientSelect, type ClientOption } from "@/components/ClientSelect";
import { useAuth } from "@/components/AuthProvider";
import { useCompanies } from "@/lib/companies";

type Task = {
  id: string;
  year: number | null;
  priority: string;
  deliverable: string;
  targetDate: string | null;
  bdoId: string | null;
  bdo: { name: string } | null;
  status: string;
  company: string | null;
  notes: string | null;
  type: "TASK" | "PROPOSAL";
  smeId: string | null;
  clientName: string | null;
  proposalValueGhs: number | null;
  outcome: string | null;
};

type Bdo = { id: string; name: string; company: string };


const OUTCOME_OPTS = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "NO_RESPONSE"] as const;
const OUTCOME_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  NO_RESPONSE: "bg-amber-100 text-amber-700",
};

const fmt = (n: number) => `GHS ${n.toLocaleString()}`;
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const startOfToday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
const isOverdue = (t: Task) =>
  !!t.targetDate &&
  !["COMPLETED", "CANCELLED"].includes(t.status) &&
  new Date(t.targetDate) < startOfToday();

const OutcomeBadge = ({ value }: { value: string }) => (
  <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-medium", OUTCOME_COLORS[value] ?? "bg-gray-100 text-gray-500")}>
    {value.replace(/_/g, " ")}
  </span>
);

export default function TasksPage() {
  const { user } = useAuth();
  const isBdo = user?.role === "BDO";
  const myBdoId = user?.bdoId ?? null;

  const { companies, byKey } = useCompanies();
  const [view, setView] = useState<"" | "TASK" | "PROPOSAL">("");
  const [filters, setFilters] = useState({ priority: "", status: "", year: "", company: "", bdoId: "" });
  const [editing, setEditing] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const isProposalView = view === "PROPOSAL";

  // BDO users are always scoped to their own tasks; admins/CEO use the filter bar.
  const effective = {
    ...filters,
    type: view,
    ...(isBdo ? { bdoId: myBdoId ?? "" } : {}),
  };
  const params = new URLSearchParams(Object.fromEntries(Object.entries(effective).filter(([, v]) => v)));

  const { data = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks", effective],
    queryFn: () => fetcher(`/tasks?${params}`),
    enabled: !!user && (!isBdo || !!myBdoId),
  });

  const { data: bdos = [] } = useQuery<Bdo[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
    enabled: !isBdo,
  });

  const { data: smeRes } = useQuery<{ data: ClientOption[]; total: number }>({
    queryKey: ["sme-options"],
    queryFn: () => fetcher("/sme?limit=500"),
  });
  const clients = smeRes?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const done = data.filter((t) => t.status === "COMPLETED").length;
  const overdue = data.filter(isOverdue).length;

  // Proposal reporting
  const proposalValue = data.reduce((s, t) => s + (t.proposalValueGhs ?? 0), 0);
  const accepted = data.filter((t) => t.outcome === "ACCEPTED").length;
  const decided = data.filter((t) => ["ACCEPTED", "REJECTED", "NO_RESPONSE"].includes(t.outcome ?? "")).length;
  const winRate = decided > 0 ? Math.round((accepted / decided) * 100) : null;

  const columns: Column<Task>[] = [
    { key: "year", label: "Year", sortable: true, width: "60px" },
    { key: "priority", label: "Priority", render: (r) => <PriorityBadge value={r.priority} />, sortable: true },
    { key: "deliverable", label: isProposalView ? "Proposal" : "Task / Deliverable", sortable: true },
    ...(isProposalView ? [
      { key: "clientName", label: "Client", render: (r: Task) => r.clientName ?? "—" },
      { key: "proposalValueGhs", label: "Value", sortable: true, render: (r: Task) => r.proposalValueGhs ? fmt(r.proposalValueGhs) : "—" },
      { key: "outcome", label: "Outcome", render: (r: Task) => r.outcome ? <OutcomeBadge value={r.outcome} /> : "—" },
    ] : []),
    {
      key: "targetDate", label: isProposalView ? "Due / Sent" : "Target Date", sortable: true,
      render: (r: Task) => <span className={isOverdue(r) ? "text-red-600 font-medium" : ""}>{fmtDate(r.targetDate)}</span>,
      exportValue: (r: Task) => r.targetDate ?? "",
    },
    ...(isBdo ? [] : [{ key: "bdo", label: "BDO", render: (r: Task) => r.bdo?.name ?? "—" }]),
    { key: "company", label: "Company", render: (r: Task) => r.company ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.company === "BAPX" ? "bg-green-100 text-green-700" : r.company === "TRADELINE" ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700"}`}>{byKey[r.company]?.name ?? r.company}</span> : "—" },
    { key: "status", label: "Status", render: (r: Task) => <TaskStatusBadge value={r.status} />, sortable: true },
    { key: "notes", label: "Notes" },
  ];

  if (isBdo && !myBdoId) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Scheme of Work</h1>
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3">
          Your account isn’t linked to a BDO profile yet, so there are no items to show. Ask an admin to link your account.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isBdo ? "My Scheme of Work" : "Scheme of Work"}</h1>
          <p className="text-sm text-gray-500">
            {isProposalView
              ? (isBdo ? "Your client proposals" : "Client proposals across Tradeline & BAPX")
              : (isBdo ? "Your tasks and deliverables" : "All tasks and deliverables across Tradeline & BAPX")}
          </p>
        </div>
        <div className="flex gap-3">
          {isProposalView ? (
            <>
              <Stat label="Proposals" value={String(data.length)} tone="blue" />
              <Stat label="Total Value" value={fmt(proposalValue)} tone="blue" />
              <Stat label="Win Rate" value={winRate === null ? "—" : `${winRate}%`} tone="green" />
            </>
          ) : (
            <>
              <Stat label="Completed" value={`${done}/${data.length}`} tone="green" />
              <Stat label="Overdue" value={String(overdue)} tone="red" />
            </>
          )}
        </div>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {([["", "All"], ["TASK", "Tasks"], ["PROPOSAL", "Proposals"]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setView(val)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              view === val ? "border-indigo-500 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns} data={data} isLoading={isLoading} title={`${data.length} ${isProposalView ? "proposals" : "items"}`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => { if (confirm(`Delete "${row.deliverable}"?`)) deleteMutation.mutate(row.id); }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {["","HIGH","MEDIUM","LOW"].map((s) => <option key={s} value={s}>{s || "All Priorities"}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {["","PENDING","IN_PROGRESS","COMPLETED","OVERDUE","CANCELLED"].map((s) => <option key={s} value={s}>{s || "All Statuses"}</option>)}
            </select>
            <select value={filters.company} onChange={(e) => setFilters((f) => ({ ...f, company: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              <option value="">All Companies</option>
              {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
            {!isBdo && (
              <select value={filters.bdoId} onChange={(e) => setFilters((f) => ({ ...f, bdoId: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                <option value="">All BDOs</option>
                {bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}
              </select>
            )}
          </div>
        }
      />
      {showForm && (
        <TaskFormModal
          task={editing}
          bdos={bdos}
          clients={clients}
          isBdo={!!isBdo}
          myBdoId={myBdoId}
          defaultType={view === "PROPOSAL" ? "PROPOSAL" : "TASK"}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["tasks"] }); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "blue" }) {
  const styles: Record<string, string> = {
    green: "bg-green-50 border-green-200 text-green-700 text-green-600",
    red: "bg-red-50 border-red-200 text-red-700 text-red-600",
    blue: "bg-blue-50 border-blue-200 text-blue-700 text-blue-600",
  };
  const [bg, border, valueColor, labelColor] = styles[tone].split(" ");
  return (
    <div className={clsx("border rounded-lg px-3 py-2 text-center", bg, border)}>
      <div className={clsx("text-xs font-medium", labelColor)}>{label}</div>
      <div className={clsx("font-bold", valueColor)}>{value}</div>
    </div>
  );
}

function TaskFormModal({ task, bdos, clients, isBdo, myBdoId, defaultType, onClose, onSaved }: {
  task: Task | null;
  bdos: Bdo[];
  clients: ClientOption[];
  isBdo: boolean;
  myBdoId: string | null;
  defaultType: "TASK" | "PROPOSAL";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { companies } = useCompanies();
  const [form, setForm] = useState({
    year: task?.year ?? new Date().getFullYear(),
    priority: task?.priority ?? "MEDIUM",
    deliverable: task?.deliverable ?? "",
    targetDate: task?.targetDate ? task.targetDate.slice(0, 10) : "",
    status: task?.status ?? "PENDING",
    company: task?.company ?? "TRADELINE",
    bdoId: task?.bdoId ?? "",
    notes: task?.notes ?? "",
    type: task?.type ?? defaultType,
    smeId: task?.smeId ?? "",
    clientName: task?.clientName ?? "",
    proposalValueGhs: task?.proposalValueGhs != null ? String(task.proposalValueGhs) : "",
    outcome: task?.outcome ?? "DRAFT",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const isProposal = form.type === "PROPOSAL";

  const save = async () => {
    if (!form.deliverable.trim()) { setError(`A ${isProposal ? "proposal title" : "task / deliverable"} is required.`); return; }
    setSaving(true); setError("");
    const body = {
      year: form.year,
      priority: form.priority,
      deliverable: form.deliverable,
      status: form.status,
      company: form.company,
      notes: form.notes || null,
      targetDate: form.targetDate || null,
      bdoId: isBdo ? myBdoId : (form.bdoId || null),
      type: form.type,
      smeId: isProposal ? (form.smeId || null) : null,
      clientName: isProposal ? (form.clientName || null) : null,
      proposalValueGhs: isProposal && form.proposalValueGhs ? Number(form.proposalValueGhs) : null,
      outcome: isProposal ? form.outcome : null,
    };
    try {
      task ? await api.put(`/tasks/${task.id}`, body) : await api.post("/tasks", body);
      onSaved();
    } catch {
      setError("Failed to save. Check the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between"><h2 className="font-semibold">{task ? "Edit" : "Add"} {isProposal ? "Proposal" : "Task"}</h2><button onClick={onClose}>&times;</button></div>
        <div className="p-5 space-y-3">
          {/* Type toggle */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
            <div className="flex gap-2">
              {(["TASK", "PROPOSAL"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("type", t)}
                  className={clsx(
                    "flex-1 px-3 py-2 text-sm rounded-lg border transition-colors",
                    form.type === t ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {t === "TASK" ? "Task" : "Proposal"}
                </button>
              ))}
            </div>
          </div>

          <div><label className="text-xs font-medium text-gray-600 block mb-1">{isProposal ? "Proposal Title" : "Task / Deliverable"}</label><textarea value={form.deliverable} onChange={(e) => set("deliverable", e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" /></div>

          {/* Proposal-only fields */}
          {isProposal && (
            <>
              <ClientSelect
                label="Client"
                value={form.smeId}
                options={clients}
                fallbackLabel={form.clientName || undefined}
                onChange={(id) => {
                  const c = clients.find((o) => o.id === id);
                  setForm((f) => ({ ...f, smeId: id, clientName: c?.companyName ?? f.clientName }));
                }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 block mb-1">Proposal Value (GHS)</label><input type="number" min="0" value={form.proposalValueGhs} onChange={(e) => set("proposalValueGhs", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600 block mb-1">Outcome</label><select value={form.outcome} onChange={(e) => set("outcome", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">{OUTCOME_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Year</label><input type="number" value={form.year} onChange={(e) => set("year", parseInt(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">{isProposal ? "Due / Sent Date" : "Target Date"}</label><input type="date" value={form.targetDate} onChange={(e) => set("targetDate", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Priority</label><select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">{["HIGH","MEDIUM","LOW"].map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Status</label><select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">{["PENDING","IN_PROGRESS","COMPLETED","OVERDUE","CANCELLED"].map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Company</label><select value={form.company} onChange={(e) => set("company", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">{companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></div>
            {!isBdo && (
              <div><label className="text-xs font-medium text-gray-600 block mb-1">BDO</label><select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm"><option value="">— Unassigned —</option>{bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}</select></div>
            )}
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Notes</label><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></div>
      </div>
    </div>
  );
}
