"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, ClipboardList, HandCoins, Landmark, Layers, Mail, Users, Wallet } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useCompanies, companyHref, companyBadgeClass } from "@/lib/companies";
import { BrandLoader } from "@/components/BrandLoader";
import { card, EmptyState, isFlagged, label, MiniStat, MoneyTile, SectionHeader, TextLink } from "../../dashboard/components/ui";
import { ChartCard, ChartEmpty } from "@/components/home/charts/ChartCard";
import { AXIS_TICK, BAR_CURSOR, COLOR, ChartTooltip, ramp } from "@/components/home/charts/theme";

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

const isClosedWon = (d: { dealStage: string; dealHealth: string }) => d.dealStage === "CLOSED_WON" || d.dealHealth === "CLOSED_WON";
const OPEN_TASK_STATUSES = ["PENDING", "IN_PROGRESS", "OVERDUE"];
const CLOSED_LEAD_STATUSES = ["CONVERTED", "LOST"];

type TaskCounts = { open: number; overdue: number; completed: number; total: number };

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

  if (bdoLoading) return <BrandLoader label="Loading profile" />;
  if (!bdo) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState title="We couldn't find this person" body="They may have been removed, or the link is out of date." action={<TextLink href="/team">Back to the team</TextLink>} />
      </div>
    );
  }

  // Which pipeline body to show follows the company's deal source, so added companies just work.
  const source = byKey[bdo.company]?.dealSource;
  const isBapx = source === "BAPX";
  const isCompany = source === "COMPANY";

  // Task rollup (shared)
  const taskCounts: TaskCounts = {
    open: tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status)).length,
    overdue: tasks.filter((t) => t.status === "OVERDUE").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    total: tasks.length,
  };

  return (
    // pb-24 keeps the floating "Ask Trunqo" button from covering the last card
    <div className="p-4 md:p-6 pb-24 md:pb-24 space-y-6">
      <Header
        bdo={bdo}
        clients={clients.length}
        totalDeals={bapxDeals.length + tradelineDeals.length + companyDeals.length}
        completedDeals={
          isBapx
            ? bapxDeals.filter(isClosedWon).length
            : bapxDeals.filter(isClosedWon).length +
              tradelineDeals.filter((d) => isClosedWon(d) && d.paymentStatus === "PAID").length +
              companyDeals.filter((d) => isClosedWon(d) && d.paymentStatus === "PAID").length
        }
      />

      {isBapx ? (
        <BapxBody bdo={bdo} deals={bapxDeals} leads={leads} tasks={taskCounts} />
      ) : isCompany ? (
        <CompanyBody bdo={bdo} deals={companyDeals} tasks={taskCounts} />
      ) : (
        <TradelineBody bdo={bdo} tradelineDeals={tradelineDeals} companyDeals={companyDeals} bapxDeals={bapxDeals} grants={grants} />
      )}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────

function Header({ bdo, clients, totalDeals, completedDeals }: { bdo: BDO; clients: number; totalDeals: number; completedDeals: number }) {
  const { byKey } = useCompanies();
  const co = byKey[bdo.company];
  const initials = bdo.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent/10 text-lg font-semibold text-accent" aria-hidden>
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", companyBadgeClass(co?.color))}>{co?.name ?? bdo.company}</span>
            {bdo.role && <span className="text-xs text-muted">{label(bdo.role)}</span>}
          </div>
          <h1 className="mt-1 font-serif text-2xl md:text-3xl text-foreground">{bdo.name.trim()}</h1>
          {bdo.email && (
            <a href={`mailto:${bdo.email}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent">
              <Mail size={14} /> {bdo.email}
            </a>
          )}
        </div>
      </div>

      <div className={clsx(card, "grid grid-cols-3 divide-x divide-border")}>
        <MiniStat label="Deals" value={totalDeals} />
        <MiniStat label="Completed deals" value={completedDeals} />
        <MiniStat label="Clients" value={clients} />
      </div>
      <div className="flex justify-end -mt-2">
        <TextLink href={`/sme?bdo=${encodeURIComponent(bdo.name)}`}>View their clients</TextLink>
      </div>
    </div>
  );
}

// ── BAPX body: pipeline + leads + tasks (no revenue / grants) ──────────────────

function BapxBody({ bdo, deals, leads, tasks }: { bdo: BDO; deals: BapxDeal[]; leads: Lead[]; tasks: TaskCounts }) {
  const activeDeals = deals.filter((d) => d.dealHealth === "ACTIVE").length;
  const wonDeals = deals.filter(isClosedWon).length;
  const targetPipeline = deals
    .filter((d) => d.dealStage !== "CLOSED_LOST" && d.dealHealth !== "CLOSED_LOST")
    .reduce((s, d) => s + (d.targetGhs ?? 0), 0);

  const openLeads = leads.filter((l) => !CLOSED_LEAD_STATUSES.includes(l.status)).length;
  const convertedLeads = leads.filter((l) => l.status === "CONVERTED").length;

  return (
    <>
      <section>
        <SectionHeader
          icon={Layers} title="BAPX pipeline" hint="Deals this person owns, and the value they're aiming for."
          action={<TextLink href={`/bapx/pipeline?bdo=${encodeURIComponent(bdo.name)}`}>View pipeline</TextLink>}
        />
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <div className={clsx(card, "grid grid-cols-3 divide-x divide-border")}>
            <MiniStat label="Total deals" value={deals.length} />
            <MiniStat label="Active" value={activeDeals} />
            <MiniStat label="Closed won" value={wonDeals} />
          </div>
          <MoneyTile icon={Wallet} label="Target pipeline" amount={targetPipeline} display={fmt(targetPipeline)} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader icon={Users} title="Leads" action={<TextLink href={`/leads?bdo=${encodeURIComponent(bdo.name)}`}>View leads</TextLink>} />
          <div className={clsx(card, "grid grid-cols-3 divide-x divide-border")}>
            <MiniStat label="Total" value={leads.length} />
            <MiniStat label="Open" value={openLeads} />
            <MiniStat label="Converted" value={convertedLeads} />
          </div>
        </section>
        <TasksSection bdo={bdo} tasks={tasks} />
      </div>

      <PipelineCharts deals={deals} />
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

  return (
    <>
      <section>
        <SectionHeader
          icon={Banknote} title="Tradeline revenue" hint="What their deals are expected to bring in, and what has come in so far."
          action={<TextLink href={`/tradeline/pipeline?bdo=${encodeURIComponent(bdo.name)}`}>View pipeline</TextLink>}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <MoneyTile icon={Wallet} label="Expected revenue" amount={expectedRevenue} display={fmt(expectedRevenue)} />
          <MoneyTile icon={HandCoins} label="Revenue received" amount={revenueReceived} display={fmt(revenueReceived)} />
          <MoneyTile icon={Banknote} label="Outstanding" amount={outstandingBalance} display={fmt(outstandingBalance)} flag={outstandingBalance > 0} hint={outstandingBalance > 0 ? "Still to be paid" : undefined} />
        </div>
      </section>

      <section>
        <SectionHeader
          icon={Landmark} title="Grants & loans"
          action={<TextLink href={`/grant-loans?bdo=${encodeURIComponent(bdo.name)}`}>View grants & loans</TextLink>}
        />
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <div className={clsx(card, "grid grid-cols-3 divide-x divide-border")}>
            <MiniStat label="Applications" value={grants.length} />
            <MiniStat label="In progress" value={grantsInProgress} />
            <MiniStat label="Approved" value={grantsApproved} />
          </div>
          <MoneyTile icon={Landmark} label="Total approved" amount={grantsTotalValue} display={fmt(grantsTotalValue)} />
        </div>
      </section>

      <PipelineCharts deals={[...bapxDeals, ...tradelineDeals, ...companyDeals]} />
    </>
  );
}

// ── Company body: pipeline + revenue for Alpha Africa / Finance Factory / etc. ──

function CompanyBody({ bdo, deals, tasks }: { bdo: BDO; deals: CompanyDeal[]; tasks: TaskCounts }) {
  const { byKey } = useCompanies();
  const activeDeals = deals.filter((d) => d.dealHealth === "ACTIVE").length;
  const wonDeals = deals.filter(isClosedWon).length;
  const potential = deals.reduce((s, d) => s + (d.revenuePotentialGhs ?? 0), 0);
  const received = deals.reduce((s, d) => s + (d.revenueReceivedGhs ?? 0), 0);
  const outstanding = deals.reduce((s, d) => s + (d.balanceGhs ?? 0), 0);

  const co = byKey[bdo.company];
  const name = co?.name ?? bdo.company;
  const pipelineHref = co ? `${companyHref(co)}?bdo=${encodeURIComponent(bdo.name)}` : "#";

  return (
    <>
      <section>
        <SectionHeader icon={Layers} title={`${name} pipeline`} action={<TextLink href={pipelineHref}>View pipeline</TextLink>} />
        <div className={clsx(card, "grid grid-cols-3 divide-x divide-border")}>
          <MiniStat label="Total deals" value={deals.length} />
          <MiniStat label="Active" value={activeDeals} />
          <MiniStat label="Closed won" value={wonDeals} />
        </div>
      </section>

      <section>
        <SectionHeader icon={Banknote} title="Revenue" hint="What their deals could bring in, and what has come in so far." />
        <div className="grid gap-3 sm:grid-cols-3">
          <MoneyTile icon={Wallet} label="Potential revenue" amount={potential} display={fmt(potential)} />
          <MoneyTile icon={HandCoins} label="Revenue received" amount={received} display={fmt(received)} />
          <MoneyTile icon={Banknote} label="Outstanding" amount={outstanding} display={fmt(outstanding)} flag={outstanding > 0} hint={outstanding > 0 ? "Still to be paid" : undefined} />
        </div>
      </section>

      <TasksSection bdo={bdo} tasks={tasks} />

      <PipelineCharts deals={deals} />
    </>
  );
}

// ── Shared pieces ──────────────────────────────────────────────────────────────

function TasksSection({ bdo, tasks }: { bdo: BDO; tasks: TaskCounts }) {
  const pct = tasks.total ? Math.round((tasks.completed / tasks.total) * 100) : 0;
  return (
    <section>
      <SectionHeader icon={ClipboardList} title="Scheme of work" action={<TextLink href={`/tasks?bdo=${encodeURIComponent(bdo.name)}`}>View tasks</TextLink>} />
      <div className={card}>
        <div className="grid grid-cols-3 divide-x divide-border">
          <MiniStat label="Open" value={tasks.open} />
          <MiniStat label="Overdue" value={tasks.overdue} flag={tasks.overdue > 0} />
          <MiniStat label="Completed" value={tasks.completed} />
        </div>
        {tasks.total > 0 && (
          <div className="flex items-center gap-3 border-t border-border px-4 py-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted">{tasks.completed} of {tasks.total} done</span>
          </div>
        )}
      </div>
    </section>
  );
}

function countBy(deals: { dealStage: string; dealHealth: string }[], key: "dealStage" | "dealHealth") {
  const counts = deals.reduce<Record<string, number>>((acc, d) => { acc[d[key]] = (acc[d[key]] ?? 0) + 1; return acc; }, {});
  return Object.entries(counts).map(([raw, value]) => ({ raw, name: label(raw), value }));
}

// Neutral ink for the baseline, the accent for "look here" (won deals, deals at risk).
function PipelineCharts({ deals }: { deals: { dealStage: string; dealHealth: string }[] }) {
  const stageData = countBy(deals, "dealStage");
  const healthData = countBy(deals, "dealHealth").sort((a, b) => b.value - a.value);
  const healthTotal = healthData.reduce((n, d) => n + d.value, 0);
  const healthColor = (raw: string, i: number) =>
    isFlagged(raw) ? { fill: COLOR.accent, opacity: 1 }
    : raw === "CLOSED_WON" ? { fill: COLOR.accent, opacity: 0.55 }
    : { fill: COLOR.ink, opacity: ramp(i, healthData.length, 0.85, 0.3) };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Deals by stage" description="How many of their deals sit at each stage">
        {stageData.length === 0 ? (
          <ChartEmpty>No deals yet.</ChartEmpty>
        ) : (
          <div className="w-full" style={{ height: Math.max(160, stageData.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={stageData} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }} barCategoryGap={8}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip format={(n) => `${n} deal${n === 1 ? "" : "s"}`} />} cursor={BAR_CURSOR} />
                <Bar dataKey="value" name="Deals" radius={[0, 6, 6, 0]} maxBarSize={22}>
                  {stageData.map((d, i) => (
                    <Cell key={d.raw} fill={d.raw === "CLOSED_WON" ? COLOR.accent : COLOR.ink} fillOpacity={d.raw === "CLOSED_WON" ? 1 : ramp(i, stageData.length, 0.3, 0.85)} />
                  ))}
                  <LabelList dataKey="value" position="right" fontSize={11} fontWeight={600} fill={COLOR.ink} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Deal health" description="Whether their deals are moving, at risk or closed">
        {healthData.length === 0 ? (
          <ChartEmpty>No deals yet.</ChartEmpty>
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie data={healthData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={80} paddingAngle={healthData.length > 1 ? 3 : 0} stroke="none" startAngle={90} endAngle={-270}>
                    {healthData.map((d, i) => { const c = healthColor(d.raw, i); return <Cell key={d.raw} fill={c.fill} fillOpacity={c.opacity} />; })}
                  </Pie>
                  <Tooltip content={<ChartTooltip format={(n) => `${n} deal${n === 1 ? "" : "s"}`} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold leading-none tracking-tight text-foreground tabular-nums">{healthTotal}</span>
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Deals</span>
              </div>
            </div>
            <ul className="min-w-[160px] flex-1 space-y-2.5">
              {healthData.map((d, i) => {
                const c = healthColor(d.raw, i);
                return (
                  <li key={d.raw} className="flex items-center gap-2.5 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.fill, opacity: c.opacity }} aria-hidden />
                    <span className="text-muted">{d.name}</span>
                    <span className="ml-auto font-semibold tabular-nums text-foreground">{d.value}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
