"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { useCompanies } from "@/lib/companies";
import { DataTable, type Column } from "@/components/DataTable";
import { X, ArrowRight } from "lucide-react";

type Referral = {
  id: string; clientName: string; fromCompany: string | null; toCompany: string | null;
  bdoId: string | null; bdo: { id: string; name: string } | null;
  service: string | null; status: string; revenueGhs: number | null; notes: string | null; convertedAt: string | null;
};

const STATUS_OPTS = ["IDENTIFIED", "INTRODUCED", "CONVERTED", "DECLINED"];
const STATUS_STYLE: Record<string, string> = {
  IDENTIFIED: "bg-gray-100 text-gray-600", INTRODUCED: "bg-blue-100 text-blue-700",
  CONVERTED: "bg-green-100 text-green-700", DECLINED: "bg-red-100 text-red-600",
};
const fmt = (n: number | null) => (n != null ? "₵" + n.toLocaleString() : "—");

export default function CrossSellingPage() {
  const qc = useQueryClient();
  const { companies, byKey } = useCompanies();
  const [statusFilter, setStatusFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [editing, setEditing] = useState<Referral | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: referrals = [], isLoading } = useQuery<Referral[]>({
    queryKey: ["referrals"],
    queryFn: () => fetcher("/referrals"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/referrals/${id}`),
    onSuccess: () => { toast.success("Referral deleted"); qc.invalidateQueries({ queryKey: ["referrals"] }); },
    onError: (err) => toast.failed("Couldn't delete the referral", err),
  });

  const rows = referrals.filter((r) =>
    (!statusFilter || r.status === statusFilter) && (!toFilter || r.toCompany === toFilter));

  const counts = STATUS_OPTS.reduce((a, s) => { a[s] = referrals.filter((r) => r.status === s).length; return a; }, {} as Record<string, number>);
  const converted = referrals.filter((r) => r.status === "CONVERTED");
  const totalRevenue = converted.reduce((s, r) => s + (r.revenueGhs ?? 0), 0);

  // Referral revenue by receiving company
  const byReceiver: Record<string, number> = {};
  converted.forEach((r) => { if (r.toCompany) byReceiver[r.toCompany] = (byReceiver[r.toCompany] ?? 0) + (r.revenueGhs ?? 0); });
  const receiverRows = Object.entries(byReceiver).sort((a, b) => b[1] - a[1]);
  const maxRev = Math.max(1, ...receiverRows.map(([, v]) => v));

  const coName = (k: string | null) => (k ? byKey[k]?.name ?? k : "—");

  const columns: Column<Referral>[] = [
    { key: "clientName", label: "Client", sortable: true, render: (r) => <button onClick={() => { setEditing(r); setShowForm(true); }} className="text-left font-semibold text-accent hover:underline">{r.clientName}</button>, exportValue: (r) => r.clientName },
    {
      key: "fromCompany", label: "Referral", render: (r) => (
        <span className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-600">{coName(r.fromCompany)}</span>
          <ArrowRight size={12} className="text-gray-300" />
          <span className="font-medium text-accent">{coName(r.toCompany)}</span>
        </span>
      ),
      exportValue: (r) => `${coName(r.fromCompany)} -> ${coName(r.toCompany)}`,
    },
    { key: "service", label: "Service", render: (r) => r.service ?? "—" },
    { key: "bdo", label: "Owner", render: (r) => r.bdo?.name ?? "—" },
    { key: "status", label: "Status", sortable: true, render: (r) => <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.status]}`}>{r.status}</span> },
    { key: "revenueGhs", label: "Referral Revenue", sortable: true, render: (r) => <span className={r.status === "CONVERTED" ? "text-green-700 font-medium" : "text-gray-500"}>{fmt(r.revenueGhs)}</span>, exportValue: (r) => r.revenueGhs ?? 0 },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cross-Selling</h1>
        <p className="text-sm text-gray-500">Route client needs across the group and track referral revenue.</p>
      </div>

      {/* Funnel + revenue */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Tile label="Identified" value={counts.IDENTIFIED ?? 0} tone="gray" />
        <Tile label="Introduced" value={counts.INTRODUCED ?? 0} tone="blue" />
        <Tile label="Converted" value={counts.CONVERTED ?? 0} tone="green" />
        <Tile label="Declined" value={counts.DECLINED ?? 0} tone="red" />
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Referral Revenue</div>
          <div className="text-xl font-bold mt-1 text-green-700">{fmt(totalRevenue)}</div>
        </div>
      </div>

      {receiverRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Referral revenue by receiving company</h2>
          <div className="space-y-2">
            {receiverRows.map(([key, val]) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-40 shrink-0 text-sm text-gray-700 truncate">{coName(key)}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden"><div className="bg-green-400 h-full rounded-full" style={{ width: `${(val / maxRev) * 100}%` }} /></div>
                <div className="w-28 text-right text-sm font-medium text-gray-700 tabular-nums">{fmt(val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        title={`${rows.length} referrals`}
        onAdd={() => { setEditing(null); setShowForm(true); }}
        onEdit={(row) => { setEditing(row); setShowForm(true); }}
        onDelete={(row) => confirmAction({ title: `Delete the referral for ${row.clientName}?`, body: "This can't be undone.", confirmLabel: "Delete" }).then((ok) => { if (ok) deleteMutation.mutate(row.id); })}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              <option value="">All statuses</option>
              {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={toFilter} onChange={(e) => setToFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              <option value="">Any receiving company</option>
              {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          </div>
        }
      />

      {showForm && (
        <ReferralModal
          referral={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["referrals"] }); }}
        />
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = { gray: "text-gray-600", blue: "text-blue-700", green: "text-green-700", red: "text-red-700" };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function ReferralModal({ referral, onClose, onSaved }: { referral: Referral | null; onClose: () => void; onSaved: () => void }) {
  const { companies } = useCompanies();
  const { data: bdos = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["bdos"], queryFn: () => fetcher("/bdo") });
  const [form, setForm] = useState({
    clientName: referral?.clientName ?? "",
    fromCompany: referral?.fromCompany ?? "",
    toCompany: referral?.toCompany ?? "",
    bdoId: referral?.bdoId ?? "",
    service: referral?.service ?? "",
    status: referral?.status ?? "IDENTIFIED",
    revenueGhs: referral?.revenueGhs != null ? String(referral.revenueGhs) : "",
    notes: referral?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.clientName.trim()) { setError("Client name is required."); return; }
    setSaving(true); setError("");
    const body = {
      ...form,
      fromCompany: form.fromCompany || null,
      toCompany: form.toCompany || null,
      bdoId: form.bdoId || null,
      revenueGhs: form.revenueGhs !== "" ? Number(form.revenueGhs) : null,
    };
    try {
      referral ? await api.put(`/referrals/${referral.id}`, body) : await api.post("/referrals", body);
      toast.success(referral ? "Referral updated" : "Referral added");
      onSaved();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to save.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">{referral ? "Edit Referral" : "New Referral"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Client *</label><input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">From company</label>
              <select value={form.fromCompany} onChange={(e) => set("fromCompany", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
                <option value="">—</option>{companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">To company</label>
              <select value={form.toCompany} onChange={(e) => set("toCompany", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
                <option value="">—</option>{companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Service / need</label><input value={form.service} onChange={(e) => set("service", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Recruitment support" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Referral owner</label>
              <select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
                <option value="">— Unassigned —</option>{bdos.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">{STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Referral Revenue (GHS)</label><input type="number" value={form.revenueGhs} onChange={(e) => set("revenueGhs", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Notes</label><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" /></div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving || !form.clientName.trim()} className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
