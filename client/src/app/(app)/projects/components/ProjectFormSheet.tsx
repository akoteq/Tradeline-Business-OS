"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, fetcher } from "@/lib/api";
import { KpiSheet } from "@/components/kpi";
import { useCompanies } from "@/lib/companies";
import { Field, FormError, PROJECT_STATUSES, STATUS_LABEL, apiError, inputClass, primaryBtn, secondaryBtn, type Project } from "../lib";

/**
 * Start a project, or change its details. The people, tasks and KPIs are added on the project
 * page. Only the Group Owner picks the company (or Shared); a Business CEO's projects are their
 * own company's.
 */
export type ProjectPrefill = { dealId: string; dealSource: string; company: string; name: string };

export function ProjectFormSheet({ project, prefill, canPickCompany, onClose, onSaved }: {
  project: Project | null;
  /** Started from a deal: the deal is already chosen. */
  prefill?: ProjectPrefill | null;
  canPickCompany: boolean;
  onClose: () => void;
  onSaved: (saved: Project) => void;
}) {
  const { companies } = useCompanies();
  const [form, setForm] = useState({
    name: project?.name ?? prefill?.name ?? "",
    company: project?.company ?? prefill?.company ?? companies[0]?.key ?? "SHARED",
    deal: project?.dealId ? `${project.dealSource}:${project.dealId}` : prefill ? `${prefill.dealSource}:${prefill.dealId}` : "",
    status: project?.status ?? "ACTIVE",
    startDate: project?.startDate?.slice(0, 10) ?? "",
    endDate: project?.endDate?.slice(0, 10) ?? "",
    description: project?.description ?? "",
    notes: project?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => { setForm((f) => ({ ...f, [k]: v })); if (error) setError(""); };

  // Deals in this project's company. Optional: not all projects come from a deal.
  const { data: deals = [] } = useQuery<{ id: string; source: string; name: string }[]>({
    queryKey: ["task-deal-options", form.company],
    queryFn: () => fetcher(`/tasks/deal-options?company=${encodeURIComponent(form.company)}`),
    enabled: form.company !== "SHARED",
  });

  const save = async () => {
    if (!form.name.trim()) { setError("Give the project a name."); return; }
    if (form.startDate && form.endDate && form.endDate < form.startDate) { setError("The end date can't be before the start date."); return; }
    setSaving(true); setError("");
    const body = {
      name: form.name.trim(),
      ...(canPickCompany ? { company: form.company } : {}),
      ...(project ? { status: form.status } : {}),
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
      dealId: form.deal ? form.deal.split(":")[1] : null,
      dealSource: form.deal ? form.deal.split(":")[0] : null,
    };
    try {
      const res = project ? await api.put(`/projects/${project.id}`, body) : await api.post("/projects", body);
      onSaved(res.data as Project);
    } catch (err) {
      setError(apiError(err, "We couldn't save the project. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-2 w-full">
      <button type="button" onClick={onClose} className={secondaryBtn}>Cancel</button>
      <button type="button" onClick={save} disabled={saving || !form.name.trim()} className={primaryBtn}>
        {saving ? "Saving…" : project ? "Save changes" : "Start project"}
      </button>
    </div>
  );

  return (
    <KpiSheet
      title={project ? "Edit project" : "New project"}
      subtitle={project ? undefined : "Name it now. You'll add its people, tasks and KPIs next."}
      onClose={onClose}
      footer={footer}
    >
      <div className="space-y-4">
        <Field label="Project name">
          <input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Akoteq mobile app build" className={inputClass} />
        </Field>

        {canPickCompany && (
          <Field label="Which company is it for?">
            <select value={form.company} onChange={(e) => { const company = e.target.value; setForm((f) => ({ ...f, company, deal: "" })); }} className={inputClass}>
              {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              <option value="SHARED">Shared across the group</option>
            </select>
          </Field>
        )}

        {form.company !== "SHARED" && (deals.length > 0 || form.deal) && (
          <Field label="Which deal does it deliver?" hint="(optional)">
            <select value={form.deal} onChange={(e) => set("deal", e.target.value)} className={inputClass}>
              <option value="">No deal</option>
              {form.deal && !deals.some((d) => `${d.source}:${d.id}` === form.deal) && <option value={form.deal}>The linked deal</option>}
              {deals.map((d) => <option key={d.id} value={`${d.source}:${d.id}`}>{d.name}</option>)}
            </select>
          </Field>
        )}

        {project && (
          <Field label="Where does it stand?">
            <div className="flex flex-wrap gap-2">
              {PROJECT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("status", s)}
                  aria-pressed={form.status === s}
                  className={clsx(
                    "h-9 px-4 rounded-full border text-sm transition-colors",
                    form.status === s ? "border-accent bg-accent/10 text-foreground" : "border-border bg-surface text-muted hover:text-foreground",
                  )}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {(form.status === "COMPLETED" || form.status === "CANCELLED") && (
              <p className="text-xs text-muted mt-2">Outside collaborators keep read-only access to a finished project.</p>
            )}
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Starts" hint="(optional)">
            <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Ends" hint="(optional)">
            <input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="What is it?" hint="(optional, every member sees this)">
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className={clsx(inputClass, "resize-none")} placeholder="The goal, in a sentence or two" />
        </Field>

        <Field label="Private notes" hint="(optional, only whoever runs the project sees these)">
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={clsx(inputClass, "resize-none")} />
        </Field>

        <FormError message={error} />
      </div>
    </KpiSheet>
  );
}
