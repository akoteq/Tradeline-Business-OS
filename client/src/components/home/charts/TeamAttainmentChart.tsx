"use client";

import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, ChartEmpty } from "./ChartCard";
import { AXIS_TICK, BAR_CURSOR, COLOR, ChartTooltip } from "./theme";

export type TeamMemberRow = { name: string; attainment: number };

/** Same cut-offs as the KPI Framework: 90%+ of pace is on track, 60–89% at risk, below 60% behind. */
const ON_TRACK = 90;
const AT_RISK = 60;

export function TeamAttainmentChart({ rows, sample }: { rows: TeamMemberRow[]; sample?: boolean }) {
  const sorted = [...rows].sort((a, b) => b.attainment - a.attainment);
  const below = sorted.filter((r) => r.attainment < ON_TRACK);
  const lowest = sorted[sorted.length - 1];

  const insight =
    sorted.length > 0 ? (
      below.length === 0 ? (
        <>Everyone is at or above the {ON_TRACK}% on-track line.</>
      ) : (
        <>
          <strong>{below.length} of {sorted.length} people</strong> are under the {ON_TRACK}% on-track line.{" "}
          {lowest.name} is furthest behind at {lowest.attainment}%.
        </>
      )
    ) : undefined;

  return (
    <ChartCard
      title="Attainment by person"
      description="Each person's KPIs, as a share of where they should be by today"
      insight={insight}
      sample={sample}
      legend={[
        { label: `On track (${ON_TRACK}%+)`, color: COLOR.ink, opacity: 0.85 },
        { label: `At risk (${AT_RISK}–${ON_TRACK - 1}%)`, color: COLOR.accent, opacity: 0.5 },
        { label: `Behind (under ${AT_RISK}%)`, color: COLOR.accent },
      ]}
    >
      {sorted.length === 0 ? (
        <ChartEmpty>No one has KPIs with a target yet. Assign targets and each person appears here.</ChartEmpty>
      ) : (
        <div className="w-full" style={{ height: Math.max(200, sorted.length * 32 + 36) }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 36, left: 0, bottom: 0 }} barCategoryGap={8}>
              <XAxis type="number" domain={[0, 120]} ticks={[0, 30, 60, 90, 120]} tickFormatter={(v: number) => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={84} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip format={(n) => `${n}%`} />} cursor={BAR_CURSOR} />
              <ReferenceLine x={ON_TRACK} stroke={COLOR.ink} strokeDasharray="4 4" strokeOpacity={0.45} />
              <Bar dataKey="attainment" name="Attainment" fill={COLOR.ink} radius={[0, 6, 6, 0]} maxBarSize={18}>
                {sorted.map((r) => (
                  <Cell
                    key={r.name}
                    fill={r.attainment >= ON_TRACK ? COLOR.ink : COLOR.accent}
                    fillOpacity={r.attainment >= ON_TRACK ? 0.85 : r.attainment >= AT_RISK ? 0.5 : 1}
                  />
                ))}
                <LabelList dataKey="attainment" position="right" formatter={(v) => `${v}%`} fontSize={11} fontWeight={600} fill={COLOR.ink} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
