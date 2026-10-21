import {
  TrendingUp, Clock, Target, CalendarDays, Database, ShieldCheck, Users, FileText, Percent, Gauge, BarChart3,
  type LucideIcon,
} from "lucide-react";
import type { KpiRow, KpiDef } from "@/components/kpi";
import type { AccessLevel } from "@/lib/auth";

// ─── Types ──────────────────────────────────────────────────────────────────
export type AutoKey = { key: string; label: string; unit: string; kind: string };
export type Dept = { department: string; count: number };
export type Category = { id: string; name: string; company: string; status: string; kpiCount: number };
export type Bdo = { id: string; name: string; company: string };
export type ReviewStatus = "DRAFT" | "TARGET_SET" | "ACTUAL_SUBMITTED" | "VERIFIED" | "LOCKED";
export type SortKey = "default" | "attain_asc" | "attain_desc" | "name";
export type View = "list" | "category" | "cascade";
export type CascadeNode = { row: KpiRow; children: CascadeNode[] };
export type CompanyOpt = { key: string; name: string };

// ─── Constants ──────────────────────────────────────────────────────────────
export const UNIT_OPTS = ["COUNT", "CURRENCY", "PERCENT", "SCORE", "DAYS", "HOURS"];
export const FREQ_OPTS = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"];
export const AGG_LABEL: Record<string, string> = { SUM: "Total of all results", LATEST: "Most recent result", AVERAGE: "Average of all results" };
export const defaultAgg = (unit: string) => (unit === "COUNT" || unit === "CURRENCY" ? "SUM" : "LATEST");

export const REVIEW_STYLE: Record<ReviewStatus, string> = {
  DRAFT: "bg-foreground/5 text-muted",
  TARGET_SET: "bg-sky-500/10 text-sky-700",
  ACTUAL_SUBMITTED: "bg-accent/10 text-accent",
  VERIFIED: "bg-emerald-500/10 text-emerald-700",
  LOCKED: "bg-primary text-accent-foreground",
};
export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  DRAFT: "Open", TARGET_SET: "Target set", ACTUAL_SUBMITTED: "Submitted", VERIFIED: "Verified", LOCKED: "Locked",
};

// Mirrors TRANSITIONS in server/src/routes/kpiFramework.ts — the server is the authority,
// this only decides which buttons to show.
const MANAGERS: AccessLevel[] = ["GROUP_OWNER", "BUSINESS_CEO"];
const OWNERS: AccessLevel[] = ["GROUP_OWNER"];
export const TRANSITIONS: { action: string; label: string; from: ReviewStatus[]; levels: AccessLevel[] | null }[] = [
  { action: "submit_target", label: "Submit target", from: ["DRAFT"], levels: null },
  { action: "submit_actual", label: "Submit actual", from: ["DRAFT", "TARGET_SET"], levels: null },
  { action: "verify", label: "Verify", from: ["ACTUAL_SUBMITTED"], levels: MANAGERS },
  { action: "lock", label: "Lock", from: ["VERIFIED"], levels: OWNERS },
  { action: "reopen", label: "Reopen", from: ["TARGET_SET", "ACTUAL_SUBMITTED", "VERIFIED", "LOCKED"], levels: OWNERS },
];

// Used by the small sheets (target, categories). The Add KPI wizard has its own in add-kpi/fields.tsx.
export const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-60";
export const btnSecondary = "px-4 py-2 text-sm text-foreground rounded-lg border border-border hover:bg-primary/5 transition-colors disabled:opacity-50";
export const btnPrimary = "px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity";

const AVATAR_COLORS = [
  "bg-orange-600", "bg-indigo-600", "bg-emerald-600", "bg-rose-600", "bg-sky-600", "bg-amber-600", "bg-violet-600", "bg-teal-600",
];

export function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

// ─── Response normalising ───────────────────────────────────────────────────
// The one place API rows are made safe. Anything that reads a row (board, cascade, detail
// sheets) can rely on `children` existing, even if the server omits it.
const EMPTY_CHILDREN = { count: 0, allocated: 0, unallocated: null, over: false } as unknown as KpiRow["children"];
export function normRow(r: KpiRow): KpiRow {
  return r.children ? r : { ...r, children: EMPTY_CHILDREN };
}
export function normRows(rows: KpiRow[] | null | undefined): KpiRow[] {
  return Array.isArray(rows) ? rows.map(normRow) : [];
}
export function normNodes(nodes: CascadeNode[] | null | undefined): CascadeNode[] {
  return Array.isArray(nodes)
    ? nodes.map((n) => ({ row: normRow(n.row), children: normNodes(n.children) }))
    : [];
}

// ─── Periods ────────────────────────────────────────────────────────────────
export function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// The period a recurring KPI's target is set for: "the week of 19 Oct 2026", "October 2026",
// "Q4 2026" or "2026". A week is this week in the current month, else the month's last week
// (as the server works it out).
export function periodLabelFor(period: string, frequency: string) {
  const [y, m] = period.split("-").map(Number);
  if (frequency === "WEEKLY") {
    const now = new Date();
    const day = now.getFullYear() === y && now.getMonth() === m - 1 ? now : new Date(y, m, 0);
    const monday = new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7));
    return `the week of ${monday.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  if (frequency === "ANNUAL") return String(y);
  if (frequency === "QUARTERLY") return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
  return periodLabel(period);
}

// Newest first: 3 months ahead, then 2 years back. The selected period is always included.
export function buildMonthOptions(selected: string) {
  const now = new Date();
  const values: string[] = [];
  for (let i = -3; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    values.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  if (!values.includes(selected)) values.unshift(selected);
  return values.map((v) => ({ value: v, label: periodLabel(v) }));
}

// ─── Row helpers ────────────────────────────────────────────────────────────
export function kpiIcon(def: KpiDef): LucideIcon {
  const m = `${def.metric} ${def.department ?? ""}`.toLowerCase();
  if (/meeting|call|visit/.test(m)) return CalendarDays;
  if (/pipeline|deal|lead/.test(m)) return Database;
  if (/approval|compliance|risk/.test(m)) return ShieldCheck;
  if (/conversion|win rate/.test(m)) return Target;
  if (/productiv|team|staff|hiring/.test(m)) return Users;
  if (/proposal|submission|report|document/.test(m)) return FileText;
  if (/revenue|financ|cost|spend|profit|sales/.test(m) || def.unit === "CURRENCY") return TrendingUp;
  if (def.unit === "PERCENT") return Percent;
  if (def.unit === "DAYS" || def.unit === "HOURS") return Clock;
  if (def.unit === "SCORE") return Gauge;
  return BarChart3;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
export function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// Keeps the branches that hold a KPI of this company, with their parents for context.
export function pruneCascade(nodes: CascadeNode[], company: string): CascadeNode[] {
  if (company === "GROUP") return nodes;
  return nodes.flatMap((n) => {
    const kids = pruneCascade(n.children, company);
    return n.row.definition.company === company || kids.length ? [{ ...n, children: n.row.definition.company === company ? n.children : kids }] : [];
  });
}
