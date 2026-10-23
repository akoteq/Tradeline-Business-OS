"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactNumber, fmtCompact } from "../format";
import { ChartCard, ChartEmpty } from "./ChartCard";
import { AXIS_TICK, COLOR, ChartTooltip, GRID } from "./theme";

export type RevenuePoint = { month: string; received: number; outstanding: number };

const growth = (from: number, to: number) => (from > 0 ? Math.round((to / from - 1) * 100) : null);
const move = (pct: number) => `${pct >= 0 ? "up" : "down"} ${Math.abs(pct)}%`;

export function RevenueTrendChart({ data, sample }: { data: RevenuePoint[]; sample?: boolean }) {
  const gradId = `rev-${useId().replace(/:/g, "")}`;
  const first = data[0];
  const last = data[data.length - 1];

  let insight;
  if (first && last && first !== last) {
    const collected = growth(first.received, last.received);
    const owed = growth(first.outstanding, last.outstanding);
    insight =
      collected !== null && owed !== null ? (
        <>
          Monthly collections are <strong>{move(collected)}</strong> since {first.month}, and money owed is{" "}
          <strong>{move(owed)}</strong>.{" "}
          {collected >= owed ? "Collections are keeping pace with billing." : "Billing is outpacing collections."}
        </>
      ) : (
        <>
          In {last.month}: <strong>{fmtCompact(last.received)}</strong> collected, <strong>{fmtCompact(last.outstanding)}</strong> still owed.
        </>
      );
  }

  return (
    <ChartCard
      title="Cash collected vs. still owed"
      description="Collected each month, against what clients still owe at month-end"
      insight={insight}
      sample={sample}
      legend={[
        { label: "Collected in the month", color: COLOR.ink },
        { label: "Still owed at month-end", color: COLOR.accent },
      ]}
    >
      {data.length < 2 ? (
        <ChartEmpty>Revenue history appears here after your first full month of payments.</ChartEmpty>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.ink} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={COLOR.ink} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v: number) => compactNumber.format(v)}
              />
              <Tooltip content={<ChartTooltip format={fmtCompact} />} cursor={{ stroke: COLOR.border }} />
              <Area
                type="monotone"
                dataKey="outstanding"
                name="Still owed"
                stroke={COLOR.accent}
                strokeWidth={2}
                fill="none"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="received"
                name="Collected"
                stroke={COLOR.ink}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
