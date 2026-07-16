"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import type { Company } from "@/lib/companies";
import { Building2, Plus, Pencil, Archive, RotateCcw } from "lucide-react";

const COLOR_OPTS = ["indigo", "green", "emerald", "teal", "sky", "violet", "amber", "rose", "slate"];

const dot: Record<string, string> = {
  indigo: "bg-indigo-500", green: "bg-green-500", emerald: "bg-emerald-500", teal: "bg-teal-500",
  sky: "bg-sky-500", violet: "bg-violet-500", amber: "bg-amber-500", rose: "bg-rose-500", slate: "bg-slate-500",
};

export default function ManageCompaniesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["companies", "all"],
    queryFn: () => fetcher("/companies?all=1"),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["companies", "all"] });
  };

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    onSuccess: invalidate,
  });
  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.put(`/companies/${id}`, { isActive: true }),
    onSuccess: invalidate,
  });

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Companies</h1>
          <p className="text-sm text-gray-500">Add a company and it appears everywhere — menus, pipelines, staff &amp; deal forms.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Add Company
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : companies.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No companies yet. Add one above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Company", "Key", "Slug", "Pipeline", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map((c) => (
                <tr key={c.id} className={`hover:bg-gray-50 ${c.isActive ? "" : "opacity-55"}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${dot[c.color] ?? "bg-gray-400"}`} />
                      <span className="font-medium text-gray-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{c.key}</code></td>
                  <td className="px-4 py-3 text-gray-500">{c.slug}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500">
                      {c.dealSource === "COMPANY" ? "Shared pipeline" : `${c.dealSource} pipeline`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.isActive
                      ? <span className="text-xs text-green-600">Active</span>
                      : <span className="text-xs text-gray-400">Archived</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditing(c); setShowForm(true); }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      {c.isActive ? (
                        <button
                          onClick={() => { if (confirm(`Archive ${c.name}? Its existing deals are kept; it just stops appearing in menus.`)) archiveMutation.mutate(c.id); }}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
                        >
                          <Archive size={12} /> Archive
                        </button>
                      ) : (
                        <button
                          onClick={() => restoreMutation.mutate(c.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                        >
                          <RotateCcw size={12} /> Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <CompanyFormModal
          company={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); invalidate(); }}
        />
      )}
    </div>
  );
}

function CompanyFormModal({ company, onClose, onSaved }: { company: Company | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: company?.name ?? "",
    slug: company?.slug ?? "",
    color: company?.color ?? "teal",
    order: company?.order ?? 100,
    isActive: company?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!form.name.trim()) { setError("Company name is required."); return; }
    setSaving(true); setError("");
    try {
      if (company) {
        await api.put(`/companies/${company.id}`, form);
      } else {
        await api.post("/companies", { name: form.name, slug: form.slug || undefined, color: form.color, order: form.order });
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to save company.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><Building2 size={16} /> {company ? "Edit Company" : "Add Company"}</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Company Name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Akoteq Ltd" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Slug <span className="text-gray-400 font-normal">(URL)</span>
              </label>
              <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="auto from name" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Menu Order</label>
              <input type="number" value={String(form.order)} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Colour</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: col }))}
                  className={`w-7 h-7 rounded-full ${dot[col]} ${form.color === col ? "ring-2 ring-offset-2 ring-gray-500" : ""}`}
                  title={col}
                />
              ))}
            </div>
          </div>
          {!company && (
            <p className="text-[11px] text-gray-400">
              A key is generated from the name and used to tag this company&apos;s deals. New companies use the shared pipeline.
            </p>
          )}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving || !form.name.trim()} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">
            {saving ? "Saving…" : company ? "Save Changes" : "Add Company"}
          </button>
        </div>
      </div>
    </div>
  );
}
