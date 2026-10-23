"use client";

import type { LucideIcon } from "lucide-react";
import { fmt } from "./format";
import type { DealRow } from "./types";
import { SectionHeader, Tag } from "./ui";

export function DealList({
  title,
  icon,
  rows,
  amountLabel,
  risk,
  emptyText,
}: {
  title: string;
  icon: LucideIcon;
  rows: DealRow[];
  amountLabel: string;
  risk?: boolean;
  emptyText: string;
}) {
  return (
    <div>
      <SectionHeader icon={icon} label={title} aside={amountLabel} />
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted">{emptyText}</div>
      ) : (
        <ul className="divide-y divide-dashed divide-border rounded-2xl border border-border bg-surface">
          {rows.map((d, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-background/50">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{d.businessName}</p>
                <p className="truncate text-xs text-muted">{d.company}</p>
              </div>
              <Tag value={risk ? d.dealHealth : d.dealStage} />
              <span className="w-28 shrink-0 whitespace-nowrap text-right font-medium tabular-nums text-foreground">{fmt(d.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
