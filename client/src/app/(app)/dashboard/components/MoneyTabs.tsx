"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { clsx } from "clsx";
import { Landmark, Target, TrendingDown, TrendingUp } from "lucide-react";
import { formatMoney as fmt } from "@/lib/format";
import type { CompanyDash } from "./types";
import { EmptyState, MoneyTile, PrimaryLink, SectionHeader, Tag, TextLink, card } from "./ui";

// This week's money for the company, one currency at a time. The full report is on the Finance page.
export function FinanceTab({ companyKey }: { companyKey: string }) {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const from = monday.toISOString().slice(0, 10);
  const to = new Date(monday.getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
  const { data } = useQuery<{ currencies: { currency: string; expectedRevenue: number; actualRevenue: number; expectedExpense: number; actualExpense: number; expectedNet: number; actualNet: number }[] }>({
    queryKey: ["finance", "summary", companyKey, from, to],
    queryFn: () => fetcher(`/finance/summary?company=${encodeURIComponent(companyKey)}&from=${from}&to=${to}`),
  });
  const [picked, setPicked] = useState<string | null>(null);
  const all = data?.currencies ?? [];
  const withMoney = all.filter((t) => t.expectedRevenue || t.actualRevenue || t.expectedExpense || t.actualExpense);
  const code = picked ?? withMoney[0]?.currency ?? "GHS";
  const t = all.find((x) => x.currency === code);
  const show = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  return (
    <>
      <SectionHeader icon={Landmark} title="This week's money" hint="Expected and actual." action={<TextLink href={`/finance?company=${encodeURIComponent(companyKey)}`}>Open Finance</TextLink>} />
      <div role="tablist" aria-label="Currency" className="mb-3 inline-flex rounded-xl border border-border bg-surface p-1 text-sm">
        {all.map((x) => (
          <button key={x.currency} role="tab" aria-selected={code === x.currency} onClick={() => setPicked(x.currency)} className={clsx("rounded-lg px-3 py-1.5", code === x.currency ? "bg-foreground font-medium text-background" : "text-muted hover:text-foreground")}>{x.currency}</button>
        ))}
      </div>
      {t && (
        <div className={clsx(card, "max-w-xl p-4")}>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border"><th /><th className="type-colhead py-1.5 text-right">Expected</th><th className="type-colhead py-1.5 text-right">Actual</th></tr></thead>
            <tbody className="divide-y divide-border tabular-nums">
              <tr><td className="py-2 text-foreground">Revenue</td><td className="py-2 text-right">{show(t.expectedRevenue)}</td><td className="py-2 text-right">{show(t.actualRevenue)}</td></tr>
              <tr><td className="py-2 text-foreground">Expenses</td><td className="py-2 text-right">{show(t.expectedExpense)}</td><td className="py-2 text-right">{show(t.actualExpense)}</td></tr>
              <tr className="font-semibold"><td className="py-2 text-foreground">Net</td><td className="py-2 text-right">{show(t.expectedNet)}</td><td className="py-2 text-right">{show(t.actualNet)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function DealsTab({ deals, isBapx, dealsHref }: { deals: CompanyDash["topDeals"]; isBapx: boolean; dealsHref?: string }) {
  const heads = ["Business", "Payment", "Value", ...(isBapx ? [] : ["Received"]), "Invoice"];
  return (
    <>
      <SectionHeader icon={Target} title="Top deals" hint="Your biggest deals by value." action={dealsHref && <TextLink href={dealsHref}>See every deal</TextLink>} />
      {deals.length === 0 ? (
        <EmptyState title="No deals yet" body="They'll show up here as soon as your team adds one." action={dealsHref && <PrimaryLink href={dealsHref}>Go to deals</PrimaryLink>} />
      ) : (
        <div className={clsx(card, "overflow-x-auto")}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-subtle/50">
                {heads.map((h) => (
                  <th key={h} className={clsx("type-colhead px-4 py-3", h === "Value" || h === "Target" || h === "Received" ? "text-right" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deals.map((d) => {
                const paid = d.potential > 0 ? Math.min(1, d.received / d.potential) : 0;
                return (
                  <tr key={d.id} className="transition-colors hover:bg-subtle/50">
                    <td className="max-w-[220px] truncate px-4 py-3 font-medium text-foreground">{d.businessName}</td>
                    <td className="px-4 py-3"><Tag value={d.paymentStatus ?? "UNPAID"} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-foreground">{fmt(d.potential)}</td>
                    {!isBapx && (
                      <td className="px-4 py-3">
                        <div className="ml-auto w-32 text-right">
                          <span className="tabular-nums text-foreground/70">{fmt(d.received)}</span>
                          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-foreground/[0.06]" title={`${Math.round(paid * 100)}% received`}>
                            <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${paid * 100}%` }} />
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3"><Tag value={d.invoiceStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
