import type { PipelineStage } from "./PipelineStageChart";
import type { RevenuePoint } from "./RevenueTrendChart";
import type { TeamMemberRow } from "./TeamAttainmentChart";

/**
 * Placeholder numbers for the three charts that need history the API doesn't
 * return yet. Everything here is illustrative — the cards that use it show a
 * "Sample data" badge until useHomeCharts() is pointed at a real endpoint.
 *
 * The figures are shaped to match the live headline (GHS 2.2M received,
 * GHS 1.58M outstanding, 69 active deals) so the page reads coherently.
 */

export const SAMPLE_REVENUE_TREND: RevenuePoint[] = [
  { month: "May", received: 180_000, outstanding: 640_000 },
  { month: "Jun", received: 260_000, outstanding: 790_000 },
  { month: "Jul", received: 310_000, outstanding: 1_050_000 },
  { month: "Aug", received: 420_000, outstanding: 1_310_000 },
  { month: "Sep", received: 470_000, outstanding: 1_490_000 },
  { month: "Oct", received: 570_000, outstanding: 1_580_000 },
];

export const SAMPLE_PIPELINE: PipelineStage[] = [
  { stage: "Prospecting", deals: 28, value: 6_100_000 },
  { stage: "Qualified", deals: 21, value: 5_400_000 },
  { stage: "Proposal sent", deals: 12, value: 4_700_000 },
  { stage: "Negotiation", deals: 8, value: 3_146_099 },
  { stage: "Closed won", deals: 2, value: 1_000_000, won: true },
];

export const SAMPLE_TEAM: TeamMemberRow[] = [
  { name: "Kwame A.", attainment: 112 },
  { name: "Ama S.", attainment: 96 },
  { name: "Yaw O.", attainment: 91 },
  { name: "Efua B.", attainment: 78 },
  { name: "Kofi M.", attainment: 64 },
  { name: "Abena T.", attainment: 52 },
  { name: "Nana D.", attainment: 38 },
  { name: "Esi K.", attainment: 21 },
];
