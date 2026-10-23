"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtCompact, plural } from "../format";
import { ChartCard, ChartEmpty } from "./ChartCard";
import { AXIS_TICK, BAR_CURSOR, COLOR, TooltipShell, ramp } from "./theme";

export type PipelineStage = { stage: string; deals: number; value: number; won?: boolean };

function PipelineTooltip({ active, payload }: { active?: boolean; payload?: { payload?: PipelineStage }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <TooltipShell title={row.stage}>
      <li className="flex justify-between gap-6"><span className="text-muted">Deals</span><span className="font-semibold tabular-nums text-foreground">{row.deals}</span></li>
      <li className="flex justify-between gap-6"><span className="text-muted">Potential value</span><span className="font-semibold tabular-nums text-foreground">{fmtCompact(row.value)}</span></li>
    </TooltipShell>
  );
}

export function PipelineStageChart({ data, sample }: { data: PipelineStage[]; sample?: boolean }) {
  const open = data.filter((d) => !d.won);
  const openTotal = open.reduce((n, d) => n + d.deals, 0);
  const firstStage = open[0];
  const lastOpen = open[open.length - 1];

  const insight =
    openTotal > 0 && firstStage && lastOpen && firstStage !== lastOpen ? (
      <>
        <strong>{plural(firstStage.deals, "deal")}</strong> ({Math.round((firstStage.deals / openTotal) * 100)}% of active) are still at{" "}
        {firstStage.stage}. Only {lastOpen.deals} {lastOpen.deals === 1 ? "has" : "have"} reached {lastOpen.stage}.
      </>
    ) : undefined;

  return (
    <ChartCard
      title="Where your deals are"
      description="Active deals at each stage, across all companies"
      insight={insight}
      sample={sample}
      action={{ label: "Open deals", href: "/bapx/pipeline" }}
    >
      {data.length === 0 ? (
        <ChartEmpty>No deals yet. Add one and the pipeline builds itself here.</ChartEmpty>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }} barCategoryGap={10}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="stage" width={96} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip content={<PipelineTooltip />} cursor={BAR_CURSOR} />
              <Bar dataKey="deals" name="Deals" fill={COLOR.ink} radius={[0, 6, 6, 0]} maxBarSize={24}>
                {data.map((d, i) => (
                  <Cell key={d.stage} fill={d.won ? COLOR.accent : COLOR.ink} fillOpacity={d.won ? 1 : ramp(i, open.length, 0.28, 0.9)} />
                ))}
                <LabelList dataKey="deals" position="right" fontSize={11} fontWeight={600} fill={COLOR.ink} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
