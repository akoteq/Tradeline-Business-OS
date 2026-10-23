"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, ChartEmpty } from "./ChartCard";
import type { CountBucket } from "./derive";
import { AXIS_TICK, BAR_CURSOR, COLOR, ChartTooltip, ramp } from "./theme";

/**
 * Column chart for "how old is this?" data — overdue deadlines, quiet deals.
 * Buckets run from newest to oldest; the oldest two turn orange because age
 * is the problem. Both the Attention and Deals tabs use it.
 */
export function AgeBucketChart({
  title,
  description,
  buckets,
  unit,
  insight,
  action,
  empty,
}: {
  title: string;
  description: string;
  buckets: CountBucket[];
  /** Singular noun for tooltips: "deadline", "deal". */
  unit: string;
  insight?: ReactNode;
  action?: { label: string; href: string };
  empty: string;
}) {
  const total = buckets.reduce((n, b) => n + b.count, 0);
  const hot = Math.max(0, buckets.length - 2);

  return (
    <ChartCard title={title} description={description} insight={total > 0 ? insight : undefined} action={action}>
      {total === 0 ? (
        <ChartEmpty>{empty}</ChartEmpty>
      ) : (
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={buckets} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="short" tick={AXIS_TICK} axisLine={{ stroke: COLOR.border }} tickLine={false} interval={0} />
              <YAxis hide />
              <Tooltip
                content={
                  <ChartTooltip
                    title={(row) => String(row.label)}
                    format={(n) => `${n} ${unit}${n === 1 ? "" : "s"}`}
                  />
                }
                cursor={BAR_CURSOR}
              />
              <Bar dataKey="count" name={`${unit[0].toUpperCase()}${unit.slice(1)}s`} fill={COLOR.ink} radius={[6, 6, 0, 0]} maxBarSize={44}>
                {buckets.map((b, i) => (
                  <Cell key={b.key} fill={i >= hot ? COLOR.accent : COLOR.ink} fillOpacity={i >= hot ? ramp(i - hot, 2, 0.7, 1) : ramp(i, Math.max(hot, 2), 0.25, 0.55)} />
                ))}
                <LabelList dataKey="count" position="top" fontSize={11} fontWeight={600} fill={COLOR.ink} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
