"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type BdoRow = {
  id: string;
  name: string;
  company: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  bapxDeals: number;
  tradelineDeals: number;
  leads: number;
  openTasks: number;
  overdueTasks: number;
  revenueReceived: number;
};

type BdoDetail = {
  bdo: { id: string; name: string; email: string | null; phone: string | null; company: string; role: string | null };
  bapxDeals: Array<{ id: string; businessName: string; dealStage: string; dealHealth: string; priority: string }>;
  tradelineDeals: Array<{ id: string; businessName: string; dealStage: string; dealHealth: string; priority: string }>;
  leads: Array<{ id: string; businessName: string; status: string }>;
  tasks: Array<{ id: string; deliverable: string; status: string; priority: string }>;
};

type BdoPerf = {
  bdo: { id: string; name: string; email: string | null; phone: string | null; company: string; role: string | null; isActive: boolean };
  bapxDeals: number;
  tradelineDeals: number;
  leads: number;
  tasks: { total: number; open: number; completed: number; overdue: number };
  revenue: { received: number; potential: number };
};

const COMPANY_OPTS = ["BAPX", "TRADELINE"] as const;
const EMPTY_FORM = { name: "", email: "", phone: "", company: "BAPX", role: "" };

const HEALTH_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  STALE: "bg-yellow-100 text-yellow-700",
  AT_RISK: "bg-orange-100 text-orange-700",
  CLOSED_WON: "bg-blue-100 text-blue-700",
  CLOSED_LOST: "bg-red-100 text-red-700",
  NEW: "bg-gray-100 text-gray-600",
  CONTACTED: "bg-blue-100 text-blue-700",
  QUALIFIED: "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  CONVERTED: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
  PENDING: "bg-gray-100 text-gray-600",
  COMPLETED: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-400",
};

const fmt = (n: number) => `GHS ${n.toLocaleString()}`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BdoManagementPage() {
  const [companyFilter, setCompanyFilter] = useState("");
  const [editing, setEditing] = useState<BdoRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<BdoRow | null>(null);
  const qc = useQueryClient();

  const { data: perf = [], isLoading } = useQuery<BdoPerf[]>({
    queryKey: ["bdo-performance"],
    queryFn: () => fetcher("/bdo/performance"),
  });

  const { data: bdoDetail } = useQuery<BdoDetail>({
    queryKey: ["bdo-detail", detail?.id],
    queryFn: () => fetcher(`/dashboard/bdo/${detail!.id}`),
    enabled: !!detail,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bdo/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bdo-performance"] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to delete BDO";
      alert(msg);
    },
  });

  const rows: BdoRow[] = perf
    .filter((p) => !companyFilter || p.bdo.company === companyFilter)
    .map((p) => ({
      id: p.bdo.id,
      name: p.bdo.name,
      company: p.bdo.company,
      role: p.bdo.role,
      email: p.bdo.email,
      phone: p.bdo.phone,
      bapxDeals: p.bapxDeals,
      tradelineDeals: p.tradelineDeals,
      leads: p.leads,
      openTasks: p.tasks.open,
      overdueTasks: p.tasks.overdue,
      revenueReceived: p.revenue.received,
    }));

  const columns = [
    {
      key: "company", label: "Company", width: "100px",
      render: (r: BdoRow) => (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.company === "BAPX" ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700"}`}>
          {r.company}
        </span>
      ),
    },
    {
      key: "name", label: "Name", sortable: true,
      render: (r: BdoRow) => (
        <button onClick={() => setDetail(r)} className="text-left font-medium text-indigo-700 hover:underline">
          {r.name}
        </button>
      ),
    },
    { key: "role", label: "Role", render: (r: BdoRow) => r.role ?? "—" },
    { key: "email", label: "Email", render: (r: BdoRow) => r.email ?? "—" },
    { key: "bapxDeals", label: "BAPX Deals", sortable: true, render: (r: BdoRow) => r.bapxDeals },
    { key: "tradelineDeals", label: "TL Deals", sortable: true, render: (r: BdoRow) => r.tradelineDeals },
    { key: "leads", label: "Leads", sortable: true, render: (r: BdoRow) => r.leads },
    {
      key: "openTasks", label: "Open Tasks", sortable: true,
      render: (r: BdoRow) => (
        <span className={r.overdueTasks > 0 ? "text-red-600 font-medium" : ""}>
          {r.openTasks}{r.overdueTasks > 0 ? ` (${r.overdueTasks} overdue)` : ""}
        </span>
      ),
    },
    {
      key: "revenueReceived", label: "Revenue Received", sortable: true,
      render: (r: BdoRow) => r.revenueReceived > 0 ? fmt(r.revenueReceived) : "—",
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">BDO Performance</h1>
        <p className="text-sm text-gray-500 mt-1">{rows.length} Business Development Officers</p>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        title={`${rows.length} BDOs`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => {
          if (confirm(`Deactivate ${row.name}?`)) deleteMutation.mutate(row.id);
        }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <FilterSelect
              value={companyFilter}
              options={[{ value: "", label: "All Companies" }, ...COMPANY_OPTS.map((c) => ({ value: c, label: c }))]}
              onChange={setCompanyFilter}
            />
          </div>
        }
      />

      {showForm && (
        <BdoFormModal
          row={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["bdo-performance"] }); }}
        />
      )}

      {detail && (
        <DetailDrawer
          row={detail}
          detail={bdoDetail ?? null}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); setShowForm(true); }}
        />
      )}
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

// ─── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ row, detail, onClose, onEdit }: { row: BdoRow; detail: BdoDetail | null; onClose: () => void; onEdit: () => void }) {
  const [tab, setTab] = useState<"bapx" | "tradeline" | "leads" | "tasks">("bapx");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{row.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{row.role ?? row.company} · {row.email ?? "No email"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Edit</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Stats */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailItem label="Company" value={row.company} />
            <DetailItem label="Role" value={row.role} />
            <DetailItem label="Email" value={row.email} />
            <DetailItem label="Phone" value={row.phone} />
            <DetailItem label="BAPX Deals" value={String(row.bapxDeals)} />
            <DetailItem label="Tradeline Deals" value={String(row.tradelineDeals)} />
            <DetailItem label="Leads" value={String(row.leads)} />
            <DetailItem label="Open Tasks" value={row.openTasks > 0 ? `${row.openTasks}${row.overdueTasks > 0 ? ` (${row.overdueTasks} overdue)` : ""}` : "0"} />
            {row.revenueReceived > 0 && <DetailItem label="Revenue Received" value={fmt(row.revenueReceived)} />}
          </dl>

          {/* Tabs */}
          {detail && (
            <div>
              <div className="flex gap-1 border-b border-gray-100 mb-3">
                {(["bapx", "tradeline", "leads", "tasks"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${tab === t ? "border-indigo-500 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    {t === "bapx" ? `BAPX (${detail.bapxDeals.length})` : t === "tradeline" ? `Tradeline (${detail.tradelineDeals.length})` : t === "leads" ? `Leads (${detail.leads.length})` : `Tasks (${detail.tasks.length})`}
                  </button>
                ))}
              </div>

              {tab === "bapx" && (
                <ItemList
                  items={detail.bapxDeals.map((d) => ({ id: d.id, primary: d.businessName, secondary: d.dealStage.replace(/_/g, " "), badge: d.dealHealth }))}
                  empty="No BAPX deals"
                />
              )}
              {tab === "tradeline" && (
                <ItemList
                  items={detail.tradelineDeals.map((d) => ({ id: d.id, primary: d.businessName, secondary: d.dealStage.replace(/_/g, " "), badge: d.dealHealth }))}
                  empty="No Tradeline deals"
                />
              )}
              {tab === "leads" && (
                <ItemList
                  items={detail.leads.map((l) => ({ id: l.id, primary: l.businessName, secondary: "Lead", badge: l.status }))}
                  empty="No leads"
                />
              )}
              {tab === "tasks" && (
                <ItemList
                  items={detail.tasks.map((t) => ({ id: t.id, primary: t.deliverable, secondary: t.priority, badge: t.status }))}
                  empty="No tasks"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemList({ items, empty }: { items: { id: string; primary: string; secondary: string; badge: string }[]; empty: string }) {
  if (items.length === 0) return <p className="text-gray-400 text-sm text-center py-6">{empty}</p>;
  return (
    <div className="space-y-0 divide-y divide-gray-50">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">{item.primary}</p>
            <p className="text-xs text-gray-400">{item.secondary}</p>
          </div>
          <span className={`ml-3 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${HEALTH_COLORS[item.badge] ?? "bg-gray-100 text-gray-500"}`}>
            {item.badge.replace(/_/g, " ")}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────

function BdoFormModal({ row, onClose, onSaved }: { row: BdoRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(row ? { name: row.name, email: row.email ?? "", phone: row.phone ?? "", company: row.company, role: row.role ?? "" } : {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    const body = { ...form, email: form.email || null, phone: form.phone || null, role: form.role || null };
    try {
      row ? await api.put(`/bdo/${row.id}`, body) : await api.post("/bdo", body);
      onSaved();
    } catch { setError("Failed to save. Check the server."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-gray-900">{row ? "Edit BDO" : "Add BDO"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Full Name *" value={form.name} onChange={(v) => set("name", v)} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
          <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
          <Field label="Role / Title" value={form.role} onChange={(v) => set("role", v)} placeholder="e.g. Senior BDO" />
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Company</label>
            <select value={form.company} onChange={(e) => set("company", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {COMPANY_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : row ? "Update BDO" : "Add BDO"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
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
