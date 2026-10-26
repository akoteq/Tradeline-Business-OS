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
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";

const STORAGE_KEY = "trunqo.tasks.statOrder";

export type StatCard = { key: string; node: ReactNode };

/**
 * The status cards, draggable into any order. The order is remembered on this device.
 *
 *   mouse   click still works; the card only starts moving after you drag it a few pixels
 *   touch   press and hold for a moment, then drag (a quick swipe still scrolls the strip)
 */
export function SortableStats({ cards, className }: { cards: StatCard[]; className?: string }) {
  const defaultOrder = cards.map((c) => c.key);
  const [order, setOrder] = useState<string[]>(defaultOrder);

  // Load the saved order after mount (localStorage doesn't exist on the server).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) setOrder(merge(saved, defaultOrder));
    } catch { /* no saved order, keep the default */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  // Always render in saved order, but never lose a card that was added since.
  const current = merge(order, defaultOrder);
  const byKey = new Map(cards.map((c) => [c.key, c.node]));
  const changed = current.some((k, i) => k !== defaultOrder[i]);

  const save = (next: string[]) => {
    setOrder(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode: order just won't stick */ }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = current.indexOf(String(active.id));
    const to = current.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    save(arrayMove(current, from, to));
  };

  return (
    <>
      <DndContext id="task-stat-cards" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={current} strategy={rectSortingStrategy}>
          <div className={className}>
            {current.map((k) => <SortableItem key={k} id={k}>{byKey.get(k)}</SortableItem>)}
          </div>
        </SortableContext>
      </DndContext>

      {changed && (
        <div className="-mt-1 text-sm text-muted">
          <button
            onClick={() => { setOrder(defaultOrder); try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } }}
            className="font-medium text-accent hover:underline"
          >
            Reset card order
          </button>
        </div>
      )}
    </>
  );
}

function SortableItem({ id, children }: { id: string; children: ReactNode }) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...listeners}
      className={clsx(
        // shrink-0 keeps the card width in the swipeable phone strip; the [&>*] rules make the
        // card fill this wrapper so the grid on larger screens looks the same as before
        "select-none cursor-grab shrink-0 sm:shrink sm:min-w-0 [&>*]:w-full [&>*]:h-full",
        isDragging && "relative z-20 cursor-grabbing opacity-90 [&>*]:shadow-pop",
      )}
    >
      {children}
    </div>
  );
}

/** Saved order first (minus any card that no longer exists), then any new cards at the end. */
function merge(saved: string[], all: string[]) {
  const known = saved.filter((k) => all.includes(k));
  return [...known, ...all.filter((k) => !known.includes(k))];
}
