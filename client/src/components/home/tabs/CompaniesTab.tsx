"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Building2, ChevronRight, TrendingDown } from "lucide-react";
import { CompanyRevenueChart } from "../charts/CompanyRevenueChart";
import { companyMoneyRows } from "../charts/derive";
import { fmtCompact, fmtSigned, healthTickClass } from "../format";
import { TabPanel } from "../TabPanel";
import type { CoSummary } from "../types";
import { SectionHeader } from "../ui";

const TH = "px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted";

export function CompaniesTab({ companies }: { companies: CoSummary[] }) {
  const ranked = useMemo(() => [...companies].sort((a, b) => b.active - a.active), [companies]);
  const moneyRows = useMemo(() => companyMoneyRows(companies), [companies]);
  const showProfit = ranked.some((c) => typeof c.netProfit === "number");

  return (
    <TabPanel className="space-y-8">
      <CompanyRevenueChart rows={moneyRows} />

      <div>
        <SectionHeader icon={Building2} label="Company health" aside="Ranked by active deals" />
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dashed border-border">
                <th className={`${TH} text-left`}>#</th>
                <th className={`${TH} text-left`}>Company</th>
                <th className={`${TH} hidden text-right sm:table-cell`}>Active deals</th>
                <th className={`${TH} text-right`}>Collected</th>
                <th className={`${TH} hidden text-right md:table-cell`}>Still owed</th>
                {showProfit && <th className={`${TH} hidden text-right lg:table-cell`}>Net profit</th>}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-border">
              {ranked.map((c, i) => {
                const dormant = c.active === 0 && c.revenue.received === 0;
                const owedHeavy = c.revenue.outstanding > c.revenue.received * 0.4 && c.revenue.outstanding > 0;
                return (
                  <tr key={c.key} className={dormant ? "opacity-45" : ""}>
                    <td className="px-5 py-3.5 text-xs font-semibold tabular-nums text-muted/70">{String(i + 1).padStart(2, "0")}</td>
                    <td className="p-0">
                      <Link href={`/dashboard/${c.slug}`} className="flex items-center gap-2 px-5 py-3.5 text-foreground hover:text-accent">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${healthTickClass(c.health, dormant)}`} aria-hidden />
                        <span className="truncate font-medium">{c.name}</span>
                      </Link>
                    </td>
                    <td className="hidden px-5 py-3.5 text-right tabular-nums text-muted sm:table-cell">{c.active}</td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums text-foreground">
                      {dormant ? <span className="text-muted">—</span> : fmtCompact(c.revenue.received)}
                    </td>
                    <td className="hidden px-5 py-3.5 text-right tabular-nums md:table-cell">
                      {owedHeavy ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                          <TrendingDown size={12} />
                          {fmtCompact(c.revenue.outstanding)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    {showProfit && (
                      <td className="hidden px-5 py-3.5 text-right tabular-nums lg:table-cell">
                        {typeof c.netProfit === "number" ? (
                          <span className={c.netProfit < 0 ? "font-medium text-accent" : "text-foreground"}>{fmtSigned(c.netProfit)}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-3.5">
                      <Link href={`/dashboard/${c.slug}`} aria-label={`Open ${c.name}`}>
                        <ChevronRight size={15} className="text-muted" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </TabPanel>
  );
}
