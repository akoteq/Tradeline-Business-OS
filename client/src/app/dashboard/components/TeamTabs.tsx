"use client";

import { clsx } from "clsx";
import { ClipboardList, Users } from "lucide-react";
import { formatMoney as fmt, plural } from "@/lib/format";
import type { CompanyDash } from "./types";
import { EmptyState, MiniStat, PrimaryLink, SectionHeader, Tag, TextLink, VisibilityTag, card, dueText } from "./ui";

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

export function LeadsTab({ leads }: { leads: NonNullable<CompanyDash["leads"]> }) {
  const pipeline = leads.reduce((sum, l) => sum + l.estimatedValue, 0);
  return (
    <>
      <SectionHeader
        icon={Users}
        title="Leads"
        hint={leads.length
          ? `${plural(leads.length, "lead")} worth ${fmt(pipeline)}. Private leads stay with their owner until they're made public.`
          : "Prospects your team is working before they become paying deals."}
        action={<TextLink href="/leads">Manage leads</TextLink>}
      />
      {leads.length === 0 ? (
        <EmptyState title="No leads yet" body="Add your first prospect to start filling the pipeline." action={<PrimaryLink href="/leads">Add a lead</PrimaryLink>} />
      ) : (
        <ul className={clsx(card, "divide-y divide-border")}>
          {leads.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-subtle/50">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-xs font-medium text-foreground/70">{initials(l.businessName)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{l.businessName}</p>
                <p className="truncate text-xs text-muted">{l.ownerName}</p>
              </div>
              <Tag value={l.stage} />
              <span className="hidden sm:inline-flex"><VisibilityTag visibility={l.visibility} /></span>
              <span className="w-28 shrink-0 whitespace-nowrap text-right font-medium tabular-nums text-foreground">{fmt(l.estimatedValue)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const ORDER = { OVERDUE: 0, OPEN: 1, COMPLETED: 2 } as const;

export function TasksTab({ tasks, list }: { tasks: CompanyDash["tasks"]; list: NonNullable<CompanyDash["taskList"]> }) {
  const total = tasks.open + tasks.overdue + tasks.completed;
  const pct = total ? Math.round((tasks.completed / total) * 100) : 0;
  return (
    <div className="space-y-3">
      <SectionHeader icon={ClipboardList} title="Tasks" hint="What your team is working on right now." action={<TextLink href="/tasks">Open all tasks</TextLink>} />

      <div className={clsx(card)}>
        <div className="grid grid-cols-3 divide-x divide-border">
          <MiniStat label="Open" value={tasks.open} />
          <MiniStat label="Overdue" value={tasks.overdue} flag={tasks.overdue > 0} />
          <MiniStat label="Completed" value={tasks.completed} />
        </div>
        {total > 0 && (
          <div className="flex items-center gap-3 border-t border-border px-4 py-3">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
              <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-xs tabular-nums text-muted">{pct}% complete</span>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState title="Individual tasks are coming soon" body="The counts above are live. The tasks behind each number will be listed here shortly." action={<PrimaryLink href="/tasks">Open tasks</PrimaryLink>} />
      ) : (
        <ul className={clsx(card, "divide-y divide-border")}>
          {list.slice().sort((a, b) => ORDER[a.status] - ORDER[b.status]).map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-subtle/50">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{t.title}</p>
                <p className="truncate text-xs text-muted">{t.assigneeName}</p>
              </div>
              <span className={clsx("w-28 shrink-0 whitespace-nowrap text-right text-xs", t.status === "OVERDUE" ? "font-medium text-accent" : "text-muted")}>{dueText(t.dueDate, t.status)}</span>
              <Tag value={t.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
