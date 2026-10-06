"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// The list only needs id + companyName to render; the rest are optional and used by
// forms to auto-fill client details when one is selected.
export type ClientOption = {
  id: string;
  companyName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  valueChain?: string | null;
  region?: string | null;
};

export function ClientSelect({
  value, options, onChange, label = "Client", placeholder = "Search clients…", fallbackLabel,
}: {
  value: string;
  options: ClientOption[];
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  fallbackLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;
  const buttonText = selected?.companyName || fallbackLabel || placeholder;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = query.trim()
    ? options.filter((o) => o.companyName.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs font-medium text-muted block mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent flex items-center justify-between gap-2"
      >
        <span className={`truncate ${selected || fallbackLabel ? "text-foreground" : "text-muted"}`}>
          {buttonText}
        </span>
        <ChevronDown size={14} className="text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg max-h-64 flex flex-col">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            className="px-3 py-2 text-sm bg-transparent text-foreground border-b border-border focus:outline-none shrink-0"
          />
          <div className="overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted text-center">No clients found.</p>
            )}
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onChange(o.id); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/5 transition-colors ${o.id === value ? "bg-accent/10 font-medium text-accent" : "text-foreground"}`}
              >
                {o.companyName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
