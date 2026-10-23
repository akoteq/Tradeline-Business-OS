"use client";

import { useMemo } from "react";
import { ShieldAlert, Target } from "lucide-react";
import { AgeBucketChart } from "../charts/AgeBucketChart";
import { dealAgeBuckets } from "../charts/derive";
import { DealList } from "../DealList";
import { TabPanel } from "../TabPanel";
import type { Exec, StaleDeal } from "../types";

export function DealsTab({ data, stale }: { data: Exec; stale: StaleDeal[] }) {
  const buckets = useMemo(() => dealAgeBuckets(stale, data.totals.deals), [stale, data.totals.deals]);
  const fresh = buckets[0].count;
  const total = data.totals.deals;

  return (
    <TabPanel className="space-y-10">
      <AgeBucketChart
        title="How recently deals were updated"
        description="All deals, grouped by time since their last update"
        buckets={buckets}
        unit="deal"
        empty="No deals yet. Add one and its activity is tracked here."
        action={{ label: "Review deals", href: "/bapx/pipeline" }}
        insight={
          fresh >= total ? (
            <>Every deal has been updated in the last two weeks.</>
          ) : (
            <>
              Only <strong>{fresh} of {total}</strong> deals were updated in the last two weeks. A deal nobody touches for a month rarely
              closes. Give it an owner, or mark it lost.
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <DealList title="Biggest deals" icon={Target} rows={data.topDeals} amountLabel="Potential value" emptyText="No deals yet." />
        <DealList
          title="Deals most at risk"
          icon={ShieldAlert}
          rows={data.topRisks}
          amountLabel="Value at stake"
          risk
          emptyText="Nothing at risk right now."
        />
      </div>
    </TabPanel>
  );
}
