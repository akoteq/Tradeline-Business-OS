// Shared by the Finance page and its forms. A week runs Monday to Sunday, and dates are calendar
// days in Ghana time (UTC+0), so plain UTC date arithmetic is correct here.

export const CURRENCIES = ["GHS", "USD", "EUR"];
export const CATEGORIES = ["Staff payment", "Rent", "Utilities", "Transport", "Marketing", "Supplies", "Software", "Other"];

export type EntryType = "REVENUE" | "EXPENSE";
export type EntryStatus = "EXPECTED" | "ACTUAL";

export type Entry = {
  id: string; company: string; type: EntryType; status: EntryStatus; amount: number; currency: string;
  category: string | null; description: string | null; date: string; taskId: string | null;
  dealId: string | null; dealSource: "BAPX" | "TRADELINE" | "COMPANY" | null; exchangeRate: number | null;
  isFixed: boolean; repeat: "NONE" | "WEEKLY" | "MONTHLY"; seriesId: string | null; repeatStopped: boolean;
  origin: "MANUAL" | "TASK" | "DEAL" | "FIXED" | "MIGRATED"; createdBy: string; createdByName: string | null;
  /** On an expected entry: how much has really come in or gone out against it. */
  received?: number;
};

export type WaitingEntry = Entry & { received: number; remaining: number };

export type Totals = {
  currency: string; expectedRevenue: number; actualRevenue: number; expectedExpense: number; actualExpense: number; expectedNet: number; actualNet: number;
};

export type Report = {
  company: string; from: string; to: string;
  currencies: Totals[]; previous: Totals[];
  trend: { weekStart: string; currencies: Totals[] }[];
  expensesByCategory: { currency: string; category: string; amount: number }[];
  fixedVsOneOff: { currency: string; fixed: number; oneOff: number }[];
  revenue: { currency: string; amount: number; dealId: string | null; dealSource: string | null; client: string | null; deal: string }[];
  owed: { dealId: string; dealSource: string; client: string; deal: string | null; balance: number; currency: string; due: string | null; status: "OVERDUE" | "PARTIAL" | "UNPAID" }[];
};

export const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const addDays = (s: string, n: number) => day(new Date(utc(s).getTime() + n * 86_400_000));
export const todayStr = () => day(new Date());

export function mondayOf(s: string) {
  const d = utc(s);
  return addDays(s, -((d.getUTCDay() + 6) % 7));
}

export type RangeKey = "today" | "week" | "lastWeek" | "month" | "custom";
export const RANGE_LABEL: Record<RangeKey, string> = { today: "Today", week: "This week", lastWeek: "Last week", month: "This month", custom: "Custom" };

export function rangeFor(key: RangeKey, custom: { from: string; to: string }) {
  const t = todayStr();
  if (key === "today") return { from: t, to: t };
  if (key === "lastWeek") { const m = addDays(mondayOf(t), -7); return { from: m, to: addDays(m, 6) }; }
  if (key === "month") {
    const d = utc(t);
    return { from: day(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))), to: day(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))) };
  }
  if (key === "custom") return custom;
  const m = mondayOf(t);
  return { from: m, to: addDays(m, 6) };
}

export const showDate = (s: string | null | undefined, year = false) =>
  s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" }) : "—";

export const num = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${num(Math.abs(n))}`;

export const apiError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

export const ENTRY_LABEL: Record<string, { label: string; style: string }> = {
  REVENUE_ACTUAL: { label: "Actual revenue", style: "bg-emerald-500/10 text-emerald-700" },
  EXPENSE_ACTUAL: { label: "Actual expense", style: "bg-accent/10 text-accent" },
  REVENUE_EXPECTED: { label: "Expected revenue", style: "bg-sky-500/10 text-sky-700" },
  EXPENSE_EXPECTED: { label: "Expected expense", style: "bg-sky-500/10 text-sky-700" },
};
