"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { selectClass } from "./fields";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const label = (s: string) =>
  fromIso(s)?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) ?? "";

type Props = { start: string; end: string; onChange: (start: string, end: string) => void };

export function DateRangePicker({ start, end, onChange }: Props) {
  const today = new Date();
  const [view, setView] = useState(() => {
    const s = fromIso(start) ?? today;
    return new Date(s.getFullYear(), s.getMonth(), 1);
  });

  const y = view.getFullYear();
  const m = view.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // weeks start on Monday
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const years = Array.from(
    new Set([...Array.from({ length: 10 }, (_, i) => today.getFullYear() - 2 + i), y]),
  ).sort((a, b) => a - b);

  const move = (delta: number) => setView(new Date(y, m + delta, 1));
  const jump = (s: Date, e: Date) => {
    onChange(toIso(s), toIso(e));
    setView(new Date(s.getFullYear(), s.getMonth(), 1));
  };

  const pick = (day: number) => {
    const iso = toIso(new Date(y, m, day));
    if (!start || end || iso < start) onChange(iso, ""); // start a new range
    else onChange(start, iso); // finish the range (same day = one-day range)
  };

  const Y = today.getFullYear();
  const q = Math.floor(today.getMonth() / 3);
  const presets: [string, () => void][] = [
    ["This month", () => jump(new Date(Y, today.getMonth(), 1), new Date(Y, today.getMonth() + 1, 0))],
    ["This quarter", () => jump(new Date(Y, q * 3, 1), new Date(Y, q * 3 + 3, 0))],
    [String(Y), () => jump(new Date(Y, 0, 1), new Date(Y, 11, 31))],
    [String(Y + 1), () => jump(new Date(Y + 1, 0, 1), new Date(Y + 1, 11, 31))],
  ];

  return (
    <div className="rounded-xl border border-border p-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map(([text, run]) => (
          <button
            key={text} type="button" onClick={run}
            className="px-2.5 py-1 rounded-full border border-border text-xs text-muted hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            {text}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => move(-1)} aria-label="Previous month" className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5">
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{MONTHS[m]}</span>
          <select
            value={y} onChange={(e) => setView(new Date(Number(e.target.value), m, 1))}
            aria-label="Year" className={selectClass + " !w-auto !py-1 !text-xs"}
          >
            {years.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => move(1)} aria-label="Next month" className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-[11px] text-muted py-1">{d}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const iso = toIso(new Date(y, m, day));
          const isStart = iso === start;
          const isEnd = iso === end;
          const inRange = !!start && !!end && iso > start && iso < end;
          return (
            <button
              key={i} type="button" onClick={() => pick(day)} aria-pressed={isStart || isEnd}
              className={clsx(
                "h-8 text-sm tabular-nums transition-colors",
                isStart || isEnd
                  ? "bg-accent text-accent-foreground rounded-lg font-medium"
                  : inRange
                    ? "bg-accent/10 text-foreground"
                    : "text-foreground hover:bg-foreground/5 rounded-lg",
                iso === toIso(today) && !isStart && !isEnd && "ring-1 ring-border rounded-lg",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted">
        {start && end
          ? `${label(start)} to ${label(end)}`
          : start
            ? `${label(start)} to … pick an end date`
            : "Pick a start date"}
      </p>
    </div>
  );
}