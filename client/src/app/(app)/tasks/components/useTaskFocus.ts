"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { GROUPS, groupOf, isUpcoming, type GroupKey, type Task, type TaskGroup } from "./task-utils";

/**
 * "Show these first": clicking a status card moves that group to the top of the list.
 * Click it again to go back to the normal order. The choice is remembered on this device.
 *
 * "Due in 7 days" isn't one of the status groups, so it becomes its own group at the top and
 * those tasks are taken out of the groups below (a task never shows twice).
 */
export type FocusKey = GroupKey | "upcoming";
export type ShownGroup = Omit<TaskGroup, "key"> & { key: string; tasks: Task[] };

export const FOCUS_LABEL: Record<FocusKey, string> = {
  overdue: "Overdue", blocked: "Blocked", progress: "In progress", todo: "To do", done: "Done", upcoming: "Due in 7 days",
};

const STORAGE_KEY = "tasks:show-first";
const VALID = new Set<string>([...GROUPS.map((g) => g.key), "upcoming"]);

const UPCOMING_GROUP: Omit<ShownGroup, "tasks"> = {
  key: "upcoming",
  title: "Due in 7 days",
  Icon: CalendarClock,
  header: "bg-gradient-to-r from-blue-50 to-transparent",
  iconWrap: "bg-blue-500 text-white",
  titleCls: "text-blue-700",
  rowIcon: "bg-blue-50 text-blue-600",
};

export function useTaskFocus() {
  const [focus, setFocusState] = useState<FocusKey | null>(null);

  // Read the saved choice after mount, so server and browser render the same first paint.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && VALID.has(saved)) setFocusState(saved as FocusKey);
    } catch { /* storage can be blocked; the choice just won't be remembered */ }
  }, []);

  const setFocus = (next: FocusKey | null) => {
    setFocusState(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* see above */ }
  };

  const toggle = (key: FocusKey) => setFocus(focus === key ? null : key);
  const clear = () => setFocus(null);

  /** The visible tasks, grouped, with the chosen group first. Empty groups are dropped. */
  const arrange = (visible: Task[]): ShownGroup[] => {
    const pulled = focus === "upcoming" ? visible.filter((t) => isUpcoming(t, 7)) : [];
    const pulledIds = new Set(pulled.map((t) => t.id));
    const groups: ShownGroup[] = GROUPS
      .map((g) => ({ ...g, tasks: visible.filter((t) => groupOf(t) === g.key && !pulledIds.has(t.id)) }))
      .filter((g) => g.tasks.length > 0);

    if (focus === "upcoming") return pulled.length ? [{ ...UPCOMING_GROUP, tasks: pulled }, ...groups] : groups;
    if (!focus) return groups;
    return [...groups.filter((g) => g.key === focus), ...groups.filter((g) => g.key !== focus)];
  };

  return { focus, toggle, clear, arrange };
}
