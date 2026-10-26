"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/components/Toast";
import { MAX_ATTACHMENTS, MAX_FILE_BYTES, discardUploads, uploadAttachment } from "./Attachments";
import { apiError, type Task, type TaskAttachment } from "./task-utils";

/**
 * Drop files on a task row: each one uploads, then they are saved on the task together
 * (PUT /tasks/:id with just the attachments). Same limits as the task form: 20 MB a file,
 * 20 links and files a task. `busy` holds the ids of tasks that are uploading right now.
 */
export function useQuickAttach(onDone: () => void) {
  const [busy, setBusy] = useState<Set<string>>(new Set());
  // The ref is the guard (it updates at once); the state is only for showing the spinner.
  const active = useRef(new Set<string>());
  const mark = (id: string, on: boolean) => {
    if (on) active.current.add(id); else active.current.delete(id);
    setBusy(new Set(active.current));
  };

  const attach = async (task: Task, dropped: File[]) => {
    if (active.current.has(task.id)) {
      toast.error("Still uploading", { description: "Wait for the current files to finish, then drop the next ones." });
      return;
    }

    const files = dropped.filter((f) => f.size > 0); // folders and empty files can't be uploaded
    if (files.length < dropped.length) toast.error("Some items were skipped", { description: "Folders and empty files can't be attached." });

    const existing = task.attachments ?? [];
    const tooBig = files.filter((f) => f.size > MAX_FILE_BYTES);
    const fits = files.filter((f) => f.size <= MAX_FILE_BYTES);
    const ok = fits.slice(0, Math.max(0, MAX_ATTACHMENTS - existing.length));
    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(", ")} ${tooBig.length === 1 ? "is" : "are"} over 20 MB`);
    if (ok.length < fits.length) toast.error(`A task can have up to ${MAX_ATTACHMENTS} links and files`);
    if (!ok.length) return;

    mark(task.id, true);
    const uploaded: TaskAttachment[] = [];
    const failed: string[] = [];
    try {
      for (const file of ok) {
        try { uploaded.push(await uploadAttachment(file)); }
        catch { failed.push(file.name); }
      }
      if (failed.length) toast.error(`Couldn't upload ${failed.join(", ")}`, { description: "Please try again." });
      if (!uploaded.length) return;

      try {
        await api.put(`/tasks/${task.id}`, { attachments: [...existing, ...uploaded] });
        onDone();
        toast.success(uploaded.length === 1 ? `${uploaded[0].name} attached` : `${uploaded.length} files attached`, { description: task.deliverable });
      } catch (err) {
        discardUploads(uploaded); // they never made it onto the task
        const msg = apiError(err, "We couldn't save the files to this task. Please try again.");
        toast.error("Couldn't attach the files", {
          description: /start date/i.test(msg) ? "This task has no start date yet. Open Edit details, add one, then try again." : msg,
        });
      }
    } finally {
      mark(task.id, false);
    }
  };

  return { attach, busy };
}
