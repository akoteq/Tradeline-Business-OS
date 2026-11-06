"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Unit = "week" | "month" | "year" | "custom";
type Props = { startDate: string; endDate: string; onChange: (start: string, end: string) => void };

const UNITS: { key: Unit; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "custom", label: "Custom" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Parse as a local date so timezones never shift the day.
const fromISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

// Weeks run Monday to Sunday.
function rangeFor(unit: Exclude<Unit, "custom">, anchor: Date): [Date, Date] {
  const y = anchor.getFullYear(), m = anchor.getMonth(), d = anchor.getDate();
  if (unit === "week") {
    const offset = (anchor.getDay() + 6) % 7;
    return [new Date(y, m, d - offset), new Date(y, m, d - offset + 6)];
  }
  if (unit === "month") return [new Date(y, m, 1), new Date(y, m + 1, 0)];
  return [new Date(y, 0, 1), new Date(y, 11, 31)];
}

function shift(unit: Exclude<Unit, "custom">, anchor: Date, dir: 1 | -1): Date {
  const y = anchor.getFullYear(), m = anchor.getMonth(), d = anchor.getDate();
  if (unit === "week") return new Date(y, m, d + 7 * dir);
  if (unit === "month") return new Date(y, m + dir, 1);
  return new Date(y + dir, 0, 1);
}

function detectUnit(start: string, end: string): Unit {
  if (!start || !end) return "month";
  for (const u of ["week", "month", "year"] as const) {
    const [a, b] = rangeFor(u, fromISO(start));
    if (toISO(a) === start && toISO(b) === end) return u;
  }
  return "custom";
}

function label(unit: Exclude<Unit, "custom">, start: Date, end: Date) {
  if (unit === "year") return String(start.getFullYear());
  if (unit === "month") return start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const a = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const b = end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${a} – ${b}`;
}

const inputCls =
  "w-full bg-surface text-foreground border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent";

export function PeriodPicker({ startDate, endDate, onChange }: Props) {
  const [unit, setUnit] = useState<Unit>(() => detectUnit(startDate, endDate));

  const apply = (u: Exclude<Unit, "custom">, anchor: Date) => {
    const [a, b] = rangeFor(u, anchor);
    onChange(toISO(a), toISO(b));
  };

  // New KPI with no dates yet: start on the current month so Continue works straight away.
  useEffect(() => {
    if (!startDate && !endDate) apply("month", new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickUnit = (u: Unit) => {
    setUnit(u);
    if (u !== "custom") apply(u, startDate ? fromISO(startDate) : new Date());
  };

  const today = toISO(new Date());
  const hasRange = !!startDate && !!endDate;
  const invalid = hasRange && startDate > endDate;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted mb-1.5">Period</p>
        <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-subtle" role="tablist" aria-label="Period type">
          {UNITS.map((u) => (
            <button
              key={u.key} type="button" role="tab" aria-selected={unit === u.key}
              onClick={() => pickUnit(u.key)}
              className={clsx(
                "py-1.5 rounded-md text-sm font-medium transition-colors",
                unit === u.key ? "bg-surface text-foreground shadow-card" : "text-muted hover:text-foreground"
              )}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {unit !== "custom" ? (
        <>
          {hasRange && (() => {
            const a = fromISO(startDate), b = fromISO(endDate);
            const current = startDate <= today && today <= endDate;
            return (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2 py-2">
                <button type="button" aria-label={`Previous ${unit}`} onClick={() => apply(unit, shift(unit, a, -1))}
                  className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-subtle"><ChevronLeft size={18} /></button>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">{label(unit, a, b)}</p>
                  {current && <p className="text-xs text-accent">This {unit}</p>}
                </div>
                <button type="button" aria-label={`Next ${unit}`} onClick={() => apply(unit, shift(unit, a, 1))}
                  className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-subtle"><ChevronRight size={18} /></button>
              </div>
            );
          })()}

          <div>
            <label className="text-xs font-medium text-muted block mb-1">Or jump to a date</label>
            <input
              type="date" value={startDate} className={inputCls}
              onChange={(e) => e.target.value && apply(unit, fromISO(e.target.value))}
            />
            <p className="text-xs text-muted mt-1">We'll use the {unit} that date falls in.</p>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Start date</label>
            <input type="date" value={startDate} max={endDate || undefined} className={inputCls}
              onChange={(e) => onChange(e.target.value, endDate)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">End date</label>
            <input type="date" value={endDate} min={startDate || undefined} className={inputCls}
              onChange={(e) => onChange(startDate, e.target.value)} />
          </div>
        </div>
      )}

      {invalid && <p className="text-xs text-red-600">The end date can't be before the start date.</p>}
    </div>
  );
}