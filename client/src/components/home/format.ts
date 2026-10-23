import { companyHref } from "@/lib/companies";
import type {
  CoSummary, CompanyMap, Deadline, FinancialFlag, StaleDeal, StaleGroup, Urgency,
} from "./types";

// ---- Money ------------------------------------------------------------------
// "GHS 1.6M" / "GHS 19,346,099" — plain code prefix, no ₵ glyph, so numbers
// read the same here as in the AI summary text.

export const compactNumber = new Intl.NumberFormat("en-GH", { notation: "compact", maximumFractionDigits: 1 });
const fullNumber = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 });

export const fmt = (n: number) => {
  const v = n ?? 0;
  return `${v < 0 ? "-" : ""}GHS ${fullNumber.format(Math.abs(v))}`;
};
export const fmtCompact = (n: number) => {
  const v = n ?? 0;
  return `${v < 0 ? "-" : ""}GHS ${compactNumber.format(Math.abs(v))}`;
};
export const fmtSigned = (n: number) => `${n > 0 ? "+" : ""}${fmtCompact(n)}`;

// ---- Copy helpers -----------------------------------------------------------
// Durations read the way a person would say them: under a month it's days,
// from 30 days it's months ("1 month", "8 months"), from a year it's years.
// "250d overdue" is a number to decode; "8 months overdue" is a sentence.

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function formatSpan(days: number) {
  const d = Math.max(0, Math.round(Math.abs(days)));
  if (d < 30) return plural(d, "day");
  if (d < 365) return plural(Math.floor(d / 30), "month");
  return plural(Math.floor(d / 365), "year");
}

export const silentLabel = (days: number) => `Silent over ${formatSpan(days)}`;

export function urgencyLabel(u: Urgency, daysUntil: number) {
  switch (u) {
    case "overdue": return `${formatSpan(daysUntil)} overdue`;
    case "today": return "Due today";
    case "1day": return "Due tomorrow";
    default: return `${formatSpan(daysUntil)} left`;
  }
}

export const FLAG_LABEL: Record<FinancialFlag["kind"], string> = {
  profit_decline: "Profit decline",
  discretionary_spike: "Discretionary spend spike",
  burn_acceleration: "Burn accelerating",
};

export function formatLabel(v: string) {
  return v.replace(/_/g, " ").toLowerCase();
}

const RISK_WORDS = ["risk", "overdue", "off"];
export function isRiskValue(v: string) {
  const lower = v.toLowerCase();
  return RISK_WORDS.some((w) => lower.includes(w));
}

export function todayStamp() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ---- Urgency ----------------------------------------------------------------

export const URGENCY_RANK: Record<Urgency, number> = { overdue: 0, today: 1, "1day": 2, "3days": 3, week: 4 };
export const URGENCY_URGENT: Urgency[] = ["overdue", "today", "1day"];

// ---- Links ------------------------------------------------------------------

const PIPELINE_HREF: Partial<Record<StaleDeal["type"], string>> = {
  BAPX: "/bapx/pipeline",
  TRADELINE: "/tradeline/pipeline",
};

export function deadlineLink(d: Deadline) {
  if (d.type === "TASK") return d.bdo?.name ? `/tasks?bdo=${encodeURIComponent(d.bdo.name)}` : "/tasks";
  return d.bdo?.name ? `${PIPELINE_HREF.TRADELINE}?bdo=${encodeURIComponent(d.bdo.name)}` : PIPELINE_HREF.TRADELINE ?? "/tasks";
}

/** Collapse individual stale deals into one line per (company, owner) — the signal
 * that matters is "this book has gone quiet," not each business name in it. */
export function groupStale(stale: StaleDeal[]): StaleGroup[] {
  const groups = new Map<string, StaleGroup>();
  for (const d of stale) {
    const company = d.company ?? d.type;
    const key = `${company}|${d.bdo?.name ?? "—"}`;
    const g = groups.get(key);
    if (g) {
      g.count += 1;
      g.maxDays = Math.max(g.maxDays, d.daysSinceUpdate);
    } else {
      groups.set(key, { type: d.type, company, bdoName: d.bdo?.name ?? null, count: 1, maxDays: d.daysSinceUpdate });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

export function staleHref(g: StaleGroup, byKey: CompanyMap) {
  const co = byKey[g.company];
  const base = co ? companyHref(co) : PIPELINE_HREF[g.type];
  if (!base) return undefined;
  return g.bdoName ? `${base}?bdo=${encodeURIComponent(g.bdoName)}` : base;
}

export function healthTickClass(health: CoSummary["health"] | undefined, dormant: boolean) {
  if (dormant) return "bg-border";
  switch (health) {
    case "off-track": return "bg-accent";
    case "at-risk": return "bg-accent/45";
    case "on-track": return "bg-foreground/70";
    default: return "bg-foreground/35";
  }
}

/** Dev-only sample series so the Active sparkline's design can be reviewed
 * (open the page with ?previewTrend) before the API ships real history.
 * Never used in production builds. */
export const PREVIEW_TREND = [52, 54, 53, 57, 56, 60, 59, 63, 62, 66, 68];
