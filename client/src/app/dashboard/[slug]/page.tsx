"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useCompanies, companyHref } from "@/lib/companies";
import { DealStageBadge, DealHealthBadge, InvoiceStatusBadge } from "@/components/Badges";
import { ArrowRight, TrendingUp, CheckCircle2, Layers, AlertTriangle } from "lucide-react";

type CompanyDash = {
  company: { key: string; name: string; slug: string; dealSource: string };
  source: "BAPX" | "TRADELINE" | "COMPANY";
  total: number;
  active: number;
  closedWon: number;
  byStage: { dealStage: string; count: number }[];
  byHealth: { dealHealth: string; count: number }[];
  invoice: { status: string; count: number }[];
  revenue: { revenuePotential: number; revenueReceived: number; outstanding: number };
  topDeals: { id: string; businessName: string; dealStage: string; dealHealth: string; received: number; potential: number; invoiceStatus: string }[];
  tasks: { open: number; overdue: number; completed: number };
};

const fmt = (n: number | null | undefined) =>
  n != null ? n.toLocaleString("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 }) : "—";

export default function CompanyDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { bySlug } = useCompanies();
  const company = bySlug[slug];
  const key = company?.key;

  const { data, isLoading } = useQuery<CompanyDash>({
    queryKey: ["company-dashboard", key],
    queryFn: () => fetcher(`/dashboard/company/${key}`),
    enabled: !!key,
  });

  const isBapx = data?.source === "BAPX";

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{company?.name ?? slug}</h1>
          <p className="text-sm text-gray-500 mt-1">Company dashboard</p>
        </div>
        {company && (
          <Link
            href={companyHref(company)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            View full pipeline <ArrowRight size={15} />
          </Link>
        )}
      </div>

      {isLoading || !data ? (
        <div className="p-10 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">Loading dashboard…</div>
      ) : (
        <>
          {/* Pipeline stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile icon={<Layers size={16} />} label="Total Deals" value={data.total} />
            <StatTile icon={<TrendingUp size={16} />} label="Active" value={data.active} accent="text-blue-600" />
            <StatTile icon={<CheckCircle2 size={16} />} label="Closed Won" value={data.closedWon} accent="text-green-600" />
            <StatTile icon={<AlertTriangle size={16} />} label="Overdue Tasks" value={data.tasks.overdue} accent={data.tasks.overdue > 0 ? "text-red-600" : "text-gray-900"} />
          </div>

          {/* Revenue tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MoneyTile label={isBapx ? "Target Value" : "Potential Revenue"} value={fmt(data.revenue.revenuePotential)} tone="indigo" />
            <MoneyTile label="Revenue Received" value={isBapx ? "—" : fmt(data.revenue.revenueReceived)} tone="green" />
            <MoneyTile label="Outstanding" value={isBapx ? "—" : fmt(data.revenue.outstanding)} tone="amber" />
          </div>

          {/* Scheme of Work */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 text-sm mb-3">Scheme of Work</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <MiniStat label="Open" value={data.tasks.open} />
              <MiniStat label="Overdue" value={data.tasks.overdue} accent={data.tasks.overdue > 0 ? "text-red-600" : undefined} />
              <MiniStat label="Completed" value={data.tasks.completed} accent="text-green-600" />
            </div>
          </div>

          {/* Top deals */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">Top Deals</h3>
            </div>
            {data.topDeals.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No deals yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {["Business", "Stage", "Health", isBapx ? "Target" : "Potential", "Invoice"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.topDeals.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[200px] truncate">{d.businessName}</td>
                        <td className="px-3 py-2.5"><DealStageBadge value={d.dealStage} /></td>
                        <td className="px-3 py-2.5"><DealHealthBadge value={d.dealHealth} /></td>
                        <td className="px-3 py-2.5 font-medium text-gray-700">{fmt(d.potential)}</td>
                        <td className="px-3 py-2.5"><InvoiceStatusBadge value={d.invoiceStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ icon, label, value, accent = "text-gray-900" }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium uppercase tracking-wide">{icon} {label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

const toneMap: Record<string, string> = {
  indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
  green: "bg-green-50 border-green-200 text-green-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
};

function MoneyTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-xl border p-4 ${toneMap[tone] ?? "bg-white border-gray-200 text-gray-900"}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function MiniStat({ label, value, accent = "text-gray-900" }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <div className={`text-xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

