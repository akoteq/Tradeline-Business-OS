"use client";

import { User } from "lucide-react";
import { KpiHealthDonut } from "../charts/KpiHealthDonut";
import { TeamAttainmentChart } from "../charts/TeamAttainmentChart";
import type { useHomeCharts } from "../charts/useHomeCharts";
import { TabPanel } from "../TabPanel";
import type { KpiHealth } from "../types";
import { SectionHeader } from "../ui";

export function TeamTab({ health, charts }: { health: KpiHealth; charts: ReturnType<typeof useHomeCharts> }) {
  const total = health.onTrack + health.atRisk + health.offTrack + health.noTarget;

  return (
    <TabPanel>
      <SectionHeader icon={User} label="Team performance" aside={total > 0 ? `${total} KPIs tracked` : undefined} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KpiHealthDonut health={health} />
        <TeamAttainmentChart rows={charts.teamAttainment} sample={charts.isSample} />
      </div>
    </TabPanel>
  );
}
