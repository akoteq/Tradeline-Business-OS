"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import {
  TrendingUp,
  Users,
  Building2,
  Handshake,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { DealHealthBadge, DealStageBadge } from "@/components/Badges";

// ---- Executive (group-wide) types, served by /dashboard/executive ----
type CoSummary = {
  key: string; name: string; slug: string; color: string; dealSource: string;
  total: number; active: number; closedWon: number;
  revenue: { potential: number; received: number; outstanding: number };
};
type DealRow = { businessName: string; company: string; amount: number; dealStage: string; dealHealth: string };
type Exec = {
  totals: { deals: number; active: number; closedWon: number; potential: number; received: number; outstanding: number };
  companies: CoSummary[];
  kpiHealth: { onTrack: number; atRisk: number; offTrack: number; noTarget: number };
  topDeals: DealRow[];
  topRisks: DealRow[];
};

const fmt = (n: number) =>
  (n ?? 0).toLocaleString("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 });
const badge: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-700", green: "bg-green-100 text-green-700", emerald: "bg-emerald-100 text-emerald-700",
  teal: "bg-teal-100 text-teal-700", sky: "bg-sky-100 text-sky-700", violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-700", rose: "bg-rose-100 text-rose-700", slate: "bg-slate-100 text-slate-700",
};

export default function CEODashboard() {
  const ceo = useQuery({
    queryKey: ["ceo-dashboard"],
    queryFn: () => fetcher("/dashboard/ceo"),
  });
  const exec = useQuery<Exec>({
    queryKey: ["executive-dashboard"],
    queryFn: () => fetcher("/dashboard/executive"),
  });

  if (ceo.isLoading || exec.isLoading)
    return <div className="text-gray-400 p-8">Loading dashboard…</div>;
  if (ceo.isError || !ceo.data)
    return (
      <div className="text-red-400 p-8">
        Failed to load data. Make sure the server is running on port 4000.
      </div>
    );

  const data = ceo.data;

  const kpiTotal = exec.data
    ? exec.data.kpiHealth.onTrack + exec.data.kpiHealth.atRisk + exec.data.kpiHealth.offTrack + exec.data.kpiHealth.noTarget
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">CEO Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monday brief — group-wide overview
            {exec.data ? ` across ${exec.data.companies.length} companies` : ""}
          </p>
        </div>
      </div>

      {/* Group revenue headline */}
      {exec.data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Money label="Potential Revenue" value={fmt(exec.data.totals.potential)} tone="indigo" />
          <Money label="Revenue Received" value={fmt(exec.data.totals.received)} tone="green" />
          <Money label="Outstanding" value={fmt(exec.data.totals.outstanding)} tone="amber" />
        </div>
      )}

      {/* Group deal + KPI health tiles */}
      {exec.data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={<Building2 size={15} />} label="Total Deals" value={exec.data.totals.deals} />
          <Stat icon={<TrendingUp size={15} />} label="Active" value={exec.data.totals.active} accent="text-blue-600" />
          <Stat icon={<CheckCircle2 size={15} />} label="Closed Won" value={exec.data.totals.closedWon} accent="text-green-600" />
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1.5">KPI Health ({kpiTotal})</div>
            <div className="flex items-center gap-3 text-sm font-semibold">
              <span className="text-green-600">{exec.data.kpiHealth.onTrack} on</span>
              <span className="text-amber-600">{exec.data.kpiHealth.atRisk} risk</span>
              <span className="text-red-600">{exec.data.kpiHealth.offTrack} off</span>
            </div>
          </div>
        </div>
      )}

      {/* Operational KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard label="Total Leads" value={data.leads.total} icon={<Users size={20} />} color="sky" />
        <KpiCard label="SMEs Tracked" value={data.smes.total} icon={<Building2 size={20} />} color="violet" />
        <KpiCard label="Active Partnerships" value={data.partnerships.active} icon={<Handshake size={20} />} color="teal" />
        <KpiCard label="Grants in Flight" value={data.grants.inFlight} icon={<DollarSign size={20} />} color="orange" />
      </div>

      {/* By Company — dynamic across every active company */}
      {exec.data && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Building2 size={18} className="text-gray-400" />
            By Company
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {exec.data.companies.map((c) => (
              <Link key={c.key} href={`/dashboard/${c.slug}`} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{c.name}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${badge[c.color] ?? "bg-gray-100 text-gray-600"}`}>{c.total} deals</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div><div className="font-bold text-indigo-700">{fmt(c.revenue.potential)}</div><div className="text-gray-400">Potential</div></div>
                  <div><div className="font-bold text-green-700">{fmt(c.revenue.received)}</div><div className="text-gray-400">Received</div></div>
                  <div><div className="font-bold text-gray-700">{c.active}</div><div className="text-gray-400">Active</div></div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Top deals + risks */}
      {exec.data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DealList title="Top Deals" rows={exec.data.topDeals} amountLabel="Potential" emptyText="No deals yet." />
          <DealList title="Top Risks" rows={exec.data.topRisks} amountLabel="At stake" risk emptyText="No at-risk or stale deals." />
        </div>
      )}
    </div>
  );
}

function Money({ label, value, tone }: { label: string; value: string; tone: string }) {
  const tones: Record<string, string> = {
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
    green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Stat({ icon, label, value, accent = "text-gray-900" }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium uppercase tracking-wide">{icon} {label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

function DealList({ title, rows, amountLabel, risk, emptyText }: { title: string; rows: DealRow[]; amountLabel: string; risk?: boolean; emptyText: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        {risk && <AlertTriangle size={15} className="text-amber-500" />}
        <h2 className="font-semibold text-gray-800 text-sm">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Business", "Company", risk ? "Health" : "Stage", amountLabel].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((d, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900 max-w-[150px] truncate">{d.businessName}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{d.company}</td>
                  <td className="px-3 py-2">{risk ? <DealHealthBadge value={d.dealHealth} /> : <DealStageBadge value={d.dealStage} />}</td>
                  <td className="px-3 py-2 font-medium text-gray-700 tabular-nums whitespace-nowrap">{fmt(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    sky: "bg-sky-50 text-sky-600",
    violet: "bg-violet-50 text-violet-600",
    teal: "bg-teal-50 text-teal-600",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      <div>
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold text-gray-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}
