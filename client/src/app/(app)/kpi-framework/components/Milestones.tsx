"use client";

import { X } from "lucide-react";
import { Label, inputClass } from "./fields";

// Stepping stones inside the window (e.g. 2 deals by week 2): pace follows them instead of a straight line.
export function Milestones({ value, onChange }: { value: { date: string; target: string }[]; onChange: (v: { date: string; target: string }[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label hint="(optional, for uneven progress)">Milestones</Label>
        <button type="button" onClick={() => onChange([...value, { date: "", target: "" }])} className="text-xs text-accent hover:underline">+ Add milestone</button>
      </div>
      {value.map((m, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input type="date" value={m.date} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className={inputClass} />
          <input type="number" value={m.target} placeholder="Cumulative target" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} className={inputClass} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="p-1 text-muted hover:text-red-600" aria-label="Remove milestone"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
