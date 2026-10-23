"use client";

import { SAMPLE_PIPELINE, SAMPLE_REVENUE_TREND, SAMPLE_TEAM } from "./sampleData";

/**
 * The single switch between sample and live chart data.
 *
 * Today: returns sample numbers for the three charts that need history.
 * When the API is ready, replace the body with something like:
 *
 *   const q = useQuery<HomeCharts>({ queryKey: ["home-charts"], queryFn: () => fetcher("/dashboard/executive/charts") });
 *   return { revenueTrend: q.data?.revenueTrend ?? [], ..., isSample: false };
 *
 * The chart components don't change — they only receive arrays.
 */
export function useHomeCharts() {
  return {
    revenueTrend: SAMPLE_REVENUE_TREND,
    pipelineStages: SAMPLE_PIPELINE,
    teamAttainment: SAMPLE_TEAM,
    isSample: true,
  };
}
