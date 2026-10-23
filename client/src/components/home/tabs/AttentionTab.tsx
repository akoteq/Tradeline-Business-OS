"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ChevronRight, Clock, Flag } from "lucide-react";
import { AgeBucketChart } from "../charts/AgeBucketChart";
import { overdueAgeBuckets, staleByCompany } from "../charts/derive";
import { StaleByCompanyChart } from "../charts/StaleByCompanyChart";
import {
  FLAG_LABEL, URGENCY_URGENT, deadlineLink, plural, silentLabel, staleHref, urgencyLabel,
} from "../format";
import { TabPanel } from "../TabPanel";
import type { AttentionModel, CompanyMap } from "../types";
import { SectionHeader } from "../ui";

export function AttentionTab({ attention, byKey }: { attention: AttentionModel; byKey: CompanyMap }) {
  const { deadlines, stale, staleGroups, flags, breakdown } = attention;

  const ageBuckets = useMemo(() => overdueAgeBuckets(deadlines), [deadlines]);
  const staleRows = useMemo(() => staleByCompany(stale, byKey), [stale, byKey]);

  const visibleDeadlines = deadlines.slice(0, 4);
  const visibleStaleGroups = staleGroups.slice(0, 3);
  const visibleFlags = flags.slice(0, 4);

  const oldest = ageBuckets[ageBuckets.length - 1];
  const dueTotal = ageBuckets.reduce((n, b) => n + b.count, 0);

  return (
    <TabPanel className="space-y-8">
      <p className="text-xs text-muted">{breakdown}</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgeBucketChart
          title="How late are your deadlines?"
          description="Overdue and due-soon deadlines, grouped by how long they've been late"
          buckets={ageBuckets}
          unit="deadline"
          empty="No overdue deadlines. Nice work."
          action={{ label: "Open tasks", href: "/tasks" }}
          insight={
            oldest.count > 0 ? (
              <>
                <strong>{oldest.count} of {dueTotal}</strong> ({Math.round((oldest.count / dueTotal) * 100)}%) are over 3 months late. Most
                are probably forgotten rather than late. Close or reschedule them in bulk.
              </>
            ) : (
              <>Nothing is more than 3 months late.</>
            )
          }
        />
        <StaleByCompanyChart rows={staleRows} />
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
        {visibleDeadlines.length > 0 && (
          <div>
            <SectionHeader
              icon={Clock}
              label="Deadlines"
              cta={deadlines.length > visibleDeadlines.length ? { label: `View all ${deadlines.length}`, href: "/tasks" } : undefined}
            />
            <ul className="divide-y divide-dashed divide-border">
              {visibleDeadlines.map((d) => {
                const urgent = URGENCY_URGENT.includes(d.urgency);
                return (
                  <li key={d.id}>
                    <Link href={deadlineLink(d)} className="group flex items-center gap-3 py-3 text-sm transition-colors hover:bg-surface/60">
                      <span className={`h-full w-[3px] self-stretch rounded-full ${urgent ? "bg-accent" : "bg-border"}`} aria-hidden />
                      <Clock size={14} className={urgent ? "shrink-0 text-accent" : "shrink-0 text-muted"} />
                      <span className="min-w-0 flex-1 truncate text-foreground">{d.businessName}</span>
                      <span className={`shrink-0 text-xs font-medium tabular-nums ${urgent ? "text-accent" : "text-muted"}`}>
                        {urgencyLabel(d.urgency, d.daysUntil)}
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {visibleStaleGroups.length > 0 && (
          <div>
            <SectionHeader
              icon={AlertTriangle}
              label="Deals going quiet"
              aside={staleGroups.length > visibleStaleGroups.length ? `+${staleGroups.length - visibleStaleGroups.length} more owners` : undefined}
            />
            <ul className="divide-y divide-dashed divide-border">
              {visibleStaleGroups.map((g, i) => {
                const co = byKey[g.company];
                const href = staleHref(g, byKey);
                const content = (
                  <div className="group flex items-center gap-3 py-3 text-sm transition-colors hover:bg-surface/60">
                    <span className="h-full w-[3px] self-stretch rounded-full bg-accent/60" aria-hidden />
                    <AlertTriangle size={14} className="shrink-0 text-accent" />
                    <span className="shrink-0 font-semibold tabular-nums text-accent">{silentLabel(g.maxDays)}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">
                      {plural(g.count, `${co?.name ?? g.type} deal`)}
                      {g.bdoName ? <> · {g.bdoName}</> : ""}
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                );
                return <li key={i}>{href ? <Link href={href}>{content}</Link> : content}</li>;
              })}
            </ul>
          </div>
        )}

        {/* Renders only once /alerts actually returns flags. Nothing to configure here. */}
        {visibleFlags.length > 0 && (
          <div>
            <SectionHeader
              icon={Flag}
              label="Financial flags"
              aside={flags.length > visibleFlags.length ? `+${flags.length - visibleFlags.length} more` : undefined}
            />
            <ul className="divide-y divide-dashed divide-border">
              {visibleFlags.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-3 text-sm">
                  <span className="h-full w-[3px] self-stretch rounded-full bg-accent" aria-hidden />
                  <Flag size={14} className="shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground">{f.businessName}</p>
                    <p className="truncate text-xs text-muted">{FLAG_LABEL[f.kind]}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </TabPanel>
  );
}
