"use client";

import { useState, type DragEvent } from "react";
import { clsx } from "clsx";
import { Calendar, FileText, Loader2, Paperclip, Target, UploadCloud } from "lucide-react";
import { CATEGORY_ICONS, categoryOf, counts, fmtDate, isOverdue, shownStatus, type Task, type TaskGroup } from "./task-utils";
import { PriorityPill, RowMenu, StatusMenu } from "./TaskBits";
import { AttachmentChips } from "./Attachments";

/**
 * One task. From `lg` up it is a single table row (the grid columns come from the page).
 * On phones the same pieces stack into two lines:
 *   line 1  checkbox, icon, name and what it moves
 *   line 2  status, priority, owner, due date
 * The two wrappers use `lg:contents`, so on desktop their children become the grid cells.
 */
export function TaskRow({ task, group, gridCols, showCompany, showBdo, companyName, updating, onToggle, onChangeStatus, onEdit, onDelete, onAttach, onDropFiles, uploading, onLogResult, onReview }: {
  task: Task;
  /** Only the icon colours are used, so a group made on the fly (like "Due in 7 days") works too. */
  group: Pick<TaskGroup, "rowIcon">;
  gridCols: string;
  showCompany: boolean;
  showBdo: boolean;
  companyName: string;
  /** True while this row's status is being saved. */
  updating: boolean;
  onToggle: () => void;
  onChangeStatus: (status: string) => void;
  onEdit: () => void;
  onDelete?: () => void;
  /** Opens the files-and-links dialog, no need to go through Edit details. */
  onAttach: () => void;
  /** Files dropped on the row. They are uploaded and saved on the task, no dialog needed. */
  onDropFiles?: (files: File[]) => void;
  /** True while dropped files are uploading to this task. */
  uploading?: boolean;
  onLogResult: () => void;
  /** Managers only: opens the approve / reject popup for work waiting on them. */
  onReview?: () => void;
}) {
  const category = categoryOf(task);
  const Icon = CATEGORY_ICONS[category] ?? FileText;
  const overdue = isOverdue(task);
  const done = task.status === "COMPLETED";
  const hasFiles = (task.attachments?.length ?? 0) > 0;

  // Drag files from the desktop onto the row to attach them.
  const [over, setOver] = useState(false);
  const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const dragOver = (e: DragEvent) => {
    if (!onDropFiles || !isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setOver(true);
  };
  const dragLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
  };
  const drop = (e: DragEvent) => {
    if (!onDropFiles || !isFileDrag(e)) return;
    e.preventDefault();
    setOver(false);
    const items = Array.from(e.dataTransfer.items ?? []);
    // Skip folders (they show up as files with no content)
    const files = items.length
      ? items.filter((i) => i.kind === "file" && !i.webkitGetAsEntry?.()?.isDirectory).map((i) => i.getAsFile()).filter((f): f is File => !!f)
      : Array.from(e.dataTransfer.files);
    if (files.length) onDropFiles(files);
  };

  return (
    <div
      className={clsx("group/row relative px-4 py-3 lg:py-2.5 lg:grid lg:items-center lg:gap-x-4 transition-colors", over ? "bg-accent/5" : "hover:bg-primary/[0.03]")}
      style={{ gridTemplateColumns: gridCols }}
      onDragEnter={dragOver}
      onDragOver={dragOver}
      onDragLeave={dragLeave}
      onDrop={drop}
    >
      {(over || uploading) && (
        <div
          className={clsx(
            "pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm font-medium",
            over ? "border-2 border-dashed border-accent bg-accent/5 text-accent" : "bg-surface/70 text-muted"
          )}
        >
          {over ? <><UploadCloud size={16} /> Drop to attach to this task</> : <><Loader2 size={16} className="animate-spin" /> Uploading…</>}
        </div>
      )}

      {/* Line 1 */}
      <div className="flex items-start gap-3 pr-9 lg:pr-0 lg:contents">
        <input
          type="checkbox"
          checked={done}
          onChange={onToggle}
          className="mt-2.5 lg:mt-0 h-4 w-4 shrink-0 rounded border-border accent-accent cursor-pointer"
          aria-label={done ? `Reopen "${task.deliverable}"` : `Mark "${task.deliverable}" as done`}
          title={done ? "Reopen" : "Mark as done"}
        />

        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className={clsx("h-9 w-9 rounded-full grid place-items-center shrink-0", group.rowIcon)}>
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground truncate" title={task.deliverable}>{task.deliverable}</div>
            <div className="text-xs text-muted truncate">
              {task.kpi ? (
                <span className="inline-flex items-center gap-1 text-foreground/70" title="The KPI this task moves">
                  <Target size={11} className="text-accent" />{task.kpi.metric}
                </span>
              ) : (
                <>{category} · {task.type === "PROPOSAL" ? "Proposal" : "Task"}</>
              )}
              {task.project && <span title="The project this task is part of"> · {task.project.name}</span>}
              {task.deal && (
                <span title="The deal this task is for">
                  {" "}· {task.deal.name}
                </span>
              )}
            </div>
            {task.blocked && task.blockedBy.length > 0 && (
              <div className="text-xs text-amber-700 truncate" title={task.blockedBy.map((b) => b.deliverable).join(", ")}>
                Waiting on {task.blockedBy.map((b) => `“${b.deliverable}”`).join(", ")}
              </div>
            )}
            {task.completionCriteria && (
              <div className="text-xs text-muted truncate" title={task.completionCriteria}>Done when: {task.completionCriteria}</div>
            )}

            {/* Files and links, with a one-click way to add more (no Edit details needed) */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <AttachmentChips items={task.attachments} max={2} />
              <button
                type="button"
                onClick={onAttach}
                title={hasFiles ? "Add or remove files and links" : "Attach a file or link"}
                aria-label={hasFiles ? "Add or remove files and links" : "Attach a file or link"}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/30"
              >
                <Paperclip size={12} />
                {/* On desktop the word appears when you point at the row; phones always show it */}
                <span className={clsx(hasFiles ? "hidden" : "max-lg:inline lg:hidden lg:group-hover/row:inline")}>Attach</span>
              </button>
            </div>

            {task.rejectedReason && task.approval !== "PENDING" && (
              <div className="text-xs text-red-600 truncate" title={task.rejectedReason}>
                {task.approval === "APPROVED" ? "Change rejected" : "Rejected"}{task.rejectedByEmail ? ` by ${task.rejectedByEmail}` : ""}: {task.rejectedReason}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line 2 on phones, plain table cells from lg up */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-7 lg:mt-0 lg:pl-0 lg:contents">
        <div><PriorityPill value={task.priority} /></div>

        {/* The company is for the Group Owner's table; on a phone the filter covers it */}
        {showCompany && <div className="hidden lg:block text-sm text-foreground/80 truncate">{companyName || "—"}</div>}
        {showBdo && (
          <div className="text-sm text-foreground/80 truncate max-lg:max-w-[45%]">
            {task.bdo?.name ?? <span className="text-muted">Nobody yet</span>}
          </div>
        )}

        <div className={clsx("flex items-center gap-1.5 text-sm whitespace-nowrap", overdue ? "text-red-600" : "text-foreground/70")}>
          <Calendar size={14} className={overdue ? "text-red-500" : "text-muted"} />
          {fmtDate(task.targetDate)}
        </div>

        {/* Status leads on a phone: it is the thing you tap most */}
        <div className="flex flex-wrap items-center gap-1 max-lg:order-first">
          <StatusMenu value={shownStatus(task)} current={task.status} busy={updating} onChange={onChangeStatus} />
          {task.approval === "PENDING" && onReview && (
            <button
              type="button"
              onClick={onReview}
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 whitespace-nowrap"
              title={task.approvedAt ? "A change to approved work is waiting for you" : "Finished work waiting for your approval"}
            >
              Review
            </button>
          )}
          {task.approval === "PENDING" && !onReview && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 whitespace-nowrap"
              title={task.approvedAt ? "A change to this approved task is waiting for approval; the approved version counts until then." : "Doesn't count toward KPIs until it's approved."}
            >
              {task.approvedAt ? "Change awaiting approval" : "Awaiting approval"}
            </span>
          )}
          {task.needsResult && (
            <button
              onClick={onLogResult}
              className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 whitespace-nowrap"
              title="This finished task is linked to a KPI, but no result has been logged yet"
            >
              Log a result
            </button>
          )}
        </div>
      </div>

      {/* Menu: top-right on a phone, last column on desktop */}
      <div className="absolute top-2.5 right-2 lg:static lg:justify-self-end">
        <RowMenu onEdit={onEdit} onDelete={onDelete} onAttach={onAttach} />
      </div>
    </div>
  );
}
