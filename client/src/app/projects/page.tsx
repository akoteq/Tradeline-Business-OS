"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { useAuth } from "@/components/AuthProvider";
import { X } from "lucide-react";

type Project = {
  id: string;
  name: string;
  leader: string;
  status: string;
  company: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  ON_HOLD:   "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const COMPANY_COLORS: Record<string, string> = {
  BAPX:      "bg-indigo-100 text-indigo-700",
  TRADELINE: "bg-emerald-100 text-emerald-700",
  SHARED:    "bg-gray-100 text-gray-700",
};

const STATUS_LIST  = ["ACTIVE", "COMPLETED", "ON_HOLD", "CANCELLED"] as const;
const COMPANY_LIST = ["BAPX", "TRADELINE", "SHARED"] as const;

const EMPTY_FORM = {
  name: "", leader: "", status: "ACTIVE", company: "SHARED",
  description: "", startDate: "", endDate: "", notes: "",
};

export default function ProjectsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "CEO";
  const qc = useQueryClient();
  const [editing, setEditing]   = useState<Project | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail]     = useState<Project | null>(null);
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterCompany, setFilterCompany] = useState("");

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetcher("/projects"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["projects"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: invalidate,
  });

  const filtered = projects.filter((p) => {
    if (filterStatus  && p.status  !== filterStatus)  return false;
    if (filterCompany && p.company !== filterCompany) return false;
    return true;
  });

  const statusCounts = STATUS_LIST.reduce<Record<string, number>>((acc, s) => {
    acc[s] = projects.filter((p) => p.status === s).length;
    return acc;
  }, {});

  const columns = [
    {
      key: "name", label: "Project", sortable: true,
      render: (r: Project) => (
        <button
          onClick={() => setDetail(r)}
          className="text-left font-semibold text-indigo-700 hover:underline"
        >
          {r.name}
        </button>
      ),
    },
    { key: "leader", label: "Leader", sortable: true },
    {
      key: "status", label: "Status", sortable: true,
      render: (r: Project) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-500"}`}>
          {r.status.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "company", label: "Company",
      render: (r: Project) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COMPANY_COLORS[r.company] ?? "bg-gray-100 text-gray-500"}`}>
          {r.company}
        </span>
      ),
    },
    {
      key: "description", label: "Description",
      render: (r: Project) => r.description
        ? <span className="text-sm text-gray-500 truncate max-w-[220px] block" title={r.description}>{r.description}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: "startDate", label: "Start",
      render: (r: Project) => r.startDate ? new Date(r.startDate).toLocaleDateString() : <span className="text-gray-400">—</span>,
    },
    {
      key: "endDate", label: "End",
      render: (r: Project) => r.endDate ? new Date(r.endDate).toLocaleDateString() : <span className="text-gray-400">—</span>,
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <p className="text-sm text-gray-500 mt-1">{projects.length} project{projects.length !== 1 ? "s" : ""} across both companies</p>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_LIST.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
            className={`rounded-xl border p-3 text-left transition-all bg-white ${
              filterStatus === s ? "ring-2 ring-indigo-400 border-indigo-200" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium mb-2 ${STATUS_COLORS[s]}`}>
              {s.replace("_", " ")}
            </div>
            <div className="text-2xl font-bold text-gray-900">{statusCounts[s]}</div>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        title={`${filtered.length} project${filtered.length !== 1 ? "s" : ""}`}
        onAdd={isAdmin ? () => { setEditing(null); setShowForm(true); } : undefined}
        onEdit={isAdmin ? (row) => { setEditing(row); setShowForm(true); } : undefined}
        onDelete={isAdmin ? (row) => {
          if (confirm(`Delete project "${row.name}"?`)) deleteMutation.mutate(row.id);
        } : undefined}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All Statuses</option>
              {STATUS_LIST.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All Companies</option>
              {COMPANY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        }
      />

      {showForm && (
        <ProjectFormModal
          project={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); invalidate(); }}
        />
      )}

      {detail && (
        <DetailDrawer
          project={detail}
          onClose={() => setDetail(null)}
          onEdit={isAdmin ? () => { setEditing(detail); setDetail(null); setShowForm(true); } : undefined}
        />
      )}
    </div>
  );
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────────

function ProjectFormModal({
  project, onClose, onSaved,
}: {
  project: Project | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(project ? {
      name:        project.name,
      leader:      project.leader,
      status:      project.status,
      company:     project.company,
      description: project.description ?? "",
      startDate:   project.startDate ? project.startDate.slice(0, 10) : "",
      endDate:     project.endDate   ? project.endDate.slice(0, 10)   : "",
      notes:       project.notes ?? "",
    } : {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim())   { setError("Project name is required.");  return; }
    if (!form.leader.trim()) { setError("Leader name is required."); return; }
    setSaving(true); setError("");
    const body = {
      ...form,
      description: form.description || null,
      startDate:   form.startDate   || null,
      endDate:     form.endDate     || null,
      notes:       form.notes       || null,
    };
    try {
      project
        ? await api.put(`/projects/${project.id}`, body)
        : await api.post("/projects", body);
      onSaved();
    } catch {
      setError("Failed to save. Check the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-gray-900">{project ? "Edit Project" : "Add Project"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Project Name *" value={form.name}   onChange={(v) => set("name", v)}   span={2} />
            <Field label="Leader *"       value={form.leader} onChange={(v) => set("leader", v)} span={2} />

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Company</label>
              <select value={form.company} onChange={(e) => set("company", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="SHARED">SHARED</option>
                <option value="BAPX">BAPX</option>
                <option value="TRADELINE">TRADELINE</option>
              </select>
            </div>

            <Field label="Start Date" type="date" value={form.startDate} onChange={(v) => set("startDate", v)} />
            <Field label="End Date"   type="date" value={form.endDate}   onChange={(v) => set("endDate", v)} />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : project ? "Update Project" : "Add Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({
  project, onClose, onEdit,
}: {
  project: Project;
  onClose: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{project.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Leader: {project.leader}</p>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                Edit
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] ?? "bg-gray-100 text-gray-500"}`}>
              {project.status.replace("_", " ")}
            </span>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COMPANY_COLORS[project.company] ?? "bg-gray-100 text-gray-500"}`}>
              {project.company}
            </span>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DItem label="Start Date" value={project.startDate ? new Date(project.startDate).toLocaleDateString() : null} />
            <DItem label="End Date"   value={project.endDate   ? new Date(project.endDate).toLocaleDateString()   : null} />
          </dl>

          {project.description && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Description</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{project.description}</p>
            </div>
          )}

          {project.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{project.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = "text", span,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; span?: number;
}) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  );
}

function DItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 font-medium">{label}</dt>
      <dd className="text-gray-800 mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}
