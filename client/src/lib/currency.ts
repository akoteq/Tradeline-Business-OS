export const CURRENCIES = [
  { code: "GHS", symbol: "GH₵", name: "Ghana cedi" },
  { code: "USD", symbol: "$", name: "US dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "GHS";

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return CURRENCIES.some((c) => c.code === v);
}

/** One formatter for every money value in the app, so the sheet, list and recap always agree. */
export function formatMoney(value: number, code: string = DEFAULT_CURRENCY, compact = false) {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
      notation: compact ? "compact" : "standard",
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString()}`;
  }
}