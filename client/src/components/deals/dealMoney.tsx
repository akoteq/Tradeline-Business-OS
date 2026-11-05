"use client";

import { useEffect, useState } from "react";

// What every deal page shares: a deal is won work with one Deal value, and its status is worked out
// from the money the CEO has added. Sales stages live on leads.

export const FINANCE_CURRENCIES = ["GHS", "USD", "EUR"];

export type DealMoney = {
  dealStage?: string | null;
  paymentStatus?: string | null;
  expectedPaymentDate?: string | null;
  dueDate?: string | null;
};

export type DealStatus = "CANCELLED" | "PAID" | "OVERDUE" | "PARTIAL" | "UNPAID";

export function dealStatus(d: DealMoney): DealStatus {
  if (d.dealStage === "CLOSED_LOST") return "CANCELLED";
  if (d.paymentStatus === "PAID") return "PAID";
  const due = d.expectedPaymentDate ?? d.dueDate;
  if (due && due.slice(0, 10) < new Date().toISOString().slice(0, 10)) return "OVERDUE";
  return d.paymentStatus === "PARTIAL" ? "PARTIAL" : "UNPAID";
}

const STATUS_LABEL: Record<DealStatus, string> = { CANCELLED: "Cancelled", PAID: "Paid", OVERDUE: "Overdue", PARTIAL: "Part paid", UNPAID: "Unpaid" };
const STATUS_STYLE: Record<DealStatus, string> = {
  CANCELLED: "bg-subtle text-muted",
  PAID: "bg-emerald-500/10 text-emerald-700",
  OVERDUE: "bg-red-500/10 text-red-700",
  PARTIAL: "bg-amber-500/10 text-amber-700",
  UNPAID: "bg-subtle text-foreground/70",
};

export function DealStatusBadge({ deal }: { deal: DealMoney }) {
  const s = dealStatus(deal);
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s]}`}>{STATUS_LABEL[s]}</span>;
}

// Amounts are stored in GHS for KPIs. A deal shows them in its own currency.
export function inDealCurrency(ghs: number | null | undefined, deal: { currency?: string | null; exchangeRate?: number | null }) {
  if (ghs == null) return null;
  const c = deal.currency ?? "GHS";
  return c === "GHS" || !deal.exchangeRate ? ghs : Math.round((ghs / deal.exchangeRate) * 100) / 100;
}

export function dealMoneyText(ghs: number | null | undefined, deal: { currency?: string | null; exchangeRate?: number | null }) {
  const v = inDealCurrency(ghs, deal);
  return v == null ? "—" : `${deal.currency ?? "GHS"} ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export type DealValueForm = { dealValue: string; currency: string; exchangeRate: string; expectedPaymentDate: string };

// The Deal value on an existing deal. Deals saved before this field existed fall back to the GHS figure.
export function dealValueOf(deal: {
  dealValue?: number | null; currency?: string | null; exchangeRate?: number | null;
  targetGhs?: number | null; expectedRevenueReceivedGhs?: number | null; revenuePotentialGhs?: number | null;
}) {
  if (deal.dealValue != null) return String(deal.dealValue);
  const v = inDealCurrency(deal.targetGhs ?? deal.expectedRevenueReceivedGhs ?? deal.revenuePotentialGhs, deal);
  return v == null ? "" : String(v);
}

export function DealValueFields({ form, set, inputClass, labelClass }: {
  form: DealValueForm; set: (k: keyof DealValueForm, v: string) => void; inputClass: string; labelClass: string;
}) {
  // An older deal in another currency keeps showing it until someone changes it.
  const options = FINANCE_CURRENCIES.includes(form.currency) ? FINANCE_CURRENCIES : [form.currency, ...FINANCE_CURRENCIES];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Deal value</label>
          <input type="number" min={0} value={form.dealValue} onChange={(e) => set("dealValue", e.target.value)} className={inputClass} placeholder="Agreed amount" />
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <select value={form.currency} onChange={(e) => set("currency", e.target.value)} className={inputClass}>
            {options.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Expected payment date</label>
          <input type="date" value={form.expectedPaymentDate} onChange={(e) => set("expectedPaymentDate", e.target.value)} className={inputClass} />
        </div>
      </div>
      {form.currency !== "GHS" && (
        <div>
          <label className={labelClass}>Rate (1 {form.currency} = ? GHS)</label>
          <input type="number" min={0} value={form.exchangeRate} onChange={(e) => set("exchangeRate", e.target.value)} className={inputClass} />
          <p className="mt-1 text-[11px] text-muted">Used for KPIs only. Finance keeps the amount in {form.currency}.</p>
        </div>
      )}
      <p className="text-[11px] text-muted">
        Saving adds this as expected revenue in Finance. Only your Business CEO can add money received.
      </p>
    </div>
  );
}

export const dealValueBody = (form: DealValueForm) => ({
  dealValue: form.dealValue === "" ? null : Number(form.dealValue),
  currency: form.currency,
  exchangeRate: form.currency === "GHS" ? 1 : Number(form.exchangeRate) || null,
  expectedPaymentDate: form.expectedPaymentDate || null,
});

// The same three steps on every company's deal form.
export const DEAL_STEPS = [
  { title: "Who is the deal with?", subtitle: "Pick the client. Their details fill in for you.", nudge: "Let's start" },
  { title: "What is the work?", subtitle: "Who is doing it, and what comes next.", nudge: "Halfway there" },
  { title: "What is it worth?", subtitle: "What the client agreed to pay, and when.", nudge: "Almost done" },
] as const;

export type NewDealLink = { smeId: string; value: string };

// Converting a lead offers to add a deal, and links here with ?newDeal=1. Opens the form once.
export function useNewDealLink(open: (link: NewDealLink) => void) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done) return;
    setDone(true);
    const q = new URLSearchParams(window.location.search);
    if (q.get("newDeal") !== "1") return;
    open({ smeId: q.get("smeId") ?? "", value: q.get("value") ?? "" });
    window.history.replaceState(null, "", window.location.pathname);
  }, [done, open]);
}
