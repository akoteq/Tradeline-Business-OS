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
import { CalendarDays, Lock } from "lucide-react";
import { fetcher } from "@/lib/api";
import {
  PAGE_SIZE, PRIORITIES, STAGE_RING, STATUS_LABEL, STATUS_LIST, followUpInfo, groupOf, initials,
  type Lead,
} from "./lib";

// ─── Loading every lead for the board ───────────────────────────────────────
// The list is paged, but a board with one page of leads would be misleading. This pulls pages of
// PAGE_SIZE until it has everything (capped so a huge database can't freeze the browser).
const MAX_LEADS = 2000;

export async function fetchAllLeads(params: Record<string, string>): Promise<{ data: Lead[]; total: number }> {
  const out: Lead[] = [];
  let total = 0;
  for (let skip = 0; skip < MAX_LEADS; skip += PAGE_SIZE) {
    const qs = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)),
      limit: String(PAGE_SIZE),
      skip: String(skip),
    });
    const res: { data: Lead[]; total: number } = await fetcher(`/leads?${qs}`);
    out.push(...res.data);
    total = res.total;
    if (res.data.length < PAGE_SIZE || out.length >= total) break;
  }
  return { data: out, total };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
// Old leads may still carry IN_PROGRESS. There's no column for it, so they sit in Contacted.
const columnOf = (l: Lead) => {
  if (l.status === "IN_PROGRESS") return "CONTACTED";
  return (STATUS_LIST as readonly string[]).includes(l.status) ? l.status : "NEW";
};

const PRIORITY_LABEL: Record<string, string> = Object.fromEntries(PRIORITIES);
const PRIORITY_DOT: Record<string, string> = { HIGH: "bg-red-500", MEDIUM: "bg-amber-500", LOW: "bg-zinc-400" };
const FOLLOW_TONE = { late: "text-red-600", soon: "text-amber-600", ok: "text-muted" };

// Pointer position decides the column; if the pointer is outside every column, fall back to overlap.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

// ─── Card ───────────────────────────────────────────────────────────────────
function CardFace({ lead, locked, overlay }: { lead: Lead; locked?: boolean; overlay?: boolean }) {
  const follow = groupOf(lead) === "closed" ? null : followUpInfo(lead.followUpDate);
  const priority = lead.priority ? PRIORITY_LABEL[lead.priority] : null;
  return (
    <div className={clsx("rounded-lg border border-border bg-surface p-3 text-left", overlay && "rotate-2 shadow-pop")}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{lead.businessName}</p>
        {locked && <Lock size={12} className="mt-1 shrink-0 text-muted" aria-label="Read-only" />}
      </div>
      {lead.contactPerson && <p className="mt-0.5 truncate text-xs text-muted">{lead.contactPerson}</p>}
      <div className="mt-2.5 flex items-center gap-2.5 text-xs">
        {priority && (
          <span className="inline-flex items-center gap-1 text-foreground/70">
            <span className={clsx("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[lead.priority ?? ""] ?? "bg-zinc-400")} />
            {priority}
          </span>
        )}
        {follow && (
          <span className={clsx("inline-flex items-center gap-1", FOLLOW_TONE[follow.tone])}>
            <CalendarDays size={12} />
            {follow.text}
          </span>
        )}
        {lead.bdo && (
          <span
            title={lead.bdo.name}
            className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full bg-foreground/5 text-[10px] font-semibold text-foreground/70"
          >
            {initials(lead.bdo.name)}
          </span>
        )}
      </div>
    </div>
  );
}

function BoardCard({ lead, canEdit, onOpen }: { lead: Lead; canEdit: boolean; onOpen: (l: Lead) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, disabled: !canEdit });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(lead); }}
      className={clsx(
        "select-none [-webkit-touch-callout:none]",
        canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        // the original stays put as a faded placeholder while the copy follows your finger
        isDragging && "opacity-30",
      )}
    >
      <CardFace lead={lead} locked={!canEdit && !lead.archivedAt} />
    </div>
  );
}

// ─── Column ─────────────────────────────────────────────────────────────────
function Column({
  status, leads, isLoading, canEdit, onOpen,
}: { status: string; leads: Lead[]; isLoading: boolean; canEdit: (l: Lead) => boolean; onOpen: (l: Lead) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex w-[82vw] max-w-[18rem] shrink-0 flex-col rounded-xl border transition-colors sm:w-72",
        isOver ? "border-accent bg-accent/5" : "border-border bg-subtle/30",
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className={clsx("h-2 w-2 rounded-full bg-current", STAGE_RING[status])} />
        <h2 className="text-sm font-semibold text-foreground">{STATUS_LABEL[status] ?? status}</h2>
        <span className="ml-auto rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-muted">{isLoading ? "–" : leads.length}</span>
      </header>
      <div className="flex max-h-[62vh] min-h-28 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-[74px] animate-pulse rounded-lg bg-foreground/5" />)
        ) : leads.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-border py-6 text-xs text-muted">
            {isOver ? "Drop here" : "No leads"}
          </div>
        ) : (
          leads.map((l) => <BoardCard key={l.id} lead={l} canEdit={canEdit(l)} onOpen={onOpen} />)
        )}
      </div>
    </section>
  );
}

// ─── Board ──────────────────────────────────────────────────────────────────
/**
 * Pipeline board: one column per stage, drag a card to another column to move the lead.
 *
 *   mouse   click opens the lead; the card only starts moving after you drag it a few pixels
 *   touch   press and hold for a moment, then drag (a quick swipe still scrolls the board)
 *
 * The page does the actual stage change (toast, rollback on error); this only reports the drop.
 */
export function LeadsBoard({
  leads, isLoading, statusFilter, canEdit, onOpen, onMove,
}: {
  leads: Lead[]; isLoading: boolean; statusFilter: string;
  canEdit: (l: Lead) => boolean; onOpen: (l: Lead) => void; onMove: (l: Lead, to: string) => void;
}) {
  const [active, setActive] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  // A stage card at the top of the page narrows the board to the columns it covers.
  const wanted = statusFilter ? statusFilter.split(",") : null;
  const columns = STATUS_LIST.filter(
    (s) => !wanted || wanted.includes(s) || (s === "CONTACTED" && wanted.includes("IN_PROGRESS")),
  );

  const byColumn = new Map<string, Lead[]>(columns.map((c) => [c, []]));
  for (const l of leads) byColumn.get(columnOf(l))?.push(l);

  const onDragStart = ({ active }: DragStartEvent) => setActive(leads.find((l) => l.id === active.id) ?? null);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    const to = String(over.id);
    if (!lead || columnOf(lead) === to) return;
    onMove(lead, to);
  };

  return (
    <DndContext
      id="leads-board"
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-3 md:-mx-6 md:px-6">
        {columns.map((s) => (
          <Column key={s} status={s} leads={byColumn.get(s) ?? []} isLoading={isLoading} canEdit={canEdit} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay>{active ? <CardFace lead={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}