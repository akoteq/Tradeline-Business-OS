"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { plural } from "../format";
import type { KpiHealth } from "../types";
import { ChartCard, ChartEmpty } from "./ChartCard";
import { COLOR, ChartTooltip } from "./theme";

const SEGMENTS = [
  { key: "onTrack", name: "On track", color: COLOR.ink, opacity: 0.85 },
  { key: "atRisk", name: "At risk", color: COLOR.accent, opacity: 0.5 },
  { key: "offTrack", name: "Off track", color: COLOR.accent, opacity: 1 },
  { key: "noTarget", name: "No target yet", color: COLOR.border, opacity: 1 },
] as const;

export function KpiHealthDonut({ health }: { health: KpiHealth }) {
  const total = health.onTrack + health.atRisk + health.offTrack + health.noTarget;
  const judged = total - health.noTarget;
  const data = SEGMENTS.map((s) => ({ ...s, value: health[s.key] })).filter((s) => s.value > 0);

  let insight;
  if (total > 0 && judged === 0) {
    insight = <>None of your {plural(total, "KPI")} has a target yet, so nothing can be judged. Set targets to start tracking progress.</>;
  } else if (judged > 0) {
    const behind = health.atRisk + health.offTrack;
    insight = (
      <>
        <strong>{health.onTrack} of {judged}</strong> KPIs with a target are on track ({Math.round((health.onTrack / judged) * 100)}%).{" "}
        {behind > 0 && <>{health.offTrack} off track and {health.atRisk} at risk need a look. </>}
        {health.noTarget > 0 && <>{plural(health.noTarget, "KPI")} still {health.noTarget === 1 ? "has" : "have"} no target.</>}
      </>
    );
  }

  return (
    <ChartCard
      title="KPI health"
      description="Every KPI, judged against where it should be by today"
      insight={insight}
      action={{ label: "Open KPI Framework", href: "/kpi-framework" }}
    >
      {total === 0 ? (
        <ChartEmpty>No KPIs yet. Add one in Company KPIs and its status shows up here.</ChartEmpty>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={data.length > 1 ? 3 : 0}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {data.map((s) => (
                    <Cell key={s.key} fill={s.color} fillOpacity={s.opacity} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip format={(n) => plural(n, "KPI")} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold leading-none tracking-tight text-foreground tabular-nums">{total}</span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">KPIs</span>
            </div>
          </div>

          <ul className="min-w-[160px] flex-1 space-y-2.5">
            {SEGMENTS.map((s) => (
              <li key={s.key} className="flex items-center gap-2.5 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color, opacity: s.opacity }} aria-hidden />
                <span className="text-muted">{s.name}</span>
                <span className="ml-auto font-semibold tabular-nums text-foreground">{health[s.key]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
