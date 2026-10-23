"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export type LegendItem = { label: string; color: string; opacity?: number };

/**
 * The one frame every Home chart sits in, so they all read the same way:
 *   title        — what this chart is, in plain words
 *   description  — what the axes mean
 *   insight      — the takeaway, computed from the data (so it stays true on live data)
 *   legend/action— how to read it, and where to act on it
 */
export function ChartCard({
  title,
  description,
  insight,
  legend,
  action,
  sample = false,
  className = "",
  children,
}: {
  title: string;
  description: string;
  insight?: ReactNode;
  legend?: LegendItem[];
  action?: { label: string; href: string };
  /** True while the numbers are illustrative rather than from the API. */
  sample?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={`flex h-full flex-col rounded-2xl border border-border bg-surface p-5 ${className}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        </div>
        {sample && (
          <span
            title="Illustrative numbers. This chart switches to live data once the analytics API is connected."
            className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted"
          >
            Sample data
          </span>
        )}
      </header>

      {insight && <p className="mt-3 text-[13px] leading-snug text-muted [&_strong]:font-semibold [&_strong]:text-foreground">{insight}</p>}

      <div className="mt-4 flex-1">{children}</div>

      {(legend?.length || action) && (
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/70 pt-3">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {legend?.map((l) => (
              <li key={l.label} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: l.color, opacity: l.opacity ?? 1 }} aria-hidden />
                {l.label}
              </li>
            ))}
          </ul>
          {action && (
            <Link href={action.href} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
              {action.label}
              <ChevronRight size={12} />
            </Link>
          )}
        </footer>
      )}
    </section>
  );
}

/** Shown instead of a chart when there is nothing to plot. Say what's missing and what to do. */
export function ChartEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border px-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}
