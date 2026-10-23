import type { ReactNode } from "react";

/**
 * Chart look — mirrors the Home page's type system: neutral ink for the
 * baseline, the orange accent for "look here". Colors come from your CSS
 * tokens; the hex fallbacks only apply if a token is missing.
 */
export const COLOR = {
  ink: "var(--color-foreground, #1f1b16)",
  accent: "var(--color-accent, #d9541e)",
  muted: "var(--color-muted, #7b746a)",
  border: "var(--color-border, #e6dfd2)",
} as const;

export const AXIS_TICK = { fontSize: 11, fill: COLOR.muted } as const;
export const GRID = { stroke: COLOR.border, strokeDasharray: "3 3" } as const;
export const BAR_CURSOR = { fill: "rgba(120, 110, 95, 0.08)" } as const;

/** Opacity ramp: light → heavy across n items. Used where "later" or "older" means "more serious". */
export const ramp = (i: number, n: number, min = 0.3, max = 0.9) =>
  n <= 1 ? max : min + (max - min) * (i / (n - 1));

/** Shorten long labels for axis ticks; the full name stays in the tooltip. */
export const truncate = (s: string, max = 20) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// ---- Tooltip ----------------------------------------------------------------

export function TooltipShell({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-[140px] rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      {title != null && <p className="mb-1.5 font-semibold text-foreground">{title}</p>}
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

type TipRow = {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

export type ChartTooltipProps = {
  active?: boolean;
  payload?: TipRow[];
  label?: string | number;
  /** How to print each value: money, "12 deals", "84%". */
  format?: (n: number) => string;
  /** Override the heading using the hovered row (e.g. show a long bucket name). */
  title?: (row: Record<string, unknown>) => string;
};

export function ChartTooltip({ active, payload, label, format = (n) => n.toLocaleString(), title }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const heading = title && row ? title(row) : label;
  return (
    <TooltipShell title={heading}>
      {payload.map((p, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto pl-4 font-semibold tabular-nums text-foreground">
            {typeof p.value === "number" ? format(p.value) : p.value}
          </span>
        </li>
      ))}
    </TooltipShell>
  );
}
