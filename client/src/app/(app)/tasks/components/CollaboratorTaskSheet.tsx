"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { api } from "@/lib/api";
import { KpiSheet } from "@/components/kpi";
import { STATUS_LABEL, apiError, fmtDate, type Task, type TaskAttachment } from "./task-utils";
import { AttachmentsField, discardUploads } from "./Attachments";

/**
 * How an outside collaborator updates a task they were given: where it's at, how far along, notes,
 * and the files that show the work. Everything else about the task (owner, dates, KPI, money) is
 * set by whoever runs the project, and the server ignores it from them anyway.
 */

const inputClass =
  "w-full bg-background border border-transparent rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors";
const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

export function CollaboratorTaskSheet({ task, readOnly, onClose, onSaved }: {
  task: Task;
  /** The project is finished: show the task, change nothing. */
  readOnly?: boolean;
  onClose: () => void;
  onSaved: (saved: Task) => void;
}) {
  const [status, setStatus] = useState(task.status === "OVERDUE" ? "PENDING" : task.status);
  const [progress, setProgress] = useState(task.progress ?? 0);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [attachments, setAttachments] = useState<TaskAttachment[]>(task.attachments ?? []);
  const uploads = useRef<TaskAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => { discardUploads(uploads.current); onClose(); };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const res = await api.put(`/tasks/${task.id}`, { status, progress: status === "COMPLETED" ? 100 : progress, notes: notes || null, attachments });
      const saved = res.data as Task;
      discardUploads(uploads.current.filter((u) => !(saved.attachments ?? []).some((a) => a.publicId === u.publicId)));
      onSaved(saved);
    } catch (err) {
      setError(apiError(err, "We couldn't save your update. Please try again."));
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
        {saving ? "Saving…" : "Save update"}
      </button>
    </div>
  );

  return (
    <KpiSheet
      title={task.deliverable}
      subtitle={[task.project?.name, task.targetDate ? `Due ${fmtDate(task.targetDate)}` : null].filter(Boolean).join(" · ")}
      onClose={close}
      footer={footer}
    >
      <div className="space-y-5">
        {task.completionCriteria && (
          <div className="rounded-xl bg-background px-3.5 py-2.5 text-sm">
            <span className="text-muted">Done means: </span><span className="text-foreground">{task.completionCriteria}</span>
          </div>
        )}
        {task.approval === "REJECTED" && task.rejectedReason && (
          <p className="text-sm rounded-xl border border-red-200 bg-red-500/5 px-3.5 py-2.5 text-red-700">Sent back: {task.rejectedReason}</p>
        )}

        <div>
          <p className="text-sm font-medium text-foreground mb-1.5">Where is it at?</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={readOnly}
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={clsx(
                  "h-9 px-4 rounded-full border text-sm transition-colors disabled:cursor-default",
                  status === s ? "border-accent bg-accent/10 text-foreground" : "border-border bg-surface text-muted hover:text-foreground",
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {status === "COMPLETED" && !readOnly && (
            <p className="text-xs text-muted mt-2">The project&apos;s Business CEO reviews finished work. Add the files that show it&apos;s done.</p>
          )}
        </div>

        {status === "IN_PROGRESS" && (
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-foreground mb-1.5">
              How far along? <span className="tabular-nums text-muted font-normal">{progress}%</span>
            </label>
            <input type="range" min={0} max={100} step={5} value={progress} disabled={readOnly} onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-foreground mb-1.5">Files and links <span className="font-normal text-muted">(evidence of the work)</span></p>
          {readOnly ? (
            attachments.length ? (
              <ul className="space-y-1 text-sm">{attachments.map((a) => <li key={a.publicId ?? a.url}><a href={a.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{a.name}</a></li>)}</ul>
            ) : <p className="text-sm text-muted">None added.</p>
          ) : (
            <AttachmentsField value={attachments} onChange={setAttachments} onUploaded={(f) => { uploads.current.push(f); }} />
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-1.5">Notes <span className="font-normal text-muted">(optional)</span></p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} rows={3} className={clsx(inputClass, "resize-none")} />
        </div>

        {error && <p role="alert" className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-xl">{error}</p>}
      </div>
    </KpiSheet>
  );
}
