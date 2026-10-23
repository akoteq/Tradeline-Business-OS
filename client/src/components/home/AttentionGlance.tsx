"use client";

import Link from "next/link";
import { Bell, ChevronRight, Clock, Flag } from "lucide-react";
import {
  FLAG_LABEL, URGENCY_URGENT, deadlineLink, silentLabel, staleHref, urgencyLabel,
} from "./format";
import type { AttentionModel, CompanyMap } from "./types";
import { GlanceLabel } from "./ui";

/** Overview's compact "what needs me" card: the top overdue deadlines and quietest deal books, each a link. */
export function AttentionGlance({ attention, byKey }: { attention: AttentionModel; byKey: CompanyMap }) {
  const topDeadlines = attention.deadlines.slice(0, 3);
  const topStale = attention.staleGroups.slice(0, 3);
  const flags = attention.flags;
  if (topDeadlines.length === 0 && topStale.length === 0 && flags.length === 0) return null;

  const rowClass = "group flex items-center gap-3 py-3 text-sm transition-colors hover:text-accent";

  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">At a glance</h2>
        {attention.breakdown && <span className="text-xs text-muted">{attention.breakdown}</span>}
      </div>

      <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2">
        {topDeadlines.length > 0 && (
          <div className="sm:pr-8">
            <GlanceLabel icon={Clock}>Deadlines</GlanceLabel>
            <ul className="divide-y divide-border/70">
              {topDeadlines.map((d) => {
                const urgent = URGENCY_URGENT.includes(d.urgency);
                return (
                  <li key={d.id}>
                    <Link href={deadlineLink(d)} className={rowClass}>
                      <span className="min-w-0 flex-1 truncate text-foreground group-hover:text-accent">{d.businessName}</span>
                      <span className={`shrink-0 tabular-nums ${urgent ? "font-semibold text-accent" : "text-muted"}`}>
                        {urgencyLabel(d.urgency, d.daysUntil)}
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {topStale.length > 0 && (
          <div className={topDeadlines.length > 0 ? "sm:border-l sm:border-border/70 sm:pl-8" : ""}>
            <GlanceLabel icon={Bell}>Deals going quiet</GlanceLabel>
            <ul className="divide-y divide-border/70">
              {topStale.map((g, i) => {
                const href = staleHref(g, byKey);
                const content = (
                  <>
                    <span className="min-w-0 flex-1 truncate text-foreground group-hover:text-accent">
                      {g.type} <span className="text-muted">· {g.count} deal{g.count === 1 ? "" : "s"}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-accent">{silentLabel(g.maxDays)}</span>
                    <ChevronRight size={14} className="shrink-0 text-muted" />
                  </>
                );
                return (
                  <li key={i}>
                    {href ? <Link href={href} className={rowClass}>{content}</Link> : <div className={rowClass}>{content}</div>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {flags.length > 0 && (
          <div className="border-t border-border/70 pt-5 sm:col-span-2">
            <GlanceLabel icon={Flag}>Financial signals</GlanceLabel>
            <ul className="divide-y divide-border/70">
              {flags.slice(0, 3).map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0 truncate text-foreground">{f.businessName}</span>
                  <span className="shrink-0 font-semibold text-accent">{FLAG_LABEL[f.kind]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
