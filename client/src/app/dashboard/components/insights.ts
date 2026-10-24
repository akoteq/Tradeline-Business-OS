import { AlertCircle, AlertTriangle, CircleDollarSign, TrendingDown, type LucideIcon } from "lucide-react";
import { formatMoney as fmt, formatMoneyCompact as fmtCompact, plural } from "@/lib/format";
import type { CompanyDash, Metric } from "./types";
import { TONE, isFlagged, label } from "./ui";

// ---- Stats: a number, the period it covers, how it moved, and what share it is -----

export type Trend = { text: string; direction: "up" | "down" | "flat"; good: boolean | null };

/** "Up 12% on last month". `goodWhen` says which direction is the healthy one
 * (overdue tasks going down is good news). Returns nothing without a baseline. */
export function describeTrend(current: number, previous: number | undefined, compareLabel: string, goodWhen: "up" | "down"): Trend | undefined {
  if (previous === undefined) return undefined;
  if (current === previous) return { text: `Same as ${compareLabel}`, direction: "flat", good: null };

  const direction = current > previous ? "up" : "down";
  const good = direction === goodWhen;
  const word = direction === "up" ? "Up" : "Down";
  if (previous === 0) return { text: `${word} from 0 ${compareLabel}`, direction, good };

  const raw = (Math.abs(current - previous) / previous) * 100;
  return { text: `${word} ${raw < 1 ? "<1" : Math.round(raw)}% on ${compareLabel}`, direction, good };
}

export type StatData = {
  key: string; label: string; tone: keyof typeof TONE; display: string; scope: string;
  sub?: string; trend?: Trend; flag?: boolean; empty?: boolean; title?: string;
  /** 0 to 1: the share the ring shows. */
  ratio: number;
};

const share = (part: number, whole: number) => (whole > 0 ? Math.min(1, part / whole) : 0);

export function buildStats(data: CompanyDash, isBapx: boolean): StatData[] {
  const { period } = data;

  /** `snapshot` metrics are a state right now (active deals); the rest are
   * totals over time and take the period label when the API supplies one. */
  const pick = (metric: Metric, allTime: number, opts: { snapshot?: boolean; goodWhen?: "up" | "down" } = {}) => {
    const { snapshot = false, goodWhen = "up" } = opts;
    const current = period?.current[metric];
    if (!period || current === undefined) return { value: allTime, scope: snapshot ? "Right now" : "All time", trend: undefined as Trend | undefined };
    return { value: current, scope: snapshot ? "Right now" : period.label, trend: describeTrend(current, period.previous[metric], period.compareLabel, goodWhen) };
  };

  const won = pick("closedWon", data.closedWon);
  const active = pick("active", data.active, { snapshot: true });
  const done = pick("tasksCompleted", data.tasks.completed);
  const totalTasks = data.tasks.open + data.tasks.overdue + data.tasks.completed;

  const third: StatData = isBapx
    ? (() => {
        const overdue = pick("tasksOverdue", data.tasks.overdue, { snapshot: true, goodWhen: "down" });
        const open = data.tasks.open + data.tasks.overdue;
        return {
          key: "overdue", label: "Overdue tasks", tone: overdue.value > 0 ? "warn" : "good", display: String(overdue.value), scope: overdue.scope,
          sub: `of ${plural(open, "open task")}`, trend: overdue.trend, flag: overdue.value > 0, empty: overdue.value === 0, ratio: share(overdue.value, open),
        };
      })()
    : (() => {
        const money = pick("received", data.revenue.revenueReceived);
        const collected = share(data.revenue.revenueReceived, data.revenue.revenuePotential);
        return {
          key: "money-in", label: "Money in", tone: "good", display: fmtCompact(money.value), scope: money.scope, trend: money.trend,
          sub: `of ${fmtCompact(data.revenue.revenuePotential)} expected`, empty: money.value === 0, title: fmt(money.value), ratio: collected,
        };
      })();

  return [
    { key: "won", label: "Deals won", tone: "good", display: String(won.value), scope: won.scope, sub: `of ${plural(data.total, "deal")}`, trend: won.trend, empty: won.value === 0, ratio: share(won.value, data.total) },
    { key: "active", label: "Active deals", tone: "info", display: String(active.value), scope: active.scope, sub: `of ${plural(data.total, "deal")}`, trend: active.trend, empty: active.value === 0, ratio: share(active.value, data.total) },
    third,
    { key: "done", label: "Tasks done", tone: data.tasks.overdue > 0 ? "warn" : "good", display: String(done.value), scope: done.scope, sub: `of ${plural(totalTasks, "task")}`, trend: done.trend, empty: done.value === 0, ratio: share(done.value, totalTasks) },
  ];
}

// ---- Company summary: the fallback if the AI summary request fails -----------------

export function buildSummary(data: CompanyDash): string {
  const parts: string[] = [];
  if (data.finance) {
    const { netProfit } = data.finance;
    if (netProfit > 0) parts.push(`profitable this period at ${fmt(netProfit)} net`);
    else if (netProfit < 0) parts.push(`running at a loss of ${fmt(Math.abs(netProfit))} this period`);
  } else if (!data.source.includes("BAPX") && data.revenue.outstanding > 0) {
    parts.push(`${fmt(data.revenue.outstanding)} still owed by clients`);
  }
  if (data.tasks.overdue > 0) parts.push(`${plural(data.tasks.overdue, "task")} overdue`);
  if (data.active > 0) parts.push(`${plural(data.active, "active deal")} in motion`);
  if (parts.length === 0) return "All clear. Nothing needs your attention right now.";
  return `${parts.join(", ").replace(/^./, (c) => c.toUpperCase())}.`;
}

// ---- Needs your attention: totals first, then the actual deals behind them ----------

export type Alert = { id: string; tone: "bad" | "warn"; icon: LucideIcon; title: string; body: string; tab: string };

export function buildAlerts(data: CompanyDash, isBapx: boolean): Alert[] {
  const alerts: Alert[] = [];

  if (data.tasks.overdue > 0) {
    alerts.push({ id: "overdue", tone: "bad", icon: AlertTriangle, title: `${plural(data.tasks.overdue, "task")} overdue`, body: "Past their due date and still open.", tab: "tasks" });
  }

  const atRisk = data.byHealth.filter((h) => ["risk", "off"].some((w) => h.dealHealth.toLowerCase().includes(w))).reduce((sum, h) => sum + h.count, 0);
  if (atRisk > 0) {
    alerts.push({ id: "risk", tone: "bad", icon: AlertCircle, title: `${plural(atRisk, "deal")} at risk`, body: "Slipping behind and may need your help.", tab: "deals" });
  }

  if (!isBapx && data.revenue.outstanding > 0) {
    alerts.push({ id: "owed", tone: "warn", icon: CircleDollarSign, title: `${fmt(data.revenue.outstanding)} still owed`, body: "Invoiced, but not paid yet.", tab: "deals" });
  }

  if (data.finance && data.finance.netProfit < 0) {
    alerts.push({ id: "loss", tone: "warn", icon: TrendingDown, title: "Spending is higher than income", body: `Net loss of ${fmt(Math.abs(data.finance.netProfit))} this period.`, tab: "finance" });
  }

  // The individual deals that are flagged, so the owner sees names, not just counts.
  data.topDeals
    .filter((d) => isFlagged(d.dealHealth) || (!isBapx && isFlagged(d.invoiceStatus)))
    .slice(0, 3)
    .forEach((d) => alerts.push({
      id: `deal-${d.id}`, tone: "warn", icon: AlertCircle, title: d.businessName,
      body: [label(d.dealHealth), isBapx ? null : `invoice ${label(d.invoiceStatus).toLowerCase()}`].filter(Boolean).join(" · "), tab: "deals",
    }));

  return alerts;
}
