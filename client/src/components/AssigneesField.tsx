"use client";

import { X } from "lucide-react";

// "Also working on it": staff besides the owner who work on a deal. They see the deal in their own
// lists and can update it; only the owner, their Business CEO or the Group Owner change who is on it.
export function AssigneesField({ value, onChange, people, ownerId }: {
  value: string[]; onChange: (ids: string[]) => void; people: { id: string; name: string }[]; ownerId?: string;
}) {
  const options = people.filter((p) => p.id !== ownerId && !value.includes(p.id));
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">Also working on it</label>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((id) => (
          <span key={id} className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
            {people.find((p) => p.id === id)?.name ?? "Staff"}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} aria-label="Remove"><X size={11} /></button>
          </span>
        ))}
        {options.length > 0 && (
          <select value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])} className="border border-gray-200 rounded-lg px-2 py-1 text-xs">
            <option value="">+ Add someone</option>
            {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
