"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { clsx } from "clsx";
import { Calendar, FileText, Loader2, Paperclip, Target, XCircle, type LucideIcon } from "lucide-react";
import { PriorityPill } from "./TaskBits";
import type { FocusKey } from "./useTaskFocus";
import {
  CATEGORY_ICONS, GROUPS, STATUSES, STATUS_LABEL, categoryOf, fmtDate, isOverdue, isUpcoming,
  type Task,
} from "./task-utils";

// ─── Helpers ────────────────────────────────────────────────────────────────
// Overdue and Blocked aren't stored statuses (the server works them out), so they can't be columns.
// A task sits in the column of its real status; anything unrecognised falls back to To do.
const columnOf = (t: Task) => ((STATUSES as readonly string[]).includes(t.status) ? t.status : "PENDING");

/** What a status card at the top of the page narrows the board to. */
export function matchesFocus(key: FocusKey, t: Task) {
  switch (key) {
    case "done": return t.status === "COMPLETED";
    case "overdue": return isOverdue(t);
    case "blocked": return t.blocked;
    case "upcoming": return isUpcoming(t, 7);
    case "todo": return t.status === "PENDING";
    default: return true;
  }
}

// Column headers reuse the list's group colours so the two views look like one product.
const look = (status: string): { Icon: LucideIcon; wrap: string; title: string } => {
  const key = status === "PENDING" ? "todo" : status === "IN_PROGRESS" ? "progress" : status === "COMPLETED" ? "done" : null;
  const g = key ? GROUPS.find((x) => x.key === key) : null;
  return g ? { Icon: g.Icon, wrap: g.iconWrap, title: g.titleCls } : { Icon: XCircle, wrap: "bg-subtle text-muted", title: "text-muted" };
};

const initials = (name: string) => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
};

// Pointer position decides the column; if the pointer is outside every column, fall back to overlap.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

// ─── Card ───────────────────────────────────────────────────────────────────
type CardActions = {
  onReview?: (t: Task) => void;
  onLogResult: (t: Task) => void;
  onAttach: (t: Task) => void;
};

function CardFace({
  task, showBdo, updating, overlay, actions,
}: { task: Task; showBdo: boolean; updating?: boolean; overlay?: boolean; actions?: CardActions }) {
  const Icon = CATEGORY_ICONS[categoryOf(task)] ?? FileText;
  const overdue = isOverdue(task);
  const files = task.attachments?.length ?? 0;
  const pending = task.approval === "PENDING";
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

  return (
    <div className={clsx("rounded-lg border border-border bg-surface p-3 text-left", overlay && "rotate-2 shadow-pop")}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-subtle text-muted"><Icon size={13} /></span>
        <p className="min-w-0 flex-1 line-clamp-2 text-sm font-medium text-foreground" title={task.deliverable}>{task.deliverable}</p>
        {updating && <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-muted" />}
      </div>

      {task.kpi && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-foreground/70" title="The KPI this task moves">
          <Target size={11} className="shrink-0 text-accent" />
          <span className="truncate">{task.kpi.metric}</span>
        </p>
      )}
      {task.blocked && task.blockedBy.length > 0 && (
        <p className="mt-1 truncate text-xs text-amber-700" title={task.blockedBy.map((b) => b.deliverable).join(", ")}>
          Waiting on {task.blockedBy.map((b) => `“${b.deliverable}”`).join(", ")}
        </p>
      )}

      {(pending || task.needsResult) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {pending && actions?.onReview && (
            <button
              type="button"
              onClick={stop(() => actions.onReview?.(task))}
              className="whitespace-nowrap rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-sky-700"
              title={task.approvedAt ? "A change to approved work is waiting for you" : "Finished work waiting for your approval"}
            >
              Review
            </button>
          )}
          {pending && !actions?.onReview && (
            <span
              className="whitespace-nowrap rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700"
              title={task.approvedAt ? "A change to this approved task is waiting for approval; the approved version counts until then." : "Doesn't count toward KPIs until it's approved."}
            >
              {task.approvedAt ? "Change awaiting approval" : "Awaiting approval"}
            </span>
          )}
          {task.needsResult && (
            <button
              type="button"
              onClick={stop(() => actions?.onLogResult(task))}
              className="whitespace-nowrap rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
              title="This finished task is linked to a KPI, but no result has been logged yet"
            >
              Log a result
            </button>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2 text-xs">
        <PriorityPill value={task.priority} />
        <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap", overdue ? "text-red-600" : "text-foreground/70")}>
          <Calendar size={12} className={overdue ? "text-red-500" : "text-muted"} />
          {fmtDate(task.targetDate)}
        </span>
        {files > 0 && (
          <button
            type="button"
            onClick={stop(() => actions?.onAttach(task))}
            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-muted hover:bg-subtle hover:text-foreground"
            title="Files and links"
          >
            <Paperclip size={12} />{files}
          </button>
        )}
        {showBdo && task.bdo && (
          <span
            title={task.bdo.name}
            className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full bg-foreground/5 text-[10px] font-semibold text-foreground/70"
          >
            {initials(task.bdo.name)}
          </span>
        )}
      </div>
    </div>
  );
}

function BoardCard({
  task, canMove, showBdo, updating, actions, onOpen,
}: { task: Task; canMove: boolean; showBdo: boolean; updating: boolean; actions: CardActions; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !canMove });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(task); }}
      className={clsx(
        "select-none [-webkit-touch-callout:none]",
        canMove ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        // the original stays put as a faded placeholder while the copy follows your finger
        isDragging && "opacity-30",
      )}
    >
      <CardFace task={task} showBdo={showBdo} updating={updating} actions={actions} />
    </div>
  );
}

// ─── Column ─────────────────────────────────────────────────────────────────
function Column({
  status, tasks, canMove, showBdo, isUpdating, actions, onOpen,
}: {
  status: string; tasks: Task[]; canMove: (t: Task) => boolean; showBdo: boolean;
  isUpdating: (t: Task) => boolean; actions: CardActions; onOpen: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { Icon, wrap, title } = look(status);
  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex w-[82vw] max-w-[20rem] shrink-0 flex-col rounded-xl border transition-colors md:w-auto md:max-w-none md:min-w-[16rem] md:flex-1",
        isOver ? "border-accent bg-accent/5" : "border-border bg-subtle/30",
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className={clsx("grid h-6 w-6 place-items-center rounded-full", wrap)}><Icon size={14} /></span>
        <h2 className={clsx("text-sm font-semibold", title)}>{STATUS_LABEL[status] ?? status}</h2>
        <span className="ml-auto rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-muted">{tasks.length}</span>
      </header>
      <div className="flex max-h-[62vh] min-h-28 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {tasks.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-border py-6 text-xs text-muted">
            {isOver ? "Drop here" : "No tasks"}
          </div>
        ) : (
          tasks.map((t) => (
            <BoardCard key={t.id} task={t} canMove={canMove(t)} showBdo={showBdo} updating={isUpdating(t)} actions={actions} onOpen={onOpen} />
          ))
        )}
      </div>
    </section>
  );
}

// ─── Board ──────────────────────────────────────────────────────────────────
/**
 * Task board: To do, In progress, Done and Cancelled. Drag a card to another column to change its status.
 *
 *   mouse   click opens the task; the card only starts moving after you drag it a few pixels
 *   touch   press and hold for a moment, then drag (a quick swipe still scrolls the board)
 *
 * The page does the actual save (toast, result prompt, rollback on error); this only reports the drop.
 */
export function TaskBoard({
  tasks, showBdo, canMove, isUpdating, onOpen, onMove, onReview, onLogResult, onAttach,
}: {
  tasks: Task[]; showBdo: boolean;
  canMove: (t: Task) => boolean; isUpdating: (t: Task) => boolean;
  onOpen: (t: Task) => void; onMove: (t: Task, to: string) => void;
} & CardActions) {
  const [active, setActive] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const byColumn = new Map<string, Task[]>(STATUSES.map((s) => [s, []]));
  for (const t of tasks) byColumn.get(columnOf(t))?.push(t);

  const actions: CardActions = { onReview, onLogResult, onAttach };

  const onDragStart = ({ active }: DragStartEvent) => setActive(tasks.find((t) => t.id === active.id) ?? null);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    const to = String(over.id);
    if (!task || columnOf(task) === to) return;
    onMove(task, to);
  };

  return (
    <DndContext
      id="task-board"
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-3 md:-mx-6 md:px-6">
        {STATUSES.map((s) => (
          <Column
            key={s} status={s} tasks={byColumn.get(s) ?? []} canMove={canMove} showBdo={showBdo}
            isUpdating={isUpdating} actions={actions} onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>{active ? <CardFace task={active} showBdo={showBdo} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}