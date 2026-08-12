"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import type { Company } from "@/lib/companies";
import { Building2, Plus, Pencil, Archive, RotateCcw, X } from "lucide-react";

const COLOR_OPTS = ["indigo", "green", "emerald", "teal", "sky", "violet", "amber", "rose", "slate"];

// Company-identity dots — deliberately literal Tailwind hues, not design
// tokens. Their job is to tell companies apart at a glance, so they stay
// outside the accent/muted/border semantic palette used everywhere else.
const dot: Record<string, string> = {
  indigo: "bg-indigo-500", green: "bg-green-500", emerald: "bg-emerald-500", teal: "bg-teal-500",
  sky: "bg-sky-500", violet: "bg-violet-500", amber: "bg-amber-500", rose: "bg-rose-500", slate: "bg-slate-500",
};

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30";
const labelCls = "text-xs font-medium text-muted block mb-1";

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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-border pb-5">
          <div>
            <h1 className="font-serif text-[1.75rem] leading-[1.15] text-foreground md:text-[2rem]">Manage companies</h1>
            <p className="mt-1 text-sm text-muted">Add a company and it appears everywhere — menus, pipelines, staff &amp; deal forms.</p>
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Plus size={15} />
            Add company
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted">Loading…</div>
          ) : companies.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">No companies yet. Add one above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-background/50">
                  <tr>
                    {["Company", "Key", "Slug", "Pipeline", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-border">
                  {companies.map((c) => (
                    <tr key={c.id} className={`hover:bg-background/50 ${c.isActive ? "" : "opacity-55"}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${dot[c.color] ?? "bg-muted"}`} />
                          <span className="font-medium text-foreground">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-background px-1.5 py-0.5 text-xs text-muted">{c.key}</code>
                      </td>
                      <td className="px-4 py-3 text-muted">{c.slug}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted">
                          {c.dealSource === "COMPANY" ? "Shared pipeline" : `${c.dealSource} pipeline`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.isActive
                          ? <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">Active</span>
                          : <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Archived</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditing(c); setShowForm(true); }}
                            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-background hover:text-foreground"
                          >
                            <Pencil size={12} /> Edit
                          </button>
                          {c.isActive ? (
                            <button
                              onClick={() => { if (confirm(`Archive ${c.name}? Its existing deals are kept; it just stops appearing in menus.`)) archiveMutation.mutate(c.id); }}
                              className="flex items-center gap-1 rounded-lg border border-accent/25 px-2 py-1 text-xs text-accent transition-colors hover:bg-accent/[0.08]"
                            >
                              <Archive size={12} /> Archive
                            </button>
                          ) : (
                            <button
                              onClick={() => restoreMutation.mutate(c.id)}
                              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-background"
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
            </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 size={16} className="text-accent" /> {company ? "Edit company" : "Add company"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="space-y-3 p-5">
          {error && (
            <div className="rounded-lg border border-accent/25 bg-accent/[0.08] px-3 py-2 text-xs text-accent">{error}</div>
          )}
          <div>
            <label className={labelCls}>Company name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
              placeholder="e.g. Akoteq Ltd"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                Slug <span className="font-normal text-muted">(URL)</span>
              </label>
              <input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className={`${inputCls} font-mono`}
                placeholder="auto from name"
              />
            </div>
            <div>
              <label className={labelCls}>Menu order</label>
              <input
                type="number"
                value={String(form.order)}
                onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Colour</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: col }))}
                  className={`h-7 w-7 rounded-full ${dot[col]} ${form.color === col ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}`}
                  title={col}
                />
              ))}
            </div>
          </div>
          {!company && (
            <p className="text-[11px] text-muted">
              A key is generated from the name and used to tag this company&apos;s deals. New companies use the shared pipeline.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-background">Cancel</button>
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : company ? "Save changes" : "Add company"}
          </button>
        </div>
      </div>
    </div>
  );
}