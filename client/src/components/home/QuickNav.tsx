"use client";

import type { LucideIcon } from "lucide-react";

export type NavItem = { id: string; label: string; icon: LucideIcon; count?: number };

/** Tab switcher (not a scroll anchor). */
export function QuickNav({
  items,
  activeId,
  onSelect,
}: {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Dashboard sections" className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
      <ul className="flex gap-7 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 py-3.5 text-sm font-medium tracking-tight transition-colors ${
                  active
                    ? "border-accent font-semibold text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                <item.icon size={16} strokeWidth={2} className={active ? "text-accent" : undefined} />
                {item.label}
                {typeof item.count === "number" && (
                  <span className={`tabular-nums ${active ? "text-accent" : "text-muted/70"}`}>{item.count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
