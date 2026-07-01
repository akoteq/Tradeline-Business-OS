"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { useAuth } from "@/components/AuthProvider";
import { X } from "lucide-react";

type GrantLoan = {
  id: string;
  clientName: string;
  bdoId: string | null;
  bdo: { id: string; name: string } | null;
  grantLoanType: string | null;
  funderDfi: string | null;
  sectorValueChain: string | null;
  amountApplied: string | null;
  amountApproved: number | null;
  disbursed: number | null;
  applicationDate: string | null;
  decisionDate: string | null;
  status: string;
  commissionPct: number | null;
  commissionReceived: number | null;
  notes: string | null;
};

type BdoOption = { id: string; name: string; company: string };

const STATUS_OPTS = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "DISBURSED", "REJECTED", "WITHDRAWN"] as const;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-500",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  DISBURSED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  WITHDRAWN: "bg-gray-100 text-gray-400",
};

const EMPTY_FORM = {
  clientName: "", bdoId: "", grantLoanType: "", funderDfi: "",
  sectorValueChain: "", amountApplied: "", status: "SUBMITTED",
  applicationDate: "", decisionDate: "",
  amountApproved: "", disbursed: "", commissionPct: "10", commissionReceived: "", notes: "",
};

const fmt = (n: number) => `GHS ${n.toLocaleString()}`;

export default function GrantLoansPage() {
  const { user } = useAuth();
  const isBdoRole = user?.role === "BDO";
  const [filters, setFilters] = useState({ status: "", bdo: "" });
  const [editing, setEditing] = useState<GrantLoan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<GrantLoan | null>(null);
  const qc = useQueryClient();

  // Scope to the logged-in BDO's own records; otherwise pick up a ?bdo= link from elsewhere in the app.
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

  const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
  const { data = [], isLoading } = useQuery<GrantLoan[]>({
    queryKey: ["grant-loans", filters],
    queryFn: () => fetcher(`/grant-loans?${params}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/grant-loans/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grant-loans"] }),
  });

  // Count by status for the summary bar
  const statusCounts = STATUS_OPTS.reduce((acc, s) => {
    acc[s] = data.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const columns = [
    {
      key: "clientName", label: "Client / SME", sortable: true,
      render: (r: GrantLoan) => (
        <button onClick={() => setDetail(r)} className="text-left font-medium text-indigo-700 hover:underline truncate max-w-[160px] block">
          {r.clientName}
        </button>
      ),
    },
    { key: "bdo", label: "BDO", render: (r: GrantLoan) => r.bdo?.name ?? "—" },
    { key: "grantLoanType", label: "Type", render: (r: GrantLoan) => r.grantLoanType ?? "—" },
    { key: "funderDfi", label: "Funder / DFI", render: (r: GrantLoan) => r.funderDfi ?? "—" },
    { key: "sectorValueChain", label: "Sector", render: (r: GrantLoan) => r.sectorValueChain ?? "—" },
    { key: "amountApplied", label: "Applied", render: (r: GrantLoan) => r.amountApplied ?? "—" },
    { key: "amountApproved", label: "Approved (GHS)", sortable: true, render: (r: GrantLoan) => r.amountApproved != null ? fmt(r.amountApproved) : "—" },
    { key: "disbursed", label: "Disbursed (GHS)", sortable: true, render: (r: GrantLoan) => r.disbursed != null ? fmt(r.disbursed) : "—" },
    { key: "applicationDate", label: "App. Date", render: (r: GrantLoan) => r.applicationDate ? new Date(r.applicationDate).toLocaleDateString() : "—" },
    { key: "decisionDate", label: "Decision", render: (r: GrantLoan) => r.decisionDate ? new Date(r.decisionDate).toLocaleDateString() : "—" },
    {
      key: "status", label: "Status", sortable: true,
      render: (r: GrantLoan) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>
          {r.status.replace(/_/g, " ")}
        </span>
      ),
    },
    { key: "commissionPct", label: "Comm %", render: (r: GrantLoan) => r.commissionPct != null ? `${r.commissionPct}%` : "—" },
    { key: "commissionReceived", label: "Comm. Received", sortable: true, render: (r: GrantLoan) => r.commissionReceived != null ? fmt(r.commissionReceived) : "—" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Grant & Loan Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isBdoRole ? "Your grant applications & loan facilitation" : "Finance Factory & Tradeline — grant applications & loan facilitation"}
        </p>
      </div>

      {/* Status pipeline */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {STATUS_OPTS.map((s) => (
          <button
            key={s}
            onClick={() => setFilters((f) => ({ ...f, status: f.status === s ? "" : s }))}
            className={`rounded-xl border p-2.5 text-left transition-all bg-white ${filters.status === s ? "ring-2 ring-indigo-400 border-indigo-200" : "border-gray-200 hover:border-gray-300"}`}
          >
            <div className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium mb-1.5 ${STATUS_COLORS[s]}`}>
              {s.replace(/_/g, " ")}
            </div>
            <div className="text-xl font-bold text-gray-900">{statusCounts[s] ?? 0}</div>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        title={`${data.length} records`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => { if (confirm(`Delete record for "${row.clientName}"?`)) deleteMutation.mutate(row.id); }}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <FilterSelect
              value={filters.status}
              options={[{ value: "", label: "All Statuses" }, ...STATUS_OPTS.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]}
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            />
            {!isBdoRole && (
              <FilterSelect
                value={filters.bdo}
                options={[{ value: "", label: "All BDOs" }, ...bdos.map((b) => ({ value: b.name, label: `${b.name} (${b.company})` }))]}
                onChange={(v) => setFilters((f) => ({ ...f, bdo: v }))}
              />
            )}
          </div>
        }
      />

      {showForm && (
        <GrantFormModal
          g={editing}
          bdos={bdos}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["grant-loans"] }); }}
        />
      )}

      {detail && (
        <DetailDrawer
          g={detail}
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
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────────

function GrantFormModal({ g, bdos, onClose, onSaved }: { g: GrantLoan | null; bdos: BdoOption[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(g ? {
      clientName: g.clientName,
      bdoId: g.bdoId ?? "",
      grantLoanType: g.grantLoanType ?? "",
      funderDfi: g.funderDfi ?? "",
      sectorValueChain: g.sectorValueChain ?? "",
      amountApplied: g.amountApplied ?? "",
      status: g.status,
      applicationDate: g.applicationDate ? g.applicationDate.slice(0, 10) : "",
      decisionDate: g.decisionDate ? g.decisionDate.slice(0, 10) : "",
      amountApproved: g.amountApproved != null ? String(g.amountApproved) : "",
      disbursed: g.disbursed != null ? String(g.disbursed) : "",
      commissionPct: g.commissionPct != null ? String(g.commissionPct) : "10",
      commissionReceived: g.commissionReceived != null ? String(g.commissionReceived) : "",
      notes: g.notes ?? "",
    } : {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const autoCommission = () => {
    const approved = Number(form.amountApproved) || 0;
    const pct = Number(form.commissionPct) || 10;
    set("commissionReceived", String((approved * pct) / 100));
  };

  const save = async () => {
    if (!form.clientName.trim()) { setError("Client name is required."); return; }
    setSaving(true); setError("");
    const body = {
      ...form,
      bdoId: form.bdoId || null,
      grantLoanType: form.grantLoanType || null,
      funderDfi: form.funderDfi || null,
      sectorValueChain: form.sectorValueChain || null,
      amountApplied: form.amountApplied || null,
      applicationDate: form.applicationDate || null,
      decisionDate: form.decisionDate || null,
      amountApproved: form.amountApproved !== "" ? Number(form.amountApproved) : null,
      disbursed: form.disbursed !== "" ? Number(form.disbursed) : null,
      commissionPct: form.commissionPct !== "" ? Number(form.commissionPct) : null,
      commissionReceived: form.commissionReceived !== "" ? Number(form.commissionReceived) : null,
      notes: form.notes || null,
    };
    try {
      g ? await api.put(`/grant-loans/${g.id}`, body) : await api.post("/grant-loans", body);
      onSaved();
    } catch { setError("Failed to save. Check the server."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-gray-900">{g ? "Edit Record" : "Add Grant / Loan"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <Section label="Application Details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client / SME Name *" value={form.clientName} onChange={(v) => set("clientName", v)} span={2} />
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Assigned BDO</label>
                <select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">— Unassigned —</option>
                  {bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}
                </select>
              </div>
              <FormSelect label="Status" value={form.status} options={STATUS_OPTS as unknown as string[]} onChange={(v) => set("status", v)} />
              <Field label="Grant / Loan Type" value={form.grantLoanType} onChange={(v) => set("grantLoanType", v)} />
              <Field label="Funder / DFI" value={form.funderDfi} onChange={(v) => set("funderDfi", v)} />
              <Field label="Sector / Value Chain" value={form.sectorValueChain} onChange={(v) => set("sectorValueChain", v)} span={2} />
              <Field label="Amount Applied" value={form.amountApplied} onChange={(v) => set("amountApplied", v)} placeholder="e.g. GHS 50,000" />
              <Field label="Application Date" type="date" value={form.applicationDate} onChange={(v) => set("applicationDate", v)} />
              <Field label="Decision Date" type="date" value={form.decisionDate} onChange={(v) => set("decisionDate", v)} />
            </div>
          </Section>

          <Section label="Financials">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount Approved (GHS)" type="number" value={form.amountApproved} onChange={(v) => set("amountApproved", v)} />
              <Field label="Amount Disbursed (GHS)" type="number" value={form.disbursed} onChange={(v) => set("disbursed", v)} />
              <Field label="Commission %" type="number" value={form.commissionPct} onChange={(v) => set("commissionPct", v)} />
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Commission Received (GHS)</label>
                <div className="flex gap-1">
                  <input type="number" value={form.commissionReceived} onChange={(e) => set("commissionReceived", e.target.value)} className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  <button type="button" onClick={autoCommission} title="Calculate from approved amount × commission %" className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-500 shrink-0">Auto</button>
                </div>
              </div>
            </div>
          </Section>

          <Section label="Notes">
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </Section>

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : g ? "Update Record" : "Add Record"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ g, onClose, onEdit }: { g: GrantLoan; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{g.clientName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{g.grantLoanType ?? "Grant / Loan"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Edit</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex flex-wrap gap-2">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[g.status] ?? "bg-gray-100"}`}>
              {g.status.replace(/_/g, " ")}
            </span>
          </div>

          {/* Financial cards */}
          <div className="grid grid-cols-3 gap-3">
            <FinCard label="Applied" value={g.amountApplied} raw />
            <FinCard label="Approved" value={g.amountApproved != null ? fmt(g.amountApproved) : null} />
            <FinCard label="Disbursed" value={g.disbursed != null ? fmt(g.disbursed) : null} highlight />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FinCard label={`Commission (${g.commissionPct ?? 10}%)`} value={g.commissionReceived != null ? fmt(g.commissionReceived) : null} highlight />
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailItem label="BDO" value={g.bdo?.name} />
            <DetailItem label="Funder / DFI" value={g.funderDfi} />
            <DetailItem label="Sector" value={g.sectorValueChain} />
            <DetailItem label="Application Date" value={g.applicationDate ? new Date(g.applicationDate).toLocaleDateString() : null} />
            <DetailItem label="Decision Date" value={g.decisionDate ? new Date(g.decisionDate).toLocaleDateString() : null} />
          </dl>

          {g.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3">{g.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function FinCard({ label, value, highlight, raw }: { label: string; value: string | null | undefined; highlight?: boolean; raw?: boolean }) {
  return (
    <div className={`border rounded-lg p-3 text-center ${highlight ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-700"}`}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="font-bold text-sm mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{label}</p>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", span, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; span?: number; placeholder?: string }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
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
