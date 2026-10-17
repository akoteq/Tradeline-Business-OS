"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { fetcher } from "@/lib/api";
import { useCompanies, companyHref, companyBadgeClass } from "@/lib/companies";

type BDO = { id: string; name: string; email: string | null; company: string; role: string | null };
type BapxDeal = { id: string; dealStage: string; dealHealth: string; priority: string; targetGhs: number | null };
type TradelineDeal = { id: string; dealStage: string; dealHealth: string; paymentStatus: string; expectedRevenueReceivedGhs: number | null; revenueReceivedGhs: number | null; balanceGhs: number | null };
type CompanyDeal = {
  id: string; dealStage: string; dealHealth: string; paymentStatus: string | null;
  revenuePotentialGhs: number | null; revenueReceivedGhs: number | null; balanceGhs: number | null;
};
type GrantLoan = { id: string; status: string; amountApproved: number | null };
type Sme = { id: string; companyName: string; bdoId: string | null };
type TaskRow = { id: string; deliverable: string; status: string; priority: string };
type Lead = { id: string; businessName: string; status: string };

const fmt = (n: number) => `GHS ${n.toLocaleString()}`;

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6"];


const isClosedWon = (d: { dealStage: string; dealHealth: string }) => d.dealStage === "CLOSED_WON" || d.dealHealth === "CLOSED_WON";
const OPEN_TASK_STATUSES = ["PENDING", "IN_PROGRESS", "OVERDUE"];
const CLOSED_LEAD_STATUSES = ["CONVERTED", "LOST"];

export default function BdoDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { byKey } = useCompanies();

  const { data: bdo, isLoading: bdoLoading } = useQuery<BDO>({ queryKey: ["bdo", id], queryFn: () => fetcher(`/bdo/${id}`) });
  const { data: bapxDeals = [] } = useQuery<BapxDeal[]>({ queryKey: ["bapx", { bdoId: id }], queryFn: () => fetcher(`/bapx?bdoId=${id}`) });
  const { data: tradelineDeals = [] } = useQuery<TradelineDeal[]>({ queryKey: ["tradeline", { bdoId: id }], queryFn: () => fetcher(`/tradeline?bdoId=${id}`) });
  const { data: companyDeals = [] } = useQuery<CompanyDeal[]>({ queryKey: ["company-deals", { bdoId: id }], queryFn: () => fetcher(`/company-deals?bdoId=${id}`) });
  const { data: grants = [] } = useQuery<GrantLoan[]>({ queryKey: ["grants", { bdoId: id }], queryFn: () => fetcher(`/grant-loans?bdoId=${id}`) });
  const { data: smeRes } = useQuery<{ data: Sme[]; total: number }>({ queryKey: ["sme", { bdoId: id }], queryFn: () => fetcher(`/sme?bdoId=${id}`) });
  const { data: tasks = [] } = useQuery<TaskRow[]>({ queryKey: ["tasks", { bdoId: id }], queryFn: () => fetcher(`/tasks?bdoId=${id}`) });
  const { data: leadsRes } = useQuery<{ data: Lead[]; total: number }>({ queryKey: ["leads", { bdoId: id }], queryFn: () => fetcher(`/leads?bdoId=${id}`) });
  const clients = smeRes?.data ?? [];
  const leads = leadsRes?.data ?? [];

  if (bdoLoading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>;
  if (!bdo) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">BDO not found.</div>;

  // Which pipeline body to show follows the company's deal source, so added companies just work.
  const source = byKey[bdo.company]?.dealSource;
  const isBapx = source === "BAPX";
  const isCompany = source === "COMPANY";

  // Task rollup (shared)
  const openTasks = tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status)).length;
  const overdueTasks = tasks.filter((t) => t.status === "OVERDUE").length;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Header
        bdo={bdo}
        totalDeals={bapxDeals.length + tradelineDeals.length + companyDeals.length}
        completedDeals={
          isBapx
            ? bapxDeals.filter(isClosedWon).length
            : bapxDeals.filter(isClosedWon).length +
              tradelineDeals.filter((d) => isClosedWon(d) && d.paymentStatus === "PAID").length +
              companyDeals.filter((d) => isClosedWon(d) && d.paymentStatus === "PAID").length
        }
      />

      {/* Client Overview quick link */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-sm text-gray-900">Clients</h3>
          <p className="text-xs text-gray-400 mt-0.5">{clients.length} assigned client{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href={`/sme?bdo=${encodeURIComponent(bdo.name)}`}
          className="text-xs font-medium text-accent hover:text-accent/80"
        >
          View Client Overview →
        </Link>
      </div>

      {isBapx ? (
        <BapxBody
          bdo={bdo}
          deals={bapxDeals}
          leads={leads}
          openTasks={openTasks}
          overdueTasks={overdueTasks}
          completedTasks={completedTasks}
          totalTasks={tasks.length}
        />
      ) : isCompany ? (
        <CompanyBody
          bdo={bdo}
          deals={companyDeals}
          openTasks={openTasks}
          overdueTasks={overdueTasks}
          completedTasks={completedTasks}
          totalTasks={tasks.length}
        />
      ) : (
        <TradelineBody bdo={bdo} tradelineDeals={tradelineDeals} companyDeals={companyDeals} bapxDeals={bapxDeals} grants={grants} />
      )}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────

function Header({ bdo, totalDeals, completedDeals }: { bdo: BDO; totalDeals: number; completedDeals: number }) {
  const { byKey } = useCompanies();
  const co = byKey[bdo.company];
  return (
    <div className="flex items-start justify-between flex-wrap gap-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${companyBadgeClass(co?.color)}`}>
            {co?.name ?? bdo.company}
          </span>
          {bdo.role && <span className="text-xs text-gray-500">{bdo.role}</span>}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{bdo.name}</h1>
        {bdo.email && <p className="text-sm text-gray-500 mt-0.5">{bdo.email}</p>}
      </div>
      <div className="flex gap-3 flex-wrap">
        {[
          { label: "Completed Deals", value: completedDeals },
          { label: "Deals", value: totalDeals },
        ].map(({ label, value }) => (
          <div key={label} className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center min-w-[65px]">
            <div className="text-xs text-blue-600 font-medium">{label}</div>
            <div className="font-bold text-blue-700">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BAPX body: pipeline + clients + tasks (no revenue / grants) ─────────────────

function BapxBody({
  bdo, deals, leads, openTasks, overdueTasks, completedTasks, totalTasks,
}: {
  bdo: BDO;
  deals: BapxDeal[];
  leads: Lead[];
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
  totalTasks: number;
}) {
  const activeDeals = deals.filter((d) => d.dealHealth === "ACTIVE").length;
  const wonDeals = deals.filter(isClosedWon).length;
  const targetPipeline = deals
    .filter((d) => d.dealStage !== "CLOSED_LOST" && d.dealHealth !== "CLOSED_LOST")
    .reduce((s, d) => s + (d.targetGhs ?? 0), 0);

  const openLeads = leads.filter((l) => !CLOSED_LEAD_STATUSES.includes(l.status)).length;
  const convertedLeads = leads.filter((l) => l.status === "CONVERTED").length;

  const { stageData, healthData } = pipelineData(deals);

  return (
    <>
      {/* Pipeline stat tiles */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">BAPX Pipeline</h2>
          <Link href={`/bapx/pipeline?bdo=${encodeURIComponent(bdo.name)}`} className="text-xs font-medium text-accent hover:text-accent/80">
            View pipeline →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Total Deals" value={deals.length} color="blue" />
          <StatTile label="Active" value={activeDeals} color="green" />
          <StatTile label="Closed Won" value={wonDeals} color="blue" />
          <StatTile label="Target Pipeline" value={fmt(targetPipeline)} color="blue" />
        </div>
      </div>

      {/* Leads & tasks tiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Leads</h3>
            <Link href={`/leads?bdo=${encodeURIComponent(bdo.name)}`} className="text-xs font-medium text-accent hover:text-accent/80">
              View leads →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Total" value={leads.length} color="blue" />
            <StatTile label="Open" value={openLeads} color="green" />
            <StatTile label="Converted" value={convertedLeads} color="blue" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Scheme of Work</h3>
            <Link href={`/tasks?bdo=${encodeURIComponent(bdo.name)}`} className="text-xs font-medium text-accent hover:text-accent/80">
              View tasks →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Open" value={openTasks} color={overdueTasks > 0 ? "red" : "blue"} />
            <StatTile label="Overdue" value={overdueTasks} color={overdueTasks > 0 ? "red" : "green"} />
            <StatTile label="Completed" value={`${completedTasks}/${totalTasks}`} color="green" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <PipelineCharts stageData={stageData} healthData={healthData} />
    </>
  );
}

// ── Tradeline body: revenue + grants + charts ──────────────────────────────────

function TradelineBody({
  bdo, tradelineDeals, companyDeals, bapxDeals, grants,
}: {
  bdo: BDO;
  tradelineDeals: TradelineDeal[];
  companyDeals: CompanyDeal[];
  bapxDeals: BapxDeal[];
  grants: GrantLoan[];
}) {
  const expectedRevenue = tradelineDeals.reduce((s, d) => s + (d.expectedRevenueReceivedGhs ?? 0), 0);
  const revenueReceived = tradelineDeals.reduce((s, d) => s + (d.revenueReceivedGhs ?? 0), 0);
  const outstandingBalance = tradelineDeals.reduce((s, d) => s + (d.balanceGhs ?? 0), 0);

  const grantsInProgress = grants.filter((g) => ["DRAFT", "SUBMITTED", "UNDER_REVIEW"].includes(g.status)).length;
  const grantsApproved = grants.filter((g) => ["APPROVED", "DISBURSED"].includes(g.status)).length;
  const grantsTotalValue = grants.reduce((s, g) => s + (g.amountApproved ?? 0), 0);

  const { stageData, healthData } = pipelineData([...bapxDeals, ...tradelineDeals, ...companyDeals]);

  return (
    <>
      {/* Tradeline revenue overview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Tradeline Revenue</h2>
          <Link href={`/tradeline/pipeline?bdo=${encodeURIComponent(bdo.name)}`} className="text-xs font-medium text-accent hover:text-accent/80">
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
          <Link href={`/grant-loans?bdo=${encodeURIComponent(bdo.name)}`} className="text-xs font-medium text-accent hover:text-accent/80">
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

      <PipelineCharts stageData={stageData} healthData={healthData} />
    </>
  );
}

// ── Company body: pipeline + revenue for Alpha Africa / Finance Factory / etc. ──

function CompanyBody({
  bdo, deals, openTasks, overdueTasks, completedTasks, totalTasks,
}: {
  bdo: BDO;
  deals: CompanyDeal[];
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
  totalTasks: number;
}) {
  const { byKey } = useCompanies();
  const activeDeals = deals.filter((d) => d.dealHealth === "ACTIVE").length;
  const wonDeals = deals.filter(isClosedWon).length;
  const potential = deals.reduce((s, d) => s + (d.revenuePotentialGhs ?? 0), 0);
  const received = deals.reduce((s, d) => s + (d.revenueReceivedGhs ?? 0), 0);
  const outstanding = deals.reduce((s, d) => s + (d.balanceGhs ?? 0), 0);

  const { stageData, healthData } = pipelineData(deals);

  const co = byKey[bdo.company];
  const label = co?.name ?? bdo.company;
  const pipelineHref = co ? `${companyHref(co)}?bdo=${encodeURIComponent(bdo.name)}` : "#";

  return (
    <>
      {/* Pipeline stat tiles */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{label} Pipeline</h2>
          <Link href={pipelineHref} className="text-xs font-medium text-accent hover:text-accent/80">
            View pipeline →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Total Deals" value={deals.length} color="blue" />
          <StatTile label="Active" value={activeDeals} color="green" />
          <StatTile label="Closed Won" value={wonDeals} color="blue" />
          <StatTile label="Potential (GHS)" value={fmt(potential)} color="blue" />
        </div>
      </div>

      {/* Revenue overview */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Revenue</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatTile label="Potential Revenue" value={fmt(potential)} color="blue" />
          <StatTile label="Revenue Received" value={fmt(received)} color="green" />
          <StatTile label="Outstanding" value={fmt(outstanding)} color="red" />
        </div>
      </div>

      {/* Scheme of Work */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Scheme of Work</h3>
          <Link href={`/tasks?bdo=${encodeURIComponent(bdo.name)}`} className="text-xs font-medium text-accent hover:text-accent/80">
            View tasks →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Open" value={openTasks} color={overdueTasks > 0 ? "red" : "blue"} />
          <StatTile label="Overdue" value={overdueTasks} color={overdueTasks > 0 ? "red" : "green"} />
          <StatTile label="Completed" value={`${completedTasks}/${totalTasks}`} color="green" />
        </div>
      </div>

      <PipelineCharts stageData={stageData} healthData={healthData} />
    </>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function pipelineData(deals: { dealStage: string; dealHealth: string }[]) {
  const stageData = Object.entries(
    deals.reduce<Record<string, number>>((acc, d) => { acc[d.dealStage] = (acc[d.dealStage] ?? 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  const healthData = Object.entries(
    deals.reduce<Record<string, number>>((acc, d) => { acc[d.dealHealth] = (acc[d.dealHealth] ?? 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  return { stageData, healthData };
}

function PipelineCharts({ stageData, healthData }: { stageData: { name: string; value: number }[]; healthData: { name: string; value: number }[] }) {
  return (
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
  );
}

function StatTile({ label, value, color }: { label: string; value: number | string; color: "blue" | "red" | "green" }) {
  const styles: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    red: "bg-red-50 border-red-200 text-red-700",
    green: "bg-green-50 border-green-200 text-green-700",
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
