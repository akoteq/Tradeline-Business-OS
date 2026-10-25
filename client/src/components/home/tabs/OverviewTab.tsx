"use client";

import { Layers, Target, TrendingDown, TrendingUp, Users, Wallet, CheckCircle2 } from "lucide-react";
import { ApprovalsGlance } from "../ApprovalsGlance";
import { AttentionGlance } from "../AttentionGlance";
import { PipelineStageChart } from "../charts/PipelineStageChart";
import { RevenueTrendChart } from "../charts/RevenueTrendChart";
import type { useHomeCharts } from "../charts/useHomeCharts";
import { fmtCompact, fmtSigned } from "../format";
import { TabPanel } from "../TabPanel";
import type { AttentionModel, CompanyMap, Exec, PendingApproval } from "../types";
import { SectionHeader, Stat } from "../ui";

export function OverviewTab({
  data,
  attention,
  byKey,
  activeTrend,
  charts,
  approvals,
  onOpenApprovals,
}: {
  data: Exec;
  attention: AttentionModel;
  byKey: CompanyMap;
  activeTrend?: number[];
  charts: ReturnType<typeof useHomeCharts>;
  approvals: PendingApproval[];
  onOpenApprovals: () => void;
}) {
  const { totals, leads } = data;

  return (
    <TabPanel className="space-y-7">
      <ApprovalsGlance approvals={approvals} onOpen={onOpenApprovals} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat icon={Layers} label="Deals" value={totals.deals} raw={totals.deals} />
        <Stat icon={TrendingUp} label="Active" value={totals.active} raw={totals.active} tone="positive" spark={activeTrend} />
        <Stat icon={Target} label="Closed won" value={totals.closedWon} raw={totals.closedWon} />
        <Stat
          icon={TrendingDown}
          label="Outstanding"
          value={fmtCompact(totals.outstanding)}
          raw={totals.outstanding}
          flag={totals.outstanding > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RevenueTrendChart data={charts.revenueTrend} sample={charts.isSample} />
        </div>
        <div className="lg:col-span-2">
          <PipelineStageChart data={charts.pipelineStages} sample={charts.isSample} />
        </div>
      </div>

      <AttentionGlance attention={attention} byKey={byKey} />

      {/* Accounting engine — FR-16–18. Hidden, not stubbed, until the nightly snapshot job populates these fields. */}
      {typeof totals.netProfit === "number" && (
        <div>
          <SectionHeader icon={Wallet} label="Accounting" aside="Group-wide, this period" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            <Stat icon={Wallet} label="Net profit" value={fmtSigned(totals.netProfit)} raw={totals.netProfit} flag={totals.netProfit < 0} />
            {typeof totals.burnRate === "number" && (
              <Stat icon={TrendingDown} label="Burn rate" value={fmtCompact(totals.burnRate)} raw={totals.burnRate} flag={totals.burnRate > 0} />
            )}
            {typeof totals.investment === "number" && (
              <Stat icon={Layers} label="Invested to date" value={fmtCompact(totals.investment)} raw={totals.investment} />
            )}
          </div>
        </div>
      )}

      {/* Leads — FR-12: the one standing exception to Group Owner scoping. Every lead, every business. */}
      {leads && (
        <div>
          <SectionHeader icon={Users} label="Leads" aside={`${leads.total} across the group`} />
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <Stat icon={Users} label="Public" value={leads.public} raw={leads.public} />
            <Stat icon={Users} label="Private" value={leads.private} raw={leads.private} />
            <Stat icon={CheckCircle2} label="Won this month" value={leads.wonThisMonth} raw={leads.wonThisMonth} />
          </div>
        </div>
      )}
    </TabPanel>
  );
}
