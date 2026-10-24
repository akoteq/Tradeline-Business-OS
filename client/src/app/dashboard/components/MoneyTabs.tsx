"use client";

import { clsx } from "clsx";
import { Landmark, Target, TrendingDown, TrendingUp } from "lucide-react";
import { formatMoney as fmt } from "@/lib/format";
import type { CompanyDash } from "./types";
import { EmptyState, MoneyTile, PrimaryLink, SectionHeader, Tag, TextLink, card } from "./ui";

export function FinanceTab({ finance }: { finance: CompanyDash["finance"] }) {
  const max = Math.max(...(finance?.expensesByCategory.map((x) => x.amount) ?? []), 1);
  return (
    <>
      <SectionHeader icon={Landmark} title="Finance" hint="What the business kept, spent and got back. Updated every night." />
      {!finance ? (
        <EmptyState title="Finance numbers aren't available yet" body="Net profit, monthly spending and return on investment will appear here once your accounts are connected." />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MoneyTile icon={Landmark} label="Net profit" amount={finance.netProfit} display={fmt(finance.netProfit)} hint="What's left after every expense" flag={finance.netProfit < 0} />
            <MoneyTile icon={TrendingDown} label="Monthly burn" amount={finance.burnRate} display={`${fmt(finance.burnRate)}/mo`} hint="How much cash goes out each month" />
            <MoneyTile icon={TrendingUp} label="Return on investment" amount={finance.roi} display={`${finance.roi.toFixed(1)}×`} hint="What you get back for every cedi put in" />
          </div>

          <div className={clsx(card, "p-4")}>
            <div className="flex items-center justify-between gap-3">
              <p className="type-colhead">Spending by category</p>
              <p className="text-xs text-muted">Total invested: {fmt(finance.totalInvested)}</p>
            </div>
            {finance.expensesByCategory.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No categorised spending yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {finance.expensesByCategory.slice().sort((a, b) => b.amount - a.amount).map((e) => (
                  <li key={e.category} className="py-2.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-foreground">{e.category}</span>
                      <span className="font-medium tabular-nums text-foreground">{fmt(e.amount)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                      <div className={clsx("h-full rounded-full", e.category.toLowerCase().includes("discretionary") ? "bg-accent" : "bg-foreground/40")} style={{ width: `${(e.amount / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function DealsTab({ deals, isBapx, dealsHref }: { deals: CompanyDash["topDeals"]; isBapx: boolean; dealsHref?: string }) {
  const heads = ["Business", "Stage", "Health", isBapx ? "Target" : "Value", ...(isBapx ? [] : ["Received"]), "Invoice"];
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
                    <td className="px-4 py-3"><Tag value={d.dealStage} /></td>
                    <td className="px-4 py-3"><Tag value={d.dealHealth} /></td>
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
