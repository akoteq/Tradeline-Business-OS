"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { plural } from "../format";
import { ChartCard, ChartEmpty } from "./ChartCard";
import type { NameCount } from "./derive";
import { AXIS_TICK, BAR_CURSOR, COLOR, ChartTooltip, truncate } from "./theme";

export function StaleByCompanyChart({ rows }: { rows: NameCount[] }) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  const [a, b] = rows;

  const insight =
    total > 0 && a ? (
      b ? (
        <>
          <strong>{a.name}</strong> and <strong>{b.name}</strong> hold {Math.round(((a.count + b.count) / total) * 100)}% of the deals nobody has
          touched in 2+ weeks.
        </>
      ) : (
        <>
          All <strong>{plural(a.count, "quiet deal")}</strong> sit in {a.name}.
        </>
      )
    ) : undefined;

  return (
    <ChartCard
      title="Where deals have gone quiet"
      description="Deals with no update in over two weeks, by company"
      insight={insight}
      action={{ label: "Review deals", href: "/bapx/pipeline" }}
    >
      {total === 0 ? (
        <ChartEmpty>Every deal has been updated in the last two weeks. Nothing has gone quiet.</ChartEmpty>
      ) : (
        <div className="w-full" style={{ height: Math.max(160, rows.length * 34 + 16) }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }} barCategoryGap={8}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={150} tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: string) => truncate(v, 26)} />
              <Tooltip content={<ChartTooltip format={(n) => plural(n, "deal")} />} cursor={BAR_CURSOR} />
              <Bar dataKey="count" name="Quiet deals" fill={COLOR.ink} radius={[0, 6, 6, 0]} maxBarSize={20}>
                {rows.map((r, i) => (
                  <Cell key={r.name} fill={i === 0 ? COLOR.accent : COLOR.ink} fillOpacity={i === 0 ? 1 : 0.55} />
                ))}
                <LabelList dataKey="count" position="right" fontSize={11} fontWeight={600} fill={COLOR.ink} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
