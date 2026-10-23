import type { useCompanies } from "@/lib/companies";

// ---- API shapes -------------------------------------------------------------

export type Urgency = "overdue" | "today" | "1day" | "3days" | "week";

export type Deadline = {
  id: string;
  type: "TRADELINE" | "TASK";
  subtype?: string;
  businessName: string;
  dueDate: string;
  daysUntil: number;
  urgency: Urgency;
  bdo: { id: string; name: string } | null;
};

export type StaleDeal = {
  id: string;
  type: "BAPX" | "TRADELINE" | "COMPANY";
  company?: string;
  businessName: string;
  dealHealth: string;
  lastUpdated: string;
  daysSinceUpdate: number;
  bdo: { id: string; name: string } | null;
};

/**
 * FinancialFlag isn't returned by /alerts yet — FR-19 calls for auto-flags
 * on profit decline, discretionary spend spikes, and burn acceleration, on
 * top of the overdue-task flags already wired. Typed as optional so this
 * compiles and renders nothing until the accounting engine ships it.
 */
export type FinancialFlag = {
  id: string;
  kind: "profit_decline" | "discretionary_spike" | "burn_acceleration";
  businessName: string;
  message: string;
};

export type AlertsResponse = { deadlines: Deadline[]; stale: StaleDeal[]; flags?: FinancialFlag[] };

/**
 * Accounting fields (FR-16–18) and Leads (FR-12) are spec'd but may not be
 * populated by every backend yet — all optional. Sections built on these hide
 * gracefully until real data lands, rather than rendering an empty placeholder.
 */
export type CoSummary = {
  key: string; name: string; slug: string;
  total: number; active: number; closedWon: number;
  revenue: { potential: number; received: number; outstanding: number };
  health?: "on-track" | "at-risk" | "off-track";
  netProfit?: number;
  burnRate?: number;
  roi?: number;
  investment?: number;
};

export type DealRow = { businessName: string; company: string; amount: number; dealStage: string; dealHealth: string };
export type LeadsSummary = { total: number; public: number; private: number; wonThisMonth: number };

export type KpiHealth = { onTrack: number; atRisk: number; offTrack: number; noTarget: number };

export type Exec = {
  totals: {
    deals: number; active: number; closedWon: number;
    potential: number; received: number; outstanding: number;
    netProfit?: number; burnRate?: number; investment?: number;
    /** Daily/weekly count of active deals, oldest → newest. Drives the
     * sparkline on the Active card; the sparkline stays hidden until the
     * API sends this. */
    activeTrend?: number[];
  };
  companies: CoSummary[];
  kpiHealth: KpiHealth;
  topDeals: DealRow[];
  topRisks: DealRow[];
  leads?: LeadsSummary;
};

// ---- View models ------------------------------------------------------------

export type CompanyMap = ReturnType<typeof useCompanies>["byKey"];

export type StaleGroup = { type: StaleDeal["type"]; company: string; bdoName: string | null; count: number; maxDays: number };

/** Everything the Attention views need, computed once in the page. */
export type AttentionModel = {
  /** Sorted most urgent first. */
  deadlines: Deadline[];
  stale: StaleDeal[];
  staleGroups: StaleGroup[];
  flags: FinancialFlag[];
  /** "111 deadlines · 112 deals gone quiet" */
  breakdown: string;
  /** Overdue, due today, or due tomorrow. */
  urgentCount: number;
  /** Deadlines + stale deals + flags — the number on the tab badge. */
  total: number;
};
