"use client";

import { ChevronRight, ClipboardCheck } from "lucide-react";
import { plural } from "./format";
import type { PendingApproval } from "./types";
import { GlanceLabel } from "./ui";

/** Overview's nudge: the oldest few tasks waiting for approval, opening the Approvals tab. */
export function ApprovalsGlance({ approvals, onOpen }: { approvals: PendingApproval[]; onOpen: () => void }) {
  if (approvals.length === 0) return null;

  return (
    <div className="rounded-2xl border border-accent/25 bg-accent/[0.04] px-6 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <GlanceLabel icon={ClipboardCheck}>Waiting for your approval</GlanceLabel>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/25 bg-accent/[0.08] px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Review {plural(approvals.length, "task")}
          <ChevronRight size={12} />
        </button>
      </div>
      <ul className="divide-y divide-border/70">
        {approvals.slice(0, 3).map((a) => (
          <li key={a.id}>
            <button type="button" onClick={onOpen} className="group flex w-full items-center gap-3 py-3 text-left text-sm transition-colors">
              <span className="min-w-0 flex-1 truncate text-foreground group-hover:text-accent">{a.deliverable}</span>
              <span className="shrink-0 text-xs text-muted">{a.bdo?.name ?? "Unassigned"}</span>
              <ChevronRight size={14} className="shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
