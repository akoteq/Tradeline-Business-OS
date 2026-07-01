"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { fetcher } from "@/lib/api";

type BDO = { id: string; name: string; email: string | null; company: string; role: string | null };
type BapxDeal = { id: string; dealStage: string; dealHealth: string };
type TradelineDeal = { id: string; dealStage: string; dealHealth: string; paymentStatus: string; expectedRevenueReceivedGhs: number | null; revenueReceivedGhs: number | null; balanceGhs: number | null };
type CompanyDeal = { id: string; dealStage: string; dealHealth: string; paymentStatus: string | null };
type GrantLoan = { id: string; status: string; amountApproved: number | null };
type Sme = { id: string; companyName: string; bdoId: string | null };

const fmt = (n: number) => `GHS ${n.toLocaleString()}`;

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6"];

export default function BdoDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: bdo, isLoading: bdoLoading } = useQuery<BDO>({ queryKey: ["bdo", id], queryFn: () => fetcher(`/bdo/${id}`) });
  const { data: bapxDeals = [] } = useQuery<BapxDeal[]>({ queryKey: ["bapx", { bdoId: id }], queryFn: () => fetcher(`/bapx?bdoId=${id}`) });
  const { data: tradelineDeals = [] } = useQuery<TradelineDeal[]>({ queryKey: ["tradeline", { bdoId: id }], queryFn: () => fetcher(`/tradeline?bdoId=${id}`) });
  const { data: companyDeals = [] } = useQuery<CompanyDeal[]>({ queryKey: ["company-deals", { bdoId: id }], queryFn: () => fetcher(`/company-deals?bdoId=${id}`) });
  const { data: grants = [] } = useQuery<GrantLoan[]>({ queryKey: ["grants", { bdoId: id }], queryFn: () => fetcher(`/grant-loans?bdoId=${id}`) });
  const { data: smeRes } = useQuery<{ data: Sme[]; total: number }>({ queryKey: ["sme", { bdoId: id }], queryFn: () => fetcher(`/sme?bdoId=${id}`) });
  const clients = smeRes?.data ?? [];

  if (bdoLoading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>;
  if (!bdo) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">BDO not found.</div>;

  const isClosedWon = (d: { dealStage: string; dealHealth: string }) => d.dealStage === "CLOSED_WON" || d.dealHealth === "CLOSED_WON";
  const completedDeals =
    bapxDeals.filter(isClosedWon).length +
    tradelineDeals.filter((d) => isClosedWon(d) && d.paymentStatus === "PAID").length +
    companyDeals.filter((d) => isClosedWon(d) && d.paymentStatus === "PAID").length;

  const allDeals = [...bapxDeals, ...tradelineDeals, ...companyDeals];
  const stageData = Object.entries(
    allDeals.reduce<Record<string, number>>((acc, d) => { acc[d.dealStage] = (acc[d.dealStage] ?? 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  const healthData = Object.entries(
    allDeals.reduce<Record<string, number>>((acc, d) => { acc[d.dealHealth] = (acc[d.dealHealth] ?? 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  const expectedRevenue = tradelineDeals.reduce((s, d) => s + (d.expectedRevenueReceivedGhs ?? 0), 0);
  const revenueReceived = tradelineDeals.reduce((s, d) => s + (d.revenueReceivedGhs ?? 0), 0);
  const outstandingBalance = tradelineDeals.reduce((s, d) => s + (d.balanceGhs ?? 0), 0);

  const grantsInProgress = grants.filter((g) => ["DRAFT", "SUBMITTED", "UNDER_REVIEW"].includes(g.status)).length;
  const grantsApproved = grants.filter((g) => ["APPROVED", "DISBURSED"].includes(g.status)).length;
  const grantsTotalValue = grants.reduce((s, g) => s + (g.amountApproved ?? 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bdo.company === "TRADELINE" ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"}`}>
              {bdo.company}
            </span>
            {bdo.role && <span className="text-xs text-gray-500">{bdo.role}</span>}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{bdo.name}</h1>
          {bdo.email && <p className="text-sm text-gray-500 mt-0.5">{bdo.email}</p>}
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: "Completed Deals", value: completedDeals, color: "blue" },
            { label: "Deals", value: bapxDeals.length + tradelineDeals.length + companyDeals.length, color: "blue" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-lg px-3 py-2 text-center min-w-[65px]`}>
              <div className={`text-xs text-${color}-600 font-medium`}>{label}</div>
              <div className={`font-bold text-${color}-700`}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Client Overview quick link */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-sm text-gray-900">Clients</h3>
          <p className="text-xs text-gray-400 mt-0.5">{clients.length} assigned client{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href={`/sme?bdo=${encodeURIComponent(bdo.name)}`}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          View Client Overview →
        </Link>
      </div>

      {/* Tradeline revenue overview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Tradeline Revenue</h2>
          <Link
            href={`/tradeline/pipeline?bdo=${encodeURIComponent(bdo.name)}`}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            View pipeline →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatTile label="Expected Revenue" value={fmt(expectedRevenue)} color="blue" />
          <StatTile label="Revenue Received" value={fmt(revenueReceived)} color="blue" />
          <StatTile label="Outstanding" value={fmt(outstandingBalance)} color="red" />
        </div>
      </div>

      {/* Grants & Loans overview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Grants & Loans</h2>
          <Link
            href={`/grant-loans?bdo=${encodeURIComponent(bdo.name)}`}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            View full page →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Applications" value={grants.length} color="blue" />
          <StatTile label="In Progress" value={grantsInProgress} color="blue" />
          <StatTile label="Approved" value={grantsApproved} color="blue" />
          <StatTile label="Total Value (GHS)" value={fmt(grantsTotalValue)} color="blue" />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Deals by Stage">
          {stageData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-14">No deals yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={44} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Deal Health">
          {healthData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-14">No deals yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={healthData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {healthData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function StatTile({ label, value, color }: { label: string; value: number | string; color: "blue" | "red" }) {
  const styles: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };
  return (
    <div className={`border rounded-lg px-3 py-2 text-center ${styles[color]}`}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="font-bold text-sm mt-0.5">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}
