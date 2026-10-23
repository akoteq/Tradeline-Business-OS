"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactNumber, fmtCompact } from "../format";
import { ChartCard, ChartEmpty } from "./ChartCard";
import type { CompanyMoneyRow } from "./derive";
import { AXIS_TICK, BAR_CURSOR, COLOR, ChartTooltip, GRID, truncate } from "./theme";

const ROW_HEIGHT = 34;

export function CompanyRevenueChart({ rows }: { rows: CompanyMoneyRow[] }) {
  const totalReceived = rows.reduce((n, r) => n + r.received, 0);
  const topEarner = [...rows].sort((a, b) => b.received - a.received)[0];
  const mostOwed = [...rows].sort((a, b) => b.outstanding - a.outstanding)[0];

  const insight =
    topEarner && mostOwed && totalReceived > 0 ? (
      <>
        <strong>{topEarner.name}</strong> brings in {Math.round((topEarner.received / totalReceived) * 100)}% of everything collected
        {mostOwed.outstanding > 0 && mostOwed.name === topEarner.name && <> and is also owed the most: {fmtCompact(mostOwed.outstanding)}</>}
        .{" "}
        {mostOwed.outstanding > 0 && mostOwed.name !== topEarner.name && (
          <>
            <strong>{mostOwed.name}</strong> is owed the most: {fmtCompact(mostOwed.outstanding)}
            {mostOwed.outstanding > mostOwed.received ? ", more than it has collected so far" : ""}.
          </>
        )}
      </>
    ) : undefined;

  return (
    <ChartCard
      title="Revenue by company"
      description="What each company has collected, and what clients still owe it"
      insight={insight}
      legend={[
        { label: "Collected", color: COLOR.ink },
        { label: "Still owed", color: COLOR.accent },
      ]}
    >
      {rows.length === 0 ? (
        <ChartEmpty>No payments recorded yet. Once a company logs revenue, it shows up here.</ChartEmpty>
      ) : (
        <div className="w-full" style={{ height: Math.max(180, rows.length * ROW_HEIGHT + 28) }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap={8}>
              <CartesianGrid {...GRID} horizontal={false} />
              <XAxis
                type="number"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => compactNumber.format(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={176}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => truncate(v, 30)}
              />
              <Tooltip content={<ChartTooltip format={fmtCompact} />} cursor={BAR_CURSOR} />
              <Bar dataKey="received" name="Collected" stackId="money" fill={COLOR.ink} radius={[6, 0, 0, 6]} maxBarSize={20} />
              <Bar dataKey="outstanding" name="Still owed" stackId="money" fill={COLOR.accent} radius={[0, 6, 6, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
