"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetcher } from "@/lib/api";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flag,
  Gauge,
  Layers,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { BrandLoader } from "@/components/BrandLoader";

/**
 * TYPE SYSTEM — this file uses the two faces wired in app/layout.tsx and
 * mapped in globals.css: Manrope (--font-sans) is the default on <body>,
 * so headline/label/tab text needs no extra class — weight and tracking
 * do the "display" work. Instrument Serif (--font-serif) ships at 400
 * only and is a decorative display face, so it's spent in exactly one
 * place: the hero deadline count in the masthead. Every other numeral —
 * stat figures, table indices, tab counts — is a number someone is
 * scanning fast to catch a problem, so it stays sans/bold/tabular for
 * legibility. One flourish, not four.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const tabFade = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const tickStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.15 } },
};

const tick = {
  hidden: { scaleY: 0, opacity: 0 },
  visible: { scaleY: 1, opacity: 1 },
};

// ---- Types ------------------------------------------------------------

type Urgency = "overdue" | "today" | "1day" | "3days" | "week";

type Deadline = {
  id: string;
  type: "TRADELINE" | "TASK";
  subtype?: string;
  businessName: string;
  dueDate: string;
  daysUntil: number;
  urgency: Urgency;
  bdo: { id: string; name: string } | null;
};

type StaleDeal = {
  id: string;
  type: "BAPX" | "TRADELINE" | "COMPANY";
  businessName: string;
  dealHealth: string;
  lastUpdated: string;
  daysSinceUpdate: number;
  bdo: { id: string; name: string } | null;
};

/**
 * FinancialFlag isn't returned by /alerts yet — FR-19 calls for auto-flags
 * on profit decline, discretionary spend spikes, and burn acceleration, on
 * top of the overdue-task flags already wired below. Typed as optional so
 * this compiles and renders nothing until the accounting engine ships it.
 */
type FinancialFlag = {
  id: string;
  kind: "profit_decline" | "discretionary_spike" | "burn_acceleration";
  businessName: string;
  message: string;
};

type AlertsResponse = { deadlines: Deadline[]; stale: StaleDeal[]; flags?: FinancialFlag[] };

/**
 * Accounting fields (FR-16–18) and Leads (FR-12) are spec'd but may not be
 * populated by every backend yet — all optional, same pattern as
 * FinancialFlag above. Sections built on these hide gracefully until real
 * data lands, rather than rendering an empty placeholder.
 */
type CoSummary = {
  key: string; name: string; slug: string;
  total: number; active: number; closedWon: number;
  revenue: { potential: number; received: number; outstanding: number };
  health?: "on-track" | "at-risk" | "off-track";
  netProfit?: number;
  burnRate?: number;
  roi?: number;
  investment?: number;
};
type DealRow = { businessName: string; company: string; amount: number; dealStage: string; dealHealth: string };
type LeadsSummary = { total: number; public: number; private: number; wonThisMonth: number };
type Exec = {
  totals: {
    deals: number; active: number; closedWon: number;
    potential: number; received: number; outstanding: number;
    netProfit?: number; burnRate?: number; investment?: number;
  };
  companies: CoSummary[];
  kpiHealth: { onTrack: number; atRisk: number; offTrack: number; noTarget: number };
  topDeals: DealRow[];
  topRisks: DealRow[];
  leads?: LeadsSummary;
};

type ExecutiveSummary = { summary: string; generatedAt: string };

const fmt = (n: number) =>
  (n ?? 0).toLocaleString("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 });
const fmtCompact = (n: number) =>
  (n ?? 0).toLocaleString("en-GH", { style: "currency", currency: "GHS", notation: "compact", maximumFractionDigits: 1 });
const fmtSigned = (n: number) =>
  `${n > 0 ? "+" : ""}${fmtCompact(n)}`;

const URGENCY_RANK: Record<Urgency, number> = { overdue: 0, today: 1, "1day": 2, "3days": 3, week: 4 };
const URGENCY_URGENT: Urgency[] = ["overdue", "today", "1day"];

function urgencyLabel(u: Urgency, daysUntil: number) {
  switch (u) {
    case "overdue": return `${Math.abs(daysUntil)}d overdue`;
    case "today": return "Due today";
    case "1day": return "1 day left";
    default: return `${daysUntil}d left`;
  }
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const FLAG_LABEL: Record<FinancialFlag["kind"], string> = {
  profit_decline: "Profit decline",
  discretionary_spike: "Discretionary spend spike",
  burn_acceleration: "Burn accelerating",
};

const PIPELINE_HREF: Partial<Record<StaleDeal["type"], string>> = {
  BAPX: "/bapx/pipeline",
  TRADELINE: "/tradeline/pipeline",
};

function deadlineLink(d: Deadline) {
  if (d.type === "TASK") return d.bdo?.name ? `/tasks?bdo=${encodeURIComponent(d.bdo.name)}` : "/tasks";
  return d.bdo?.name ? `${PIPELINE_HREF.TRADELINE}?bdo=${encodeURIComponent(d.bdo.name)}` : PIPELINE_HREF.TRADELINE ?? "/tasks";
}

/** Collapse individual stale deals into one line per (type, owner) — the signal
 * that matters is "this book has gone quiet," not each business name in it. */
function groupStale(stale: StaleDeal[]) {
  const groups = new Map<string, { type: StaleDeal["type"]; bdoName: string | null; count: number; maxDays: number }>();
  for (const d of stale) {
    const key = `${d.type}|${d.bdo?.name ?? "—"}`;
    const g = groups.get(key);
    if (g) {
      g.count += 1;
      g.maxDays = Math.max(g.maxDays, d.daysSinceUpdate);
    } else {
      groups.set(key, { type: d.type, bdoName: d.bdo?.name ?? null, count: 1, maxDays: d.daysSinceUpdate });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

const RISK_WORDS = ["risk", "overdue", "off"];

function formatLabel(v: string) {
  return v.replace(/_/g, " ").toLowerCase();
}

function isRiskValue(v: string) {
  const lower = v.toLowerCase();
  return RISK_WORDS.some((w) => lower.includes(w));
}

function Tag({ value }: { value: string }) {
  const flagged = isRiskValue(value);
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

function SectionHeader({
  icon: Icon,
  label,
  cta,
  aside,
  index,
}: {
  icon: LucideIcon;
  label: string;
  cta?: { label: string; href: string };
  aside?: string;
  /** Literal ledger entry number — only pass this in the Company Health
   * register, where row order is a real journal, not decoration. */
  index?: number;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {typeof index === "number" && (
          <span className="text-xs font-semibold tabular-nums text-muted/70">
            {String(index).padStart(2, "0")}
          </span>
        )}
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Icon size={13} strokeWidth={2.25} />
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{label}</h2>
      </div>
      {cta ? (
        <Link
          href={cta.href}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/25 bg-accent/[0.08] px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {cta.label}
          <ChevronRight size={12} />
        </Link>
      ) : aside ? (
        <span className="shrink-0 text-xs text-muted">{aside}</span>
      ) : null}
    </div>
  );
}

function todayStamp() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ---- Ledger strip — signature element ------------------------------------
// "Seven Companies, One Ledger." One tick per company, color-coded by
// health, drawn in on load. This is the whole group's state at a glance,
// living right next to the headline instead of buried behind a tab.

function healthTickClass(health: CoSummary["health"] | undefined, dormant: boolean) {
  if (dormant) return "bg-border";
  switch (health) {
    case "off-track": return "bg-accent";
    case "at-risk": return "bg-accent/45";
    case "on-track": return "bg-foreground/70";
    default: return "bg-foreground/35";
  }
}

function LedgerStrip({ companies }: { companies: CoSummary[] }) {
  if (companies.length === 0) return null;
  const flagged = companies.filter((c) => c.health === "off-track" || c.health === "at-risk").length;
  return (
    <div className="flex flex-col items-end gap-1.5">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={tickStagger}
        className="flex items-stretch gap-[3px]"
        role="img"
        aria-label={`Health across ${companies.length} companies`}
      >
        {companies.map((c) => {
          const dormant = c.active === 0 && c.revenue.received === 0;
          return (
            <motion.span
              key={c.key}
              variants={tick}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: "bottom" }}
              title={c.name}
              className={`h-9 w-1 rounded-full ${healthTickClass(c.health, dormant)}`}
            />
          );
        })}
      </motion.div>
      <span className="text-[11px] uppercase tracking-[0.1em] text-muted">
        {companies.length} companies{flagged > 0 ? ` · ${flagged} need attention` : ""}
      </span>
    </div>
  );
}

// ---- Quick nav (tab switcher, not a scroll anchor) -------------------------

type NavItem = { id: string; label: string; icon: LucideIcon; count?: number };

function QuickNav({
  items,
  activeId,
  onSelect,
}: {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Dashboard sections" className="sticky top-0 z-20 -mx-5 border-b border-border bg-background/85 px-5 backdrop-blur-md md:-mx-8 md:px-8">
      <ul className="flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 py-3 text-xs font-semibold tracking-tight transition-colors ${
                  active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                <item.icon size={13} className={active ? "text-accent" : undefined} />
                {item.label}
                {typeof item.count === "number" && (
                  <span className={`tabular-nums ${active ? "text-accent" : "text-muted/70"}`}>{item.count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---- AI summary — margin note, not a dead box ------------------------------
// Empty state used to be a bordered card announcing nothing was there. Now
// it's a slim strip in the ledger's own voice: what's happening and when
// to check back — direction, not apology.

function AiSummaryStrip({ query }: { query: ReturnType<typeof useQuery<ExecutiveSummary>> }) {
  const { data, isLoading, isError, refetch, isFetching } = query;
  const hasSummary = !isLoading && !isError && !!data?.summary;

  return (
    <div className={`flex gap-3 border-l-2 py-1 pl-4 ${hasSummary ? "border-accent" : "border-border"}`}>
      <span className="mt-0.5 shrink-0 text-accent">
        <Sparkles size={13} strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        {isLoading ? (
          <div className="space-y-1.5 py-0.5">
            <div className="h-3 w-5/6 animate-pulse rounded-full bg-accent/10" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-accent/10" />
          </div>
        ) : hasSummary ? (
          <p className="text-sm leading-relaxed text-foreground/90">{data!.summary}</p>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            Tonight&apos;s snapshot hasn&apos;t run yet — the summary lands once it does.
          </p>
        )}
        <div className="mt-1 flex items-center gap-3">
          {data?.generatedAt && <span className="text-[11px] text-muted">Updated {timeAgo(data.generatedAt)}</span>}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-[11px] font-semibold text-accent hover:underline disabled:opacity-50"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Attention glance — the dense view that fills the center ---------------
// Feedback: too much empty beige between the headline and the actual
// information. This puts the two things a Group Owner actually needs —
// what's overdue, what's gone quiet — right on Overview, at a glance
// density, instead of hiding them a tab away.

function AttentionGlance({
  deadlines,
  staleGroups,
  flags,
  breakdown,
}: {
  deadlines: Deadline[];
  staleGroups: ReturnType<typeof groupStale>;
  flags: FinancialFlag[];
  breakdown: string;
}) {
  const topDeadlines = deadlines.slice(0, 3);
  const topStale = staleGroups.slice(0, 3);
  if (topDeadlines.length === 0 && topStale.length === 0 && flags.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">At a glance</h2>
        {breakdown && <span className="text-xs text-muted">{breakdown}</span>}
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
        {topDeadlines.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Deadlines</p>
            <ul className="space-y-1.5">
              {topDeadlines.map((d) => {
                const urgent = URGENCY_URGENT.includes(d.urgency);
                return (
                  <li key={d.id}>
                    <Link href={deadlineLink(d)} className="flex items-baseline justify-between gap-3 text-sm hover:text-accent">
                      <span className="min-w-0 truncate text-foreground">{d.businessName}</span>
                      <span className={`shrink-0 tabular-nums ${urgent ? "font-semibold text-accent" : "text-muted"}`}>
                        {urgencyLabel(d.urgency, d.daysUntil)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {topStale.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Deals going quiet</p>
            <ul className="space-y-1.5">
              {topStale.map((g, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-foreground">
                    {g.type} <span className="text-muted">· {g.count} deal{g.count === 1 ? "" : "s"}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-accent">{g.maxDays}d+ silent</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {flags.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Financial signals</p>
            <ul className="space-y-1.5">
              {flags.slice(0, 3).map((f) => (
                <li key={f.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-foreground">{f.businessName}</span>
                  <span className="shrink-0 font-semibold text-accent">{FLAG_LABEL[f.kind]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Page ---------------------------------------------------------------

export default function CEODashboard() {
  const alerts = useQuery<AlertsResponse>({ queryKey: ["alerts"], queryFn: () => fetcher("/alerts") });
  const exec = useQuery<Exec>({ queryKey: ["executive-dashboard"], queryFn: () => fetcher("/dashboard/executive") });
  const summary = useQuery<ExecutiveSummary>({
    queryKey: ["executive-summary"],
    queryFn: () => fetcher("/dashboard/executive/summary"),
  });

  const [activeId, setActiveId] = useState("overview");

  const data = exec.data;

  const deadlines = useMemo(
    () =>
      [...(alerts.data?.deadlines ?? [])].sort(
        (a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || a.daysUntil - b.daysUntil
      ),
    [alerts.data?.deadlines]
  );
  const stale = alerts.data?.stale ?? [];
  const staleGroups = useMemo(() => groupStale(stale), [stale]);
  const financialFlags = alerts.data?.flags ?? [];

  const urgentCount = deadlines.filter((d) => URGENCY_URGENT.includes(d.urgency)).length;
  const visibleDeadlines = deadlines.slice(0, 4);
  const visibleStaleGroups = staleGroups.slice(0, 3);
  const visibleFlags = financialFlags.slice(0, 4);

  // Individual counts (not grouped) — this is what "N things need attention"
  // should always add up from, so the headline, the tab badge, and the
  // Attention section header never imply different totals.
  const attentionCount = deadlines.length + stale.length + financialFlags.length;
  const attentionBreakdown = [
    deadlines.length > 0 ? `${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"}` : null,
    stale.length > 0 ? `${stale.length} silent deal${stale.length === 1 ? "" : "s"}` : null,
    financialFlags.length > 0 ? `${financialFlags.length} financial flag${financialFlags.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(" · ");

  const activeCompanies = useMemo(
    () => (data ? [...data.companies].sort((a, b) => b.active - a.active) : []),
    [data]
  );

  const kpiTotal = data
    ? data.kpiHealth.onTrack + data.kpiHealth.atRisk + data.kpiHealth.offTrack + data.kpiHealth.noTarget
    : 0;

  const hasAttention = deadlines.length > 0 || staleGroups.length > 0 || visibleFlags.length > 0;
  const hasAccounting = data ? typeof data.totals.netProfit === "number" : false;
  const hasLeads = !!data?.leads;

  const navItems = useMemo<NavItem[]>(
    () =>
      [
        { id: "overview", label: "Overview", icon: Layers },
        { id: "team-performance", label: "Team", icon: Gauge },
        hasAttention ? { id: "attention", label: "Attention", icon: AlertTriangle, count: attentionCount } : null,
        { id: "company-health", label: "Companies", icon: Building2 },
        { id: "deal-ledgers", label: "Deals", icon: Target },
      ].filter((x): x is NavItem => x !== null),
    [hasAttention, attentionCount]
  );

  if (exec.isLoading) return <BrandLoader fullScreen={false} label="Loading dashboard" />;
  if (exec.isError || !data)
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <p className="text-xl font-semibold text-foreground">Couldn&apos;t load the dashboard</p>
        <p className="mt-2 text-sm text-muted">Make sure the server is reachable, then refresh.</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl space-y-8 px-5 py-10 md:px-8 md:py-14">
        {/* ---- Masthead --------------------------------------------------- */}
        <motion.header
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          <div className="flex items-end justify-between gap-6">
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted tabular-nums">{todayStamp()}</p>
            <LedgerStrip companies={data.companies} />
          </div>

          <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-tight text-foreground md:text-[2.75rem]">
            {urgentCount > 0 ? (
              <>
                <span className="font-serif italic text-accent">{urgentCount}</span> deadline{urgentCount === 1 ? "" : "s"} overdue or due today
              </>
            ) : deadlines.length > 0 ? (
              <>
                <span className="font-serif italic text-accent">{deadlines.length}</span> deadline{deadlines.length === 1 ? "" : "s"} this week
              </>
            ) : (
              "Everything's on track"
            )}
          </h1>

          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Across {data.companies.length} companies.
            {stale.length > 0 && (
              <> Also, {stale.length} deal{stale.length === 1 ? "" : "s"} across the group haven&apos;t been touched in 14+ days.</>
            )}
          </p>

          <div className="border-t border-dashed border-border" />

          <AiSummaryStrip query={summary} />
        </motion.header>

        {/* ---- Tab switcher ----------------------------------------------- */}
        <QuickNav items={navItems} activeId={activeId} onSelect={setActiveId} />

        {/* ---- Tab content: one section at a time, crossfaded -------------- */}
        <AnimatePresence mode="wait">
          {activeId === "overview" && (
            <motion.section
              key="overview"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={tabFade}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-8"
            >
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <Stat icon={Layers} label="Deals" value={data.totals.deals} raw={data.totals.deals} />
                <Stat icon={TrendingUp} label="Active" value={data.totals.active} raw={data.totals.active} />
                <Stat icon={CheckCircle2} label="Closed won" value={data.totals.closedWon} raw={data.totals.closedWon} />
                <Stat
                  icon={TrendingDown}
                  label="Outstanding"
                  value={fmtCompact(data.totals.outstanding)}
                  raw={data.totals.outstanding}
                  flag={data.totals.outstanding > 0}
                />
              </div>

              <AttentionGlance
                deadlines={deadlines}
                staleGroups={staleGroups}
                flags={financialFlags}
                breakdown={attentionBreakdown}
              />

              {/* Accounting engine — FR-16–18. Hidden, not stubbed, until the
                  nightly snapshot job populates these fields. */}
              {hasAccounting && (
                <div>
                  <SectionHeader icon={Wallet} label="Accounting" aside="Group-wide, this period" />
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
                    <Stat
                      icon={Wallet}
                      label="Net profit"
                      value={fmtSigned(data.totals.netProfit!)}
                      raw={data.totals.netProfit!}
                      flag={data.totals.netProfit! < 0}
                    />
                    {typeof data.totals.burnRate === "number" && (
                      <Stat
                        icon={TrendingDown}
                        label="Burn rate"
                        value={fmtCompact(data.totals.burnRate)}
                        raw={data.totals.burnRate}
                        flag={data.totals.burnRate > 0}
                      />
                    )}
                    {typeof data.totals.investment === "number" && (
                      <Stat
                        icon={Layers}
                        label="Invested to date"
                        value={fmtCompact(data.totals.investment)}
                        raw={data.totals.investment}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Leads — FR-12: the one standing exception to Group Owner
                  scoping. Every lead, every business, always visible here. */}
              {hasLeads && (
                <div>
                  <SectionHeader icon={Users} label="Leads" aside={`${data.leads!.total} across the group`} />
                  <div className="grid grid-cols-3 gap-3 md:gap-4">
                    <Stat icon={Users} label="Public" value={data.leads!.public} raw={data.leads!.public} />
                    <Stat icon={Users} label="Private" value={data.leads!.private} raw={data.leads!.private} />
                    <Stat icon={CheckCircle2} label="Won this month" value={data.leads!.wonThisMonth} raw={data.leads!.wonThisMonth} />
                  </div>
                </div>
              )}
            </motion.section>
          )}

          {activeId === "team-performance" && (
            <motion.section
              key="team-performance"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={tabFade}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <SectionHeader icon={Gauge} label="Team performance" aside={kpiTotal > 0 ? `${kpiTotal} KPIs tracked` : undefined} />
              {kpiTotal === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted">
                  No staff KPIs set yet. Once your team adds targets, their standing shows up here.
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-background">
                    {data.kpiHealth.onTrack > 0 && (
                      <div style={{ width: `${(data.kpiHealth.onTrack / kpiTotal) * 100}%` }} className="bg-foreground/70" />
                    )}
                    {data.kpiHealth.atRisk > 0 && (
                      <div style={{ width: `${(data.kpiHealth.atRisk / kpiTotal) * 100}%` }} className="bg-accent/50" />
                    )}
                    {data.kpiHealth.offTrack > 0 && (
                      <div style={{ width: `${(data.kpiHealth.offTrack / kpiTotal) * 100}%` }} className="bg-accent" />
                    )}
                    {data.kpiHealth.noTarget > 0 && (
                      <div style={{ width: `${(data.kpiHealth.noTarget / kpiTotal) * 100}%` }} className="bg-border" />
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <KpiStat label="On track" value={data.kpiHealth.onTrack} dotClass="bg-foreground/70" />
                    <KpiStat label="At risk" value={data.kpiHealth.atRisk} dotClass="bg-accent/50" />
                    <KpiStat label="Off track" value={data.kpiHealth.offTrack} dotClass="bg-accent" />
                    <KpiStat label="No target set" value={data.kpiHealth.noTarget} dotClass="bg-border" />
                  </div>
                </div>
              )}
            </motion.section>
          )}

          {activeId === "attention" && hasAttention && (
            <motion.section
              key="attention"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={tabFade}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              <p className="text-xs text-muted">{attentionBreakdown}</p>
              <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
              {visibleDeadlines.length > 0 && (
                <div>
                  <SectionHeader
                    icon={Clock}
                    label="Deadlines"
                    cta={
                      deadlines.length > visibleDeadlines.length
                        ? { label: `View all ${deadlines.length}`, href: "/tasks" }
                        : undefined
                    }
                  />
                  <ul className="divide-y divide-dashed divide-border">
                    {visibleDeadlines.map((d) => {
                      const urgent = URGENCY_URGENT.includes(d.urgency);
                      return (
                        <li key={d.id}>
                          <Link
                            href={deadlineLink(d)}
                            className="group flex items-center gap-3 py-3 text-sm transition-colors hover:bg-surface/60"
                          >
                            <span
                              className={`h-full w-[3px] self-stretch rounded-full ${urgent ? "bg-accent" : "bg-border"}`}
                              aria-hidden
                            />
                            <Clock size={14} className={urgent ? "shrink-0 text-accent" : "shrink-0 text-muted"} />
                            <span className="min-w-0 flex-1 truncate text-foreground">{d.businessName}</span>
                            <span className={`shrink-0 text-xs font-medium tabular-nums ${urgent ? "text-accent" : "text-muted"}`}>
                              {urgencyLabel(d.urgency, d.daysUntil)}
                            </span>
                            <ChevronRight size={14} className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {visibleStaleGroups.length > 0 && (
                <div>
                  <SectionHeader
                    icon={AlertTriangle}
                    label="Gone quiet"
                    aside={
                      staleGroups.length > visibleStaleGroups.length
                        ? `+${staleGroups.length - visibleStaleGroups.length} more owners`
                        : undefined
                    }
                  />
                  <ul className="divide-y divide-dashed divide-border">
                    {visibleStaleGroups.map((g, i) => {
                      const href = PIPELINE_HREF[g.type];
                      const content = (
                        <div className="group flex items-center gap-3 py-3 text-sm transition-colors hover:bg-surface/60">
                          <span className="h-full w-[3px] self-stretch rounded-full bg-accent/60" aria-hidden />
                          <AlertTriangle size={14} className="shrink-0 text-accent" />
                          <span className="shrink-0 font-semibold tabular-nums text-accent">{g.maxDays}d+ silent</span>
                          <span className="min-w-0 flex-1 truncate text-muted">
                            {g.count} {g.type} deal{g.count === 1 ? "" : "s"}
                            {g.bdoName ? <> · {g.bdoName}</> : ""}
                          </span>
                          <ChevronRight size={14} className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      );
                      return (
                        <li key={i}>
                          {href ? (
                            <Link href={g.bdoName ? `${href}?bdo=${encodeURIComponent(g.bdoName)}` : href}>{content}</Link>
                          ) : (
                            content
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Renders only once /alerts actually returns flags — see the
                  FinancialFlag type note above. Nothing to configure here. */}
              {visibleFlags.length > 0 && (
                <div>
                  <SectionHeader
                    icon={Flag}
                    label="Financial flags"
                    aside={financialFlags.length > visibleFlags.length ? `+${financialFlags.length - visibleFlags.length} more` : undefined}
                  />
                  <ul className="divide-y divide-dashed divide-border">
                    {visibleFlags.map((f) => (
                      <li key={f.id} className="flex items-center gap-3 py-3 text-sm">
                        <span className="h-full w-[3px] self-stretch rounded-full bg-accent" aria-hidden />
                        <Flag size={14} className="shrink-0 text-accent" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-foreground">{f.businessName}</p>
                          <p className="truncate text-xs text-muted">{FLAG_LABEL[f.kind]}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              </div>
            </motion.section>
          )}

          {activeId === "company-health" && (
            <motion.section
              key="company-health"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={tabFade}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <SectionHeader icon={Building2} label="Company health" aside="The ledger, one entry per business" />
              <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dashed border-border">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">#</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Company</th>
                      <th className="hidden px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted sm:table-cell">Active</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">Received</th>
                      <th className="hidden px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted md:table-cell">Outstanding</th>
                      {activeCompanies.some((c) => typeof c.netProfit === "number") && (
                        <th className="hidden px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted lg:table-cell">Net profit</th>
                      )}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-border">
                    {activeCompanies.map((c, i) => {
                      const dormant = c.active === 0 && c.revenue.received === 0;
                      const netOutstanding = c.revenue.outstanding > c.revenue.received * 0.4 && c.revenue.outstanding > 0;
                      const showProfit = activeCompanies.some((row) => typeof row.netProfit === "number");
                      return (
                        <tr key={c.key} className={dormant ? "opacity-45" : ""}>
                          <td className="px-5 py-3.5 text-xs font-semibold tabular-nums text-muted/70">
                            {String(i + 1).padStart(2, "0")}
                          </td>
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
                            {netOutstanding ? (
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
                                <span className={c.netProfit < 0 ? "font-medium text-accent" : "text-foreground"}>
                                  {fmtSigned(c.netProfit)}
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-3.5">
                            <Link href={`/dashboard/${c.slug}`}>
                              <ChevronRight size={15} className="text-muted" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.section>
          )}

          {activeId === "deal-ledgers" && (
            <motion.section
              key="deal-ledgers"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={tabFade}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 gap-10 lg:grid-cols-2"
            >
              <DealList
                title="Top deals"
                icon={Target}
                rows={data.topDeals}
                amountLabel="Potential"
                emptyText="No deals yet."
              />
              <DealList
                title="Top risks"
                icon={ShieldAlert}
                rows={data.topRisks}
                amountLabel="At stake"
                risk
                emptyText="Nothing at risk right now."
              />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---- Subcomponents --------------------------------------------------------

function Stat({
  icon: Icon,
  label,
  value,
  raw,
  flag = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  raw: number;
  flag?: boolean;
}) {
  const empty = raw === 0 && !flag;
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
        className={`mt-2.5 text-2xl font-bold leading-none tracking-tight tabular-nums md:text-[1.75rem] ${
          flag ? "text-accent" : empty ? "text-muted" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function KpiStat({ label, value, dotClass }: { label: string; value: number; dotClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function DealList({
  title,
  icon,
  rows,
  amountLabel,
  risk,
  emptyText,
}: {
  title: string;
  icon: LucideIcon;
  rows: DealRow[];
  amountLabel: string;
  risk?: boolean;
  emptyText: string;
}) {
  return (
    <div>
      <SectionHeader icon={icon} label={title} aside={amountLabel} />
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted">{emptyText}</div>
      ) : (
        <ul className="divide-y divide-dashed divide-border rounded-2xl border border-border bg-surface">
          {rows.map((d, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-background/50">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{d.businessName}</p>
                <p className="truncate text-xs text-muted">{d.company}</p>
              </div>
              <Tag value={risk ? d.dealHealth : d.dealStage} />
              <span className="w-24 shrink-0 whitespace-nowrap text-right font-medium tabular-nums text-foreground">
                {fmt(d.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}