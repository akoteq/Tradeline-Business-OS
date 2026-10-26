"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";

const STORAGE_KEY = "trunqo.tasks.groupOrder";

/** Spread this on whatever should be the drag handle (the section header). */
export type DragHandle = Record<string, unknown>;

/**
 * The task sections (Overdue, To do, ...), draggable by their header into any order.
 * The order is remembered on this device. Groups that are empty right now are skipped, and
 * come back in the place you left them.
 *
 *   keys        the groups to show now, in the normal order
 *   renderItem  draws one group; put `{...handle}` on its header
 *   disabled    true while a status card is pinning a group first: the pinned order wins
 */
export function SortableGroups({
  keys,
  renderItem,
  disabled,
  className,
}: {
  keys: string[];
  renderItem: (key: string, handle: DragHandle) => ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [saved, setSaved] = useState<string[]>([]);

  // Load the saved order after mount (localStorage doesn't exist on the server).
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(raw)) setSaved(raw.filter((k): k is string => typeof k === "string"));
    } catch { /* no saved order, keep the normal one */ }
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  // Saved order first, then any group that has no saved place yet.
  const ordered = [...saved.filter((k) => keys.includes(k)), ...keys.filter((k) => !saved.includes(k))];
  const changed = ordered.some((k, i) => k !== keys[i]);

  const persist = (next: string[]) => {
    setSaved(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode: it just won't stick */ }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ordered.indexOf(String(active.id));
    const to = ordered.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(ordered, from, to);
    // Keep the places of groups that aren't on screen right now.
    persist([...next, ...saved.filter((k) => !next.includes(k))]);
  };

  if (disabled) {
    return <div className={className}>{keys.map((k) => <div key={k}>{renderItem(k, {})}</div>)}</div>;
  }

  return (
    <>
      <DndContext id="task-groups" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ordered} strategy={verticalListSortingStrategy}>
          <div className={className}>
            {ordered.map((k) => <SortableItem key={k} id={k} renderItem={renderItem} />)}
          </div>
        </SortableContext>
      </DndContext>

      {changed && (
        <div className="text-sm text-muted">
          <button
            onClick={() => { setSaved([]); try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } }}
            className="font-medium text-accent hover:underline"
          >
            Reset section order
          </button>
        </div>
      )}
    </>
  );
}

function SortableItem({ id, renderItem }: { id: string; renderItem: (key: string, handle: DragHandle) => ReactNode }) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(isDragging && "relative z-20 opacity-95 [&>section]:shadow-pop")}
    >
      {renderItem(id, (listeners ?? {}) as DragHandle)}
    </div>
  );
}
