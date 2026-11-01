"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { api } from "@/lib/api";
import { KpiSheet } from "@/components/kpi";
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, apiError, fmtDate, inDays, type Task, type TaskAttachment } from "./task-utils";
import { AttachmentsField, discardUploads } from "./Attachments";

/**
 * How an outside collaborator adds and updates their own tasks on a project: what it is, when,
 * where it's at, notes, and the files that show the work. The owner (themselves), KPI, deal and
 * money are left to whoever runs the project; the server ignores them from outsiders anyway.
 * Also the read-only view of a task someone can see but not change.
 */

const inputClass =
  "w-full bg-background border border-transparent rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors disabled:opacity-70";
const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

function Chips<T extends string>({ value, options, onChange, disabled }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([k, label]) => (
        <button
          key={k} type="button" disabled={disabled} onClick={() => onChange(k)} aria-pressed={value === k}
          className={clsx(
            "h-9 px-4 rounded-full border text-sm transition-colors disabled:cursor-default",
            value === k ? "border-accent bg-accent/10 text-foreground" : "border-border bg-surface text-muted hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function CollaboratorTaskSheet({ task, project, readOnly, onClose, onSaved }: {
  /** null = a new task on `project`. */
  task: Task | null;
  project?: { id: string; name: string };
  /** Can see it but not change it (someone else's task, or the project is finished). */
  readOnly?: boolean;
  onClose: () => void;
  onSaved: (saved: Task) => void;
}) {
  const creating = !task;
  const [form, setForm] = useState({
    deliverable: task?.deliverable ?? "",
    priority: task?.priority ?? "MEDIUM",
    startDate: task ? (task.startDate?.slice(0, 10) ?? "") : inDays(0),
    targetDate: task?.targetDate?.slice(0, 10) ?? "",
    completionCriteria: task?.completionCriteria ?? "",
    status: task?.status === "OVERDUE" ? "PENDING" : task?.status ?? "PENDING",
    progress: task?.progress ?? 0,
    notes: task?.notes ?? "",
    attachments: task?.attachments ?? ([] as TaskAttachment[]),
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => { setForm((f) => ({ ...f, [k]: v })); if (error) setError(""); };
  const uploads = useRef<TaskAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => { discardUploads(uploads.current); onClose(); };

  const save = async () => {
    if (!form.deliverable.trim()) { setError("Name the task."); return; }
    if (!form.startDate || !form.targetDate) { setError("Pick a start and a due date."); return; }
    if (form.targetDate < form.startDate) { setError("The due date can't be before the start date."); return; }
    setSaving(true); setError("");
    const body = {
      deliverable: form.deliverable.trim(),
      priority: form.priority,
      startDate: form.startDate,
      targetDate: form.targetDate,
      completionCriteria: form.completionCriteria.trim() || null,
      status: form.status,
      progress: form.status === "COMPLETED" ? 100 : form.progress,
      notes: form.notes.trim() || null,
      attachments: form.attachments,
    };
    try {
      const res = creating
        ? await api.post("/tasks", { ...body, projectId: project?.id, year: Number(form.targetDate.slice(0, 4)) })
        : await api.put(`/tasks/${task.id}`, body);
      const saved = res.data as Task;
      discardUploads(uploads.current.filter((u) => !(saved.attachments ?? form.attachments).some((a) => a.publicId === u.publicId)));
      onSaved(saved);
    } catch (err) {
      setError(apiError(err, "We couldn't save this. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const footer = readOnly ? (
    <div className="flex justify-end w-full"><button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-foreground hover:bg-primary/5">Close</button></div>
  ) : (
    <div className="flex items-center justify-end gap-2 w-full">
      <button type="button" onClick={close} className="px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-foreground hover:bg-primary/5">Cancel</button>
      <button type="button" onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40">
        {saving ? "Saving…" : creating ? "Add task" : "Save update"}
      </button>
    </div>
  );

  const projectName = project?.name ?? task?.project?.name;
  return (
    <KpiSheet
      title={creating ? "Add a task" : readOnly ? task.deliverable : "Update your task"}
      subtitle={[projectName, !creating && task.targetDate ? `Due ${fmtDate(task.targetDate)}` : null].filter(Boolean).join(" · ") || undefined}
      onClose={close}
      footer={footer}
    >
      <div className="space-y-5">
        {task?.approval === "REJECTED" && task.rejectedReason && (
          <p className="text-sm rounded-xl border border-red-200 bg-red-500/5 px-3.5 py-2.5 text-red-700">Sent back: {task.rejectedReason}</p>
        )}

        <div>
          <p className="text-sm font-medium text-foreground mb-1.5">What needs to get done?</p>
          <input autoFocus={creating} value={form.deliverable} disabled={readOnly} onChange={(e) => set("deliverable", e.target.value)} placeholder="e.g. Build the sign-in screen" className={inputClass} />
          {creating && <p className="text-xs text-muted mt-1.5">It&apos;s yours. Everyone on {projectName ?? "the project"} can see it.</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium text-foreground mb-1.5">Starts</p>
            <input type="date" value={form.startDate} disabled={readOnly} onChange={(e) => set("startDate", e.target.value)} className={inputClass} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1.5">Due</p>
            <input type="date" value={form.targetDate} min={form.startDate || undefined} disabled={readOnly} onChange={(e) => set("targetDate", e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-1.5">How urgent is it?</p>
          <Chips value={form.priority} disabled={readOnly} options={PRIORITIES.map((p) => [p, PRIORITY_LABEL[p]] as const)} onChange={(v) => set("priority", v)} />
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-1.5">Where is it at?</p>
          <Chips value={form.status as (typeof STATUSES)[number]} disabled={readOnly} options={STATUSES.map((s) => [s, STATUS_LABEL[s]] as const)} onChange={(v) => set("status", v)} />
          {form.status === "COMPLETED" && !readOnly && (
            <p className="text-xs text-muted mt-2">The project&apos;s Business CEO reviews finished work. Add the files that show it&apos;s done.</p>
          )}
        </div>

        {form.status === "IN_PROGRESS" && (
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-foreground mb-1.5">
              How far along? <span className="tabular-nums text-muted font-normal">{form.progress}%</span>
            </label>
            <input type="range" min={0} max={100} step={5} value={form.progress} disabled={readOnly} onChange={(e) => set("progress", Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-foreground mb-1.5">How will we know it&apos;s done? <span className="font-normal text-muted">(optional)</span></p>
          <input value={form.completionCriteria} disabled={readOnly} onChange={(e) => set("completionCriteria", e.target.value)} placeholder="e.g. Merged and working on the test phone" className={inputClass} />
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-1.5">Files and links <span className="font-normal text-muted">(evidence of the work)</span></p>
          {readOnly ? (
            form.attachments.length ? (
              <ul className="space-y-1 text-sm">{form.attachments.map((a) => <li key={a.publicId ?? a.url}><a href={a.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{a.name}</a></li>)}</ul>
            ) : <p className="text-sm text-muted">None added.</p>
          ) : (
            <AttachmentsField value={form.attachments} onChange={(next) => set("attachments", next)} onUploaded={(f) => { uploads.current.push(f); }} />
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-1.5">Notes <span className="font-normal text-muted">(optional)</span></p>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} disabled={readOnly} rows={3} className={clsx(inputClass, "resize-none")} />
        </div>

        {error && <p role="alert" className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-xl">{error}</p>}
      </div>
    </KpiSheet>
  );
}
