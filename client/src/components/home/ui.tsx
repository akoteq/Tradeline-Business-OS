"use client";

import Link from "next/link";
import { useId } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { formatLabel, isRiskValue } from "./format";

// Small shared pieces used across the Home tabs.

export function Tag({ value }: { value: string }) {
  const flagged = isRiskValue(value);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        flagged ? "border-accent/25 bg-accent/[0.08] text-accent" : "border-border bg-background text-muted"
      }`}
    >
      {formatLabel(value)}
    </span>
  );
}

export function SectionHeader({
  icon: Icon,
  label,
  cta,
  aside,
}: {
  icon: LucideIcon;
  label: string;
  cta?: { label: string; href: string };
  aside?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Icon size={13} strokeWidth={2.25} />
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{label}</h2>
      </div>
      {cta ? (
        <Link
          href={cta.href}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/25 bg-accent/[0.08] px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {cta.label}
          <ChevronRight size={12} />
        </Link>
      ) : aside ? (
        <span className="shrink-0 text-xs text-muted">{aside}</span>
      ) : null}
    </div>
  );
}

export function GlanceLabel({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
      <Icon size={14} strokeWidth={2} />
      {children}
    </p>
  );
}

/** Tiny trend line for a stat card. Renders nothing under 2 points, so it
 * simply doesn't appear until the API supplies real history. */
function Sparkline({ data }: { data: number[] }) {
  const gradId = `spark-${useId().replace(/:/g, "")}`;
  if (data.length < 2) return null;

  const w = 96;
  const h = 40;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (w - pad * 2),
    h - pad - ((v - min) / span) * (h - pad * 2),
  ]);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-24 shrink-0 text-emerald-600" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Stat({
  icon: Icon,
  label,
  value,
  raw,
  flag = false,
  tone = "default",
  spark,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  raw: number;
  flag?: boolean;
  /** "positive" swaps the icon chip to green — used for growth metrics. */
  tone?: "default" | "positive";
  spark?: number[];
}) {
  const empty = raw === 0 && !flag;
  const chip = tone === "positive" ? "bg-emerald-500/10 text-emerald-600" : "bg-accent/10 text-accent";
  return (
    <div className="relative rounded-2xl border border-border bg-surface px-5 py-5">
      {flag && <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${chip}`}>
          <Icon size={16} strokeWidth={2.25} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div
          className={`text-[2rem] font-bold leading-none tracking-tight md:text-[2.5rem] ${
            flag ? "text-accent" : empty ? "text-muted" : "text-foreground"
          }`}
        >
          {value}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} />}
      </div>
    </div>
  );
}
