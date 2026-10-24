/**
 * One place for how numbers and durations read across the app.
 * Every page imports from here, so "GHS 1,016,000" can never turn into
 * "GH₵1M" on the next screen.
 *
 * Money:     GHS 1,016,000  (full)   ·   GHS 1M  (compact, for big stat cards)
 * Durations: under 30 days → "12 days", then "1 month", "8 months", "1 year".
 */

const compact = new Intl.NumberFormat("en-GH", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 });

type Amount = number | null | undefined;

export const formatMoney = (n: Amount) =>
  n == null ? "—" : `${n < 0 ? "-" : ""}GHS ${full.format(Math.abs(n))}`;

export const formatMoneyCompact = (n: Amount) =>
  n == null ? "—" : `${n < 0 ? "-" : ""}GHS ${compact.format(Math.abs(n))}`;

export const formatMoneySigned = (n: number) => `${n > 0 ? "+" : ""}${formatMoneyCompact(n)}`;

/** "1 deal", "2 deals". Pass `many` for irregular plurals. */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A length of time the way a person says it. */
export function formatSpan(days: number) {
  const d = Math.max(0, Math.round(Math.abs(days)));
  if (d < 30) return plural(d, "day");
  if (d < 365) return plural(Math.floor(d / 30), "month");
  return plural(Math.floor(d / 365), "year");
}

export const silentLabel = (days: number) => `Silent over ${formatSpan(days)}`;