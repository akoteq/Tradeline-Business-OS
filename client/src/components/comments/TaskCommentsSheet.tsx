"use client";

import { useEffect } from "react";
import { MessageSquare, X } from "lucide-react";
import { CommentThread, useThread } from "./CommentThread";

/**
 * A side panel with a task's comments. Tasks open into a multi-step edit form, which is no place
 * for a conversation, so comments get their own panel: from the row's Comments button, or from a
 * notification link (/tasks?task=…&comment=…).
 */
export function TaskCommentsSheet({ taskId, title, subtitle, focusCommentId, onClose }: {
  taskId: string;
  /** Shown straight away; otherwise the title comes with the thread. */
  title?: string;
  subtitle?: string;
  focusCommentId?: string | null;
  onClose: () => void;
}) {
  const { data } = useThread("TASK", taskId);
  const heading = title ?? data?.entity.title ?? "Task";

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-primary/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={`Comments on ${heading}`}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-xl"
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><MessageSquare size={16} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg leading-snug text-foreground">{heading}</h2>
            <p className="text-xs text-muted">{subtitle ?? "Comments on this task"}</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-muted transition-colors hover:text-foreground" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <CommentThread entityType="TASK" entityId={taskId} focusCommentId={focusCommentId} />
        </div>
      </div>
    </div>
  );
}
