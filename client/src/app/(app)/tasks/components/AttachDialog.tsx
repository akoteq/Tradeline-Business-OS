"use client";

import { useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { KpiSheet } from "@/components/kpi";
import { AttachmentsField, discardUploads } from "./Attachments";
import { apiError, type Task, type TaskAttachment } from "./task-utils";

/**
 * Add or remove a task's files and links without opening Edit details.
 * Every change is saved straight away (PUT /tasks/:id with just the attachments), so there is
 * no Save button to forget. The same AttachmentsField as the task form does the uploading.
 *
 * Saves run one after another, so adding two files quickly can't overwrite each other.
 * Files uploaded here that don't end up on the task (the save failed, or you removed them
 * again) are thrown away so they don't sit in storage.
 */
type SaveState = "idle" | "saving" | "saved";

export function AttachDialog({ task, onClose, onSaved, onEditInstead }: {
  task: Task;
  onClose: () => void;
  /** Called after each successful save, so the list refreshes. */
  onSaved: () => void;
  /** Older tasks with no start date can't be saved from here; this opens the full form instead. */
  onEditInstead: () => void;
}) {
  const [items, setItems] = useState<TaskAttachment[]>(task.attachments ?? []);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  const saved = useRef<TaskAttachment[]>(task.attachments ?? []);
  const uploads = useRef<TaskAttachment[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);

  const stored = (list: TaskAttachment[]) => (u: TaskAttachment) => list.some((k) => k.publicId === u.publicId);

  // Only once nothing is left to save: throw away uploads that never made it onto the task.
  // (Doing this after every save would delete a file whose own save is still waiting in line.)
  const settle = () => {
    discardUploads(uploads.current.filter((u) => !stored(saved.current)(u)));
    uploads.current = uploads.current.filter(stored(saved.current));
  };

  const change = (next: TaskAttachment[]) => {
    setItems(next);
    setState("saving");
    setError("");
    pending.current += 1;

    queue.current = queue.current.then(async () => {
      try {
        const res = await api.put(`/tasks/${task.id}`, { attachments: next });
        const list = (res.data as Task).attachments ?? next;
        saved.current = list;
        pending.current -= 1;
        if (pending.current === 0) { settle(); setItems(list); setState("saved"); }
        onSaved();
      } catch (err) {
        pending.current -= 1;
        if (pending.current === 0) { settle(); setItems(saved.current); setState("idle"); }
        setError(apiError(err, "We couldn't save that. Please try again."));
      }
    });
  };

  const needsStartDate = /start date/i.test(error);

  return (
    <KpiSheet
      title="Files and links"
      subtitle={<span className="block truncate">{task.deliverable}</span>}
      onClose={onClose}
      footer={<button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity">Done</button>}
    >
      <AttachmentsField value={items} onChange={change} onUploaded={(file) => { uploads.current.push(file); }} />

      <p aria-live="polite" className="flex min-h-4 items-center gap-1.5 text-xs text-muted">
        {state === "saving" && <><Loader2 size={12} className="animate-spin" /> Saving…</>}
        {state === "saved" && <><Check size={12} className="text-emerald-600" /> Saved to this task</>}
      </p>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-500/5 px-3 py-2 text-sm text-red-600">
          {needsStartDate ? "This task has no start date yet, so it can't be saved from here." : error}
          {needsStartDate && (
            <button type="button" onClick={onEditInstead} className="ml-2 font-medium underline">Open Edit details</button>
          )}
        </div>
      )}
    </KpiSheet>
  );
}
