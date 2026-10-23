import type { CoSummary, CompanyMap, Deadline, StaleDeal } from "../types";

/**
 * Chart data that can already be worked out from what /alerts and
 * /dashboard/executive return today. Pure functions — no hooks, no fetching —
 * so they're easy to test and easy to replace when a dedicated endpoint lands.
 */

export type CountBucket = { key: string; short: string; label: string; count: number };

/** Overdue and due-soon deadlines, grouped by how late they are. */
export function overdueAgeBuckets(deadlines: Deadline[]): CountBucket[] {
  const buckets: CountBucket[] = [
    { key: "soon", short: "Today / tomorrow", label: "Due today or tomorrow", count: 0 },
    { key: "week", short: "Up to 1 wk", label: "Up to 1 week overdue", count: 0 },
    { key: "month", short: "1–4 wks", label: "1 to 4 weeks overdue", count: 0 },
    { key: "quarter", short: "1–3 mo", label: "1 to 3 months overdue", count: 0 },
    { key: "old", short: "3+ mo", label: "More than 3 months overdue", count: 0 },
  ];
  for (const d of deadlines) {
    if (d.urgency === "today" || d.urgency === "1day") buckets[0].count += 1;
    else if (d.urgency === "overdue") {
      const days = Math.abs(d.daysUntil);
      buckets[days <= 7 ? 1 : days <= 30 ? 2 : days <= 90 ? 3 : 4].count += 1;
    }
  }
  return buckets;
}

export type NameCount = { name: string; count: number };

/** Stalled deals per company: the biggest few, then "Other". */
export function staleByCompany(stale: StaleDeal[], byKey: CompanyMap, top = 5): NameCount[] {
  const counts = new Map<string, number>();
  for (const d of stale) {
    const name = byKey[d.company ?? ""]?.name ?? d.company ?? d.type;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const head = sorted.slice(0, top);
  const rest = sorted.slice(top).reduce((n, r) => n + r.count, 0);
  return rest > 0 ? [...head, { name: "Other companies", count: rest }] : head;
}

/**
 * How long deals have gone without an update. Only stale deals carry an age,
 * so "updated in the last 2 weeks" is the total minus the stale ones.
 */
export function dealAgeBuckets(stale: StaleDeal[], totalDeals: number): CountBucket[] {
  const buckets: CountBucket[] = [
    { key: "fresh", short: "Last 2 wks", label: "Updated in the last 2 weeks", count: Math.max(0, totalDeals - stale.length) },
    { key: "month", short: "2–4 wks", label: "Quiet for 2 to 4 weeks", count: 0 },
    { key: "quarter", short: "1–3 mo", label: "Quiet for 1 to 3 months", count: 0 },
    { key: "half", short: "3–6 mo", label: "Quiet for 3 to 6 months", count: 0 },
    { key: "old", short: "6+ mo", label: "Quiet for over 6 months", count: 0 },
  ];
  for (const d of stale) {
    const days = d.daysSinceUpdate;
    buckets[days <= 30 ? 1 : days <= 90 ? 2 : days <= 180 ? 3 : 4].count += 1;
  }
  return buckets;
}

export type CompanyMoneyRow = { name: string; received: number; outstanding: number };

/** Money collected vs. still owed per company, biggest book first. Companies with no money yet are left out. */
export function companyMoneyRows(companies: CoSummary[]): CompanyMoneyRow[] {
  return companies
    .map((c) => ({ name: c.name, received: c.revenue.received, outstanding: c.revenue.outstanding }))
    .filter((r) => r.received + r.outstanding > 0)
    .sort((a, b) => b.received + b.outstanding - (a.received + a.outstanding));
}
