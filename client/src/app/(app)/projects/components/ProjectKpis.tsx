"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Plus } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { KpiSheet, PaceBar, StatusPill, WorkChip, fmtKpiVal, windowLabel, type KpiRow } from "@/components/kpi";
import { useCompanies } from "@/lib/companies";
import { MentionInput } from "@/components/mentions/MentionInput";
import { MentionText } from "@/components/mentions/MentionText";
import { card } from "../../dashboard/components/ui";
import { Empty, PrimaryButton } from "./ui";
import { Field, FormError, apiError, inputClass, isClosed, primaryBtn, secondaryBtn, type Project } from "../lib";

/**
 * The project's own goals, on the same KPI engine as company KPIs: a target per period, results
 * logged as they come, and a status worked out from pace. Everyone on the project sees them;
 * whoever runs it sets them and logs results. A project KPI can count toward a company KPI.
 */

const UNITS: [string, string][] = [["COUNT", "A number"], ["CURRENCY", "Money (GHS)"], ["PERCENT", "A percentage"], ["SCORE", "A score"], ["DAYS", "Days"], ["HOURS", "Hours"]];
const FREQUENCIES: [string, string][] = [["WEEKLY", "Every week"], ["MONTHLY", "Every month"], ["QUARTERLY", "Every quarter"], ["ANNUAL", "Every year"]];

export function ProjectKpis({ project }: { project: Project }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [logging, setLogging] = useState<KpiRow | null>(null);
  const manage = project.canManage;
  const key = ["project-kpis", project.id];
  const { data: rows = [], isLoading } = useQuery<KpiRow[]>({ queryKey: key, queryFn: () => fetcher(`/projects/${project.id}/kpis`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["project-kpis"] }); qc.invalidateQueries({ queryKey: ["my-kpis"] }); };

  const archive = async (r: KpiRow) => {
    const ok = await confirmAction({ title: `Remove "${r.definition.metric}"?`, body: "It stops being tracked. Tasks linked to it are unlinked; their work stays.", confirmLabel: "Remove KPI" });
    if (!ok) return;
    try { await api.delete(`/projects/${project.id}/kpis/${r.definition.id}`); toast.success("KPI removed"); refresh(); }
    catch (err) { toast.error("Couldn't remove it", { description: apiError(err, "Please try again.") }); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted max-w-xl">
          What this project is measured on. Link tasks to a KPI to show the work behind it{manage ? "; log results as they come in" : ""}.
        </p>
        {manage && !isClosed(project) && (
          <PrimaryButton icon={Plus} onClick={() => setAdding(true)}>Add KPI</PrimaryButton>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-36 rounded-xl bg-subtle animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <Empty
          title="No KPIs yet"
          body={manage ? "Set what success looks like, e.g. 20 features delivered, or a launch by a date." : "Whoever runs the project hasn't set any KPIs yet."}
          action={manage && !isClosed(project) ? <button onClick={() => setAdding(true)} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">Add a KPI</button> : undefined}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.definition.id} className={clsx(card, "flex flex-col gap-3 p-4")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground" title={r.definition.metric}>{r.definition.metric}</h3>
                  <p className="mt-0.5 text-xs text-muted">{windowLabel(r.window, r.definition.frequency)}</p>
                </div>
                <StatusPill status={r.status} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="type-kpi text-2xl text-foreground tabular-nums">{fmtKpiVal(r.current ?? 0, r.definition.unit)}</span>
                <span className="text-sm text-muted">of {r.target != null ? fmtKpiVal(r.target, r.definition.unit) : "no target"}</span>
              </div>
              <PaceBar attainment={r.attainment} expected={r.expected} status={r.status} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <WorkChip work={r.work} />
                {r.parent && <span className="text-xs text-muted truncate" title="Counts toward this KPI">Part of {r.parent.metric}</span>}
              </div>
              {r.definition.definition && <p className="text-xs text-muted"><MentionText value={r.definition.definition} /></p>}
              {manage && (
                <div className="flex gap-2 border-t border-border pt-3">
                  <button onClick={() => setLogging(r)} className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/15">Log a result</button>
                  <button onClick={() => archive(r)} className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-primary/5 hover:text-foreground">Remove</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && <AddKpiSheet project={project} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); refresh(); toast.success("KPI added"); }} />}
      {logging && <LogSheet project={project} row={logging} onClose={() => setLogging(null)} onSaved={() => { setLogging(null); refresh(); toast.success("Result logged"); }} />}
    </div>
  );
}

type Parent = { id: string; metric: string; company: string; unit: string; frequency: string };

function AddKpiSheet({ project, onClose, onSaved }: { project: Project; onClose: () => void; onSaved: () => void }) {
  const { byKey } = useCompanies();
  const [form, setForm] = useState({ metric: "", unit: "COUNT", frequency: "MONTHLY", target: "", higherIsBetter: true, parentId: "", definition: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => { setForm((f) => ({ ...f, [k]: v })); if (error) setError(""); };
  const { data: parents = [] } = useQuery<Parent[]>({ queryKey: ["project-kpi-parents", project.id], queryFn: () => fetcher(`/projects/${project.id}/kpi-parents`) });
  const fit = parents.filter((p) => p.unit === form.unit);

  const save = async () => {
    if (!form.metric.trim()) { setError("Name the KPI."); return; }
    if (form.target === "" || !Number.isFinite(Number(form.target))) { setError("Set a target for each period."); return; }
    setSaving(true); setError("");
    try {
      await api.post(`/projects/${project.id}/kpis`, { ...form, metric: form.metric.trim(), target: Number(form.target), parentId: form.parentId || null, definition: form.definition.trim() || null });
      onSaved();
    } catch (err) {
      setError(apiError(err, "We couldn't add the KPI. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KpiSheet
      title="Add a project KPI"
      subtitle={`What ${project.name} is measured on.`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button onClick={save} disabled={saving} className={primaryBtn}>{saving ? "Saving…" : "Add KPI"}</button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="What are you measuring?">
          <input autoFocus value={form.metric} onChange={(e) => set("metric", e.target.value)} placeholder="e.g. App features delivered" className={inputClass} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Measured in">
            <select value={form.unit} onChange={(e) => { set("unit", e.target.value); set("parentId", ""); }} className={inputClass}>
              {UNITS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Tracked">
            <select value={form.frequency} onChange={(e) => set("frequency", e.target.value)} className={inputClass}>
              {FREQUENCIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Target" hint="(per period)">
            <input type="number" min="0" step="any" value={form.target} onChange={(e) => set("target", e.target.value)} placeholder="e.g. 20" className={inputClass} />
          </Field>
          <Field label="Good is">
            <select value={form.higherIsBetter ? "up" : "down"} onChange={(e) => set("higherIsBetter", e.target.value === "up")} className={inputClass}>
              <option value="up">Higher</option>
              <option value="down">Lower (e.g. bugs, days late)</option>
            </select>
          </Field>
        </div>
        <Field label="Counts toward a company KPI?" hint="(optional)">
          <select value={form.parentId} onChange={(e) => set("parentId", e.target.value)} className={inputClass}>
            <option value="">No, it stands on its own</option>
            {fit.map((p) => <option key={p.id} value={p.id}>{p.metric} · {p.company === "GROUP" ? "Group" : byKey[p.company]?.name ?? p.company}</option>)}
          </select>
          {parents.length > 0 && fit.length === 0 && <p className="text-xs text-muted mt-1.5">No company KPI is measured the same way, so there&apos;s nothing to count toward.</p>}
        </Field>
        <Field label="Description" hint="(optional, type @ to mention someone on the project)">
          <MentionInput
            value={form.definition} onChange={(v) => set("definition", v)} rows={2}
            source={{ entityType: "PROJECT", entityId: project.id }}
            placeholder="What counts, so everyone reads it the same way" aria-label="Description"
          />
        </Field>
        <FormError message={error} />
      </div>
    </KpiSheet>
  );
}

function LogSheet({ project, row, onClose, onSaved }: { project: Project; row: KpiRow; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sums = row.aggregation === "SUM";

  const save = async () => {
    if (value === "" || !Number.isFinite(Number(value))) { setError("Enter a number."); return; }
    setSaving(true); setError("");
    try {
      await api.post(`/projects/${project.id}/kpis/${row.definition.id}/results`, { value: Number(value), date, note: note.trim() || null });
      onSaved();
    } catch (err) {
      setError(apiError(err, "We couldn't log the result. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KpiSheet
      title={`Log a result: ${row.definition.metric}`}
      subtitle={`Now ${fmtKpiVal(row.current ?? 0, row.definition.unit)}${row.target != null ? ` of ${fmtKpiVal(row.target, row.definition.unit)}` : ""}.`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button onClick={save} disabled={saving} className={primaryBtn}>{saving ? "Saving…" : "Log result"}</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={sums ? "How many more?" : "Latest reading"}>
            <input autoFocus type="number" step="any" value={value} onChange={(e) => { setValue(e.target.value); if (error) setError(""); }} className={inputClass} />
          </Field>
          <Field label="On">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <p className="text-xs text-muted -mt-2">{sums ? "Results add up over the period." : "The latest reading is the result."}</p>
        <Field label="Note" hint="(optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </Field>
        <FormError message={error} />
      </div>
    </KpiSheet>
  );
}
