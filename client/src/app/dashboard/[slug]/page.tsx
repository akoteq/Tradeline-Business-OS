"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useCompanies, companyHref } from "@/lib/companies";
import { BrandLoader } from "@/components/BrandLoader";
import {
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Layers,
  AlertTriangle,
  ClipboardList,
  Target,
  Wallet,
  CircleDollarSign,
  TrendingDown,
  Landmark,
  Users,
  Lock,
  Globe2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// ---- Types ------------------------------------------------------------

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
  /**
   * FR-16–18: net profit, burn rate, and ROI are computed nightly by the
   * accounting engine (FinancialSnapshot). Optional until that job ships —
   * the Finance tab shows an honest "not available yet" state without it.
   */
  finance?: {
    netProfit: number;
    burnRate: number;
    roi: number;
    totalInvested: number;
    expensesByCategory: { category: string; amount: number }[];
  };
  /**
   * FR-8–14: Leads are staff-managed prospects, private by default, flagged
   * public by the Business CEO. Group Owner sees all regardless of
   * visibility — that scoping happens server-side, this just renders what
   * the API returns for the signed-in role. Optional until wired.
   */
  leads?: {
    id: string;
    businessName: string;
    stage: string;
    estimatedValue: number;
    ownerName: string;
    visibility: "private" | "public";
  }[];
  /**
   * FR-19–20: task-level detail behind the Scheme of work / Tasks tab.
   * Optional until the task list endpoint is wired — the summary counts on
   * `tasks` still render without it.
   */
  taskList?: {
    id: string;
    title: string;
    assigneeName: string;
    dueDate: string; // ISO date
    status: "OPEN" | "OVERDUE" | "COMPLETED";
  }[];
};

const fmt = (n: number | null | undefined) =>
  n != null ? n.toLocaleString("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 }) : "—";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GH", { month: "short", day: "numeric" });

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const tabFade = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// ---- On-brand status tags (accent = needs attention, muted = neutral) ----

const FLAG_WORDS = ["risk", "overdue", "off", "unpaid"];

function formatLabel(v: string) {
  return v.replace(/_/g, " ").toLowerCase();
}

function Tag({ value }: { value: string }) {
  const flagged = FLAG_WORDS.some((w) => value.toLowerCase().includes(w));
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        flagged ? "border-accent/25 bg-accent/[0.08] text-accent" : "border-border bg-background text-muted"
      }`}
    >
      {formatLabel(value)}
    </span>
  );
}

function VisibilityTag({ visibility }: { visibility: "private" | "public" }) {
  const Icon = visibility === "private" ? Lock : Globe2;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
      <Icon size={10} />
      {visibility}
    </span>
  );
}

function SectionHeader({ icon: Icon, label, hint }: { icon: LucideIcon; label: string; hint?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Icon size={13} strokeWidth={2.25} />
        </span>
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      </div>
      {hint && <p className="mt-1 pl-8 text-xs text-muted">{hint}</p>}
    </div>
  );
}

type TabItem = { id: string; label: string; icon: LucideIcon };

function TabSwitcher({ items, activeId, onSelect }: { items: TabItem[]; activeId: string; onSelect: (id: string) => void }) {
  return (
    <nav aria-label="Company dashboard sections" className="sticky top-0 z-20 -mx-6 border-b border-border bg-background/85 px-6 backdrop-blur-md md:-mx-10 md:px-10">
      <ul className="flex gap-1 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                <item.icon size={13} />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---- AI-generated company summary ----------------------------------------
//
// FR-19/20 already produce templated flag copy for the alert pipeline
// ("Finance Factory: expenses outpaced revenue by 18% this month"). This is
// the same idea surfaced at the top of the dashboard instead of only in a
// push notification: one plain-English sentence built from the same nightly
// snapshot data, refreshed whenever `data` changes.
//
// This is a deterministic template today (safe, free, always available —
// matches the "financial accuracy must be deterministic" guardrail for the
// numbers it quotes). If you want actual LLM phrasing instead of the
// template, swap `buildSummary`'s return for a call to your `/v1/messages`
// proxy, passing the same three inputs as the prompt, and keep this
// function as the loading/fallback state.
function buildSummary(data: CompanyDash): string {
  const parts: string[] = [];

  if (data.finance) {
    const { netProfit } = data.finance;
    if (netProfit > 0) parts.push(`profitable this period at ${fmt(netProfit)} net`);
    else if (netProfit < 0) parts.push(`running a loss of ${fmt(Math.abs(netProfit))} this period`);
  } else if (!data.source.includes("BAPX") && data.revenue.outstanding > 0) {
    parts.push(`${fmt(data.revenue.outstanding)} outstanding on the books`);
  }

  if (data.tasks.overdue > 0) {
    parts.push(`${data.tasks.overdue} task${data.tasks.overdue === 1 ? "" : "s"} overdue`);
  }

  if (data.active > 0) {
    parts.push(`${data.active} active deal${data.active === 1 ? "" : "s"} in motion`);
  }

  if (parts.length === 0) {
    return "Nothing flagged — steady week.";
  }

  // Join as a single readable sentence, capitalised once.
  const sentence = parts.join(", ").replace(/^./, (c) => c.toUpperCase());
  return `${sentence}.`;
}

function AISummaryCard({ data }: { data: CompanyDash }) {
  // `refreshKey` just forces buildSummary to re-run against the latest
  // `data` already in cache. If/when this is backed by a real LLM call,
  // swap this for a mutation that re-requests a fresh phrasing and keep
  // the same loading/empty states below.
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const summary = useMemo(() => buildSummary(data), [data, refreshKey]);
  const hasSignal = summary !== "Nothing flagged — steady week.";

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    // Cosmetic delay so "Refresh" reads as an action, not a no-op —
    // remove once this is wired to a real async regeneration call.
    window.setTimeout(() => setIsRefreshing(false), 400);
  };

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/[0.05] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Sparkles size={14} strokeWidth={2.25} />
          </span>
          <span className="text-sm font-semibold text-foreground">AI summary</span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-xs font-semibold text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className={`mt-2 pl-9 text-sm ${hasSignal ? "text-foreground" : "text-muted"}`}>
        {isRefreshing ? "Reading the latest numbers…" : summary}
      </p>
    </div>
  );
}

// ---- Page ---------------------------------------------------------------

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
  const [activeId, setActiveId] = useState("overview");

  const leads = data?.leads ?? [];
  const taskList = data?.taskList ?? [];
  const finance = data?.finance;

  // Reading order follows the money: results (Overview) → what's driving
  // them (Finance, Deals) → what's coming next (Leads) → execution (Tasks).
  const tabs: TabItem[] = [
    { id: "overview", label: "Overview", icon: Layers },
    { id: "finance", label: "Finance", icon: Landmark },
    { id: "deals", label: "Deals", icon: Target },
    { id: "leads", label: "Leads", icon: Users },
    { id: "tasks", label: "Tasks", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl space-y-8 px-6 pt-2 pb-14 md:px-10 md:pt-4 md:pb-16">
        {/* ---- Masthead --------------------------------------------------- */}
        <motion.header
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5 border-b border-dashed border-border pb-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <h1 className="font-serif text-[2rem] leading-[1.15] text-foreground md:text-[2.5rem]">
                {company?.name ?? slug}
              </h1>
              <p className="text-sm text-muted">A quick look at how this business is doing.</p>
            </div>
            {company && (
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Link
                  href={companyHref(company)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/[0.08] px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  See every deal
                  <ArrowRight size={15} />
                </Link>
                <p className="text-[11px] text-muted">Opens the full deal-by-deal list</p>
              </div>
            )}
          </div>

          {data && <AISummaryCard data={data} />}
        </motion.header>

        {isLoading || !data ? (
          <BrandLoader fullScreen={false} label="Loading dashboard" />
        ) : (
          <>
            <TabSwitcher items={tabs} activeId={activeId} onSelect={setActiveId} />

            <AnimatePresence mode="wait">
              {activeId === "overview" && (
                <motion.div
                  key="overview"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={tabFade}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                    <StatTile icon={Layers} label="Total deals" value={data.total} />
                    <StatTile icon={TrendingUp} label="Active" value={data.active} />
                    <StatTile icon={CheckCircle2} label="Closed won" value={data.closedWon} />
                    <StatTile icon={AlertTriangle} label="Overdue tasks" value={data.tasks.overdue} flag={data.tasks.overdue > 0} />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
                    <MoneyTile
                      icon={Wallet}
                      label={isBapx ? "Target value" : "Potential revenue"}
                      amount={data.revenue.revenuePotential}
                      display={fmt(data.revenue.revenuePotential)}
                    />
                    <MoneyTile
                      icon={CircleDollarSign}
                      label="Revenue received"
                      amount={isBapx ? null : data.revenue.revenueReceived}
                      display={isBapx ? "—" : fmt(data.revenue.revenueReceived)}
                    />
                    <MoneyTile
                      icon={TrendingDown}
                      label="Outstanding"
                      amount={isBapx ? null : data.revenue.outstanding}
                      display={isBapx ? "—" : fmt(data.revenue.outstanding)}
                      flag={!isBapx && data.revenue.outstanding > 0}
                    />
                  </div>
                </motion.div>
              )}

              {activeId === "finance" && (
                <motion.div
                  key="finance"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={tabFade}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <SectionHeader
                    icon={Landmark}
                    label="Finance"
                    hint="What the business kept, spent, and got back — computed automatically each night."
                  />
                  {!finance ? (
                    <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted">
                      Finance numbers aren&apos;t connected yet. Once the accounting engine is live, net profit, spending
                      speed, and return on investment show up here.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <MoneyTile
                          icon={Landmark}
                          label="Net profit"
                          amount={finance.netProfit}
                          display={fmt(finance.netProfit)}
                          hint="Money kept after every expense"
                          flag={finance.netProfit < 0}
                        />
                        <MoneyTile
                          icon={TrendingDown}
                          label="Burn rate"
                          amount={finance.burnRate}
                          display={`${fmt(finance.burnRate)}/mo`}
                          hint="How fast cash is going out"
                        />
                        <MoneyTile
                          icon={TrendingUp}
                          label="Return on investment"
                          amount={finance.roi}
                          display={`${finance.roi.toFixed(1)}×`}
                          hint="Money back for every cedi put in"
                        />
                      </div>

                      <div className="rounded-2xl border border-border bg-surface p-5">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">Spending by category</p>
                          <p className="text-xs text-muted">Total invested: {fmt(finance.totalInvested)}</p>
                        </div>
                        {finance.expensesByCategory.length === 0 ? (
                          <p className="mt-3 text-sm text-muted">No categorized expenses logged yet.</p>
                        ) : (
                          <ul className="mt-3 divide-y divide-dashed divide-border">
                            {finance.expensesByCategory
                              .sort((a, b) => b.amount - a.amount)
                              .map((e) => {
                                const max = Math.max(...finance.expensesByCategory.map((x) => x.amount), 1);
                                return (
                                  <li key={e.category} className="py-2.5">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-foreground">{e.category}</span>
                                      <span className="font-medium tabular-nums text-foreground">{fmt(e.amount)}</span>
                                    </div>
                                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-background">
                                      <div
                                        className={`h-full rounded-full ${
                                          e.category.toLowerCase().includes("discretionary") ? "bg-accent" : "bg-foreground/40"
                                        }`}
                                        style={{ width: `${(e.amount / max) * 100}%` }}
                                      />
                                    </div>
                                  </li>
                                );
                              })}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeId === "deals" && (
                <motion.div
                  key="deals"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={tabFade}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <SectionHeader icon={Target} label="Top deals" hint="Your biggest deals by potential value." />
                  {data.topDeals.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted">
                      No deals yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-dashed border-border">
                            {["Business", "Stage", "Health", isBapx ? "Target" : "Potential", "Invoice"].map((h, i) => (
                              <th
                                key={h}
                                className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted ${
                                  i === 3 ? "text-right" : "text-left"
                                }`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dashed divide-border">
                          {data.topDeals.map((d) => (
                            <tr key={d.id} className="hover:bg-background/50">
                              <td className="max-w-[180px] truncate px-4 py-3 font-medium text-foreground">{d.businessName}</td>
                              <td className="px-4 py-3"><Tag value={d.dealStage} /></td>
                              <td className="px-4 py-3"><Tag value={d.dealHealth} /></td>
                              <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-foreground">
                                {fmt(d.potential)}
                              </td>
                              <td className="px-4 py-3"><Tag value={d.invoiceStatus} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              )}

              {activeId === "leads" && (
                <motion.div
                  key="leads"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={tabFade}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <SectionHeader
                    icon={Users}
                    label="Leads"
                    hint="Prospects staff are working before they become paying deals. Private ones are only visible to their owner until flagged public."
                  />
                  {leads.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted">
                      No leads yet. Once staff start prospecting, they&apos;ll show up here.
                    </div>
                  ) : (
                    <ul className="divide-y divide-dashed divide-border rounded-2xl border border-border bg-surface">
                      {leads.map((l) => (
                        <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">{l.businessName}</p>
                            <p className="truncate text-xs text-muted">{l.ownerName}</p>
                          </div>
                          <Tag value={l.stage} />
                          <VisibilityTag visibility={l.visibility} />
                          <span className="w-24 shrink-0 whitespace-nowrap text-right font-medium tabular-nums text-foreground">
                            {fmt(l.estimatedValue)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}

              {activeId === "tasks" && (
                <motion.div
                  key="tasks"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={tabFade}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4"
                >
                  <SectionHeader icon={ClipboardList} label="Tasks" hint="What's assigned to this business's team right now." />

                  <div className="grid grid-cols-3 divide-x divide-dashed divide-border rounded-2xl border border-border bg-surface">
                    <MiniStat label="Open" value={data.tasks.open} />
                    <MiniStat label="Overdue" value={data.tasks.overdue} flag={data.tasks.overdue > 0} />
                    <MiniStat label="Completed" value={data.tasks.completed} />
                  </div>

                  {taskList.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted">
                      Task-level detail isn&apos;t wired up yet — counts above come from the summary endpoint, but the
                      individual tasks behind each number will list here once available.
                    </div>
                  ) : (
                    <ul className="divide-y divide-dashed divide-border rounded-2xl border border-border bg-surface">
                      {taskList
                        .slice()
                        .sort((a, b) => (a.status === "OVERDUE" ? -1 : b.status === "OVERDUE" ? 1 : 0))
                        .map((t) => (
                          <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground">{t.title}</p>
                              <p className="truncate text-xs text-muted">{t.assigneeName}</p>
                            </div>
                            <span className="w-16 shrink-0 whitespace-nowrap text-right text-xs text-muted">
                              {fmtDate(t.dueDate)}
                            </span>
                            <Tag value={t.status} />
                          </li>
                        ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Subcomponents --------------------------------------------------------

function StatTile({ icon: Icon, label, value, flag = false }: { icon: LucideIcon; label: string; value: number; flag?: boolean }) {
  const empty = value === 0 && !flag;
  return (
    <div className="relative rounded-2xl border border-border bg-surface px-5 py-5">
      {flag && <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Icon size={13} strokeWidth={2.25} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">{label}</span>
      </div>
      <div
        className={`mt-2.5 font-serif text-2xl leading-none tabular-nums md:text-[1.75rem] ${
          flag ? "text-accent" : empty ? "text-muted" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function MoneyTile({
  icon: Icon,
  label,
  amount,
  display,
  hint,
  flag = false,
}: {
  icon: LucideIcon;
  label: string;
  amount: number | null;
  display: string;
  hint?: string;
  flag?: boolean;
}) {
  const empty = (amount === null || amount === 0) && !flag;
  return (
    <div className="relative rounded-2xl border border-border bg-surface px-5 py-5">
      {flag && <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Icon size={13} strokeWidth={2.25} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">{label}</span>
      </div>
      <div
        className={`mt-2.5 font-serif text-xl leading-none tabular-nums md:text-2xl ${
          flag ? "text-accent" : empty ? "text-muted" : "text-foreground"
        }`}
      >
        {display}
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function MiniStat({ label, value, flag = false }: { label: string; value: number; flag?: boolean }) {
  const empty = value === 0 && !flag;
  return (
    <div className="px-5 py-5 text-center">
      <div
        className={`font-serif text-2xl leading-none tabular-nums ${
          flag ? "text-accent" : empty ? "text-muted" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}