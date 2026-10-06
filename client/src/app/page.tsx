"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isGroupOwner, isBusinessCeo } from "@/lib/auth";
import { useCompanies, companyHref } from "@/lib/companies";
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
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { BrandLoader } from "@/components/BrandLoader";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const tabFade = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
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
  company?: string;
  businessName: string;
  dealHealth: string;
  lastUpdated: string;
  daysSinceUpdate: number;
  bdo: { id: string; name: string } | null;
};

/**
 * FinancialFlag isn't returned by /alerts yet — your spec (FR-19) calls for
 * auto-flags on profit decline, discretionary spend spikes, and burn
 * acceleration, on top of the overdue-task flags already wired below.
 * Typed as optional so this compiles and renders nothing until the
 * accounting engine ships it — flip it required once the field is real.
 */
type FinancialFlag = {
  id: string;
  kind: "profit_decline" | "discretionary_spike" | "burn_acceleration";
  businessName: string;
  message: string;
};

type AlertsResponse = { deadlines: Deadline[]; stale: StaleDeal[]; flags?: FinancialFlag[] };

type CoSummary = {
  key: string; name: string; slug: string;
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

type ExecutiveSummary = { summary: string; generatedAt: string };

const fmt = (n: number) =>
  (n ?? 0).toLocaleString("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 });
const fmtCompact = (n: number) =>
  (n ?? 0).toLocaleString("en-GH", { style: "currency", currency: "GHS", notation: "compact", maximumFractionDigits: 1 });

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

/** Collapse individual stale deals into one line per (company, owner) — the signal
 * that matters is "this book has gone quiet," not each business name in it. */
function groupStale(stale: StaleDeal[]) {
  const groups = new Map<string, { type: StaleDeal["type"]; company: string; bdoName: string | null; count: number; maxDays: number }>();
  for (const d of stale) {
    const company = d.company ?? d.type;
    const key = `${company}|${d.bdo?.name ?? "—"}`;
    const g = groups.get(key);
    if (g) {
      g.count += 1;
      g.maxDays = Math.max(g.maxDays, d.daysSinceUpdate);
    } else {
      groups.set(key, { type: d.type, company, bdoName: d.bdo?.name ?? null, count: 1, maxDays: d.daysSinceUpdate });
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
}: {
  icon: LucideIcon;
  label: string;
  cta?: { label: string; href: string };
  aside?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Icon size={13} strokeWidth={2.25} />
        </span>
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
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

// ---- Quick nav (tab switcher, not a scroll anchor) -------------------------

type NavItem = { id: string; label: string; icon: LucideIcon };

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

// ---- AI summary ------------------------------------------------------------

function AiSummaryCard({ query }: { query: ReturnType<typeof useQuery<ExecutiveSummary>> }) {
  const { data, isLoading, isError, refetch, isFetching } = query;
  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Sparkles size={13} strokeWidth={2.25} />
          </span>
          <h2 className="text-sm font-semibold text-foreground">AI summary</h2>
        </div>
        <div className="flex shrink-0 items-center gap-3">
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

      {isLoading ? (
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-accent/10" />
          <div className="h-3 w-5/6 animate-pulse rounded-full bg-accent/10" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-accent/10" />
        </div>
      ) : isError || !data?.summary ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          No summary available right now — check back once today&apos;s numbers are in.
        </p>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-foreground/90">{data.summary}</p>
      )}
    </div>
  );
}

// ---- Page ---------------------------------------------------------------

// Home routes by role: the group dashboard is the Group Owner's view only (the API refuses it
// to everyone else). Business CEOs land on their company's dashboard, staff on their overview.
export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const { byKey } = useCompanies();
  const isOwner = isGroupOwner(user);
  const ownSlug = user?.bdoCompany ? byKey[user.bdoCompany]?.slug : undefined;

  useEffect(() => {
    if (!user || isOwner) return;
    if (isBusinessCeo(user) && ownSlug) router.replace(`/dashboard/${ownSlug}`);
    else if (!isBusinessCeo(user) || !user.bdoCompany) router.replace(user.bdoId ? "/overview" : "/tasks");
  }, [user, isOwner, ownSlug, router]);

  if (!isOwner) return <BrandLoader label="Loading" />;
  return <CEODashboard />;
}

function CEODashboard() {
  const { byKey } = useCompanies();
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

  const activeCompanies = useMemo(
    () => (data ? [...data.companies].sort((a, b) => b.active - a.active) : []),
    [data]
  );

  const kpiTotal = data
    ? data.kpiHealth.onTrack + data.kpiHealth.atRisk + data.kpiHealth.offTrack + data.kpiHealth.noTarget
    : 0;

  const hasAttention = deadlines.length > 0 || staleGroups.length > 0 || visibleFlags.length > 0;

  const navItems = useMemo<NavItem[]>(
    () =>
      [
        { id: "overview", label: "Overview", icon: Layers },
        { id: "team-performance", label: "Team", icon: Gauge },
        hasAttention ? { id: "attention", label: "Attention", icon: AlertTriangle } : null,
        { id: "company-health", label: "Companies", icon: Building2 },
        { id: "deal-ledgers", label: "Deals", icon: Target },
      ].filter((x): x is NavItem => x !== null),
    [hasAttention]
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
          <p className="text-[11px] uppercase tracking-[0.15em] text-muted tabular-nums">{todayStamp()}</p>

          <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-tight text-foreground md:text-[2.75rem]">
            {urgentCount > 0 ? (
              <>
                <span className="italic text-accent">{urgentCount}</span> deadline{urgentCount === 1 ? "" : "s"} overdue or due today
              </>
            ) : deadlines.length > 0 ? (
              <>
                <span className="italic text-accent">{deadlines.length}</span> deadline{deadlines.length === 1 ? "" : "s"} this week
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
        </motion.header>

        {/* ---- AI summary — always visible regardless of tab ------------------ */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        >
          <AiSummaryCard query={summary} />
        </motion.section>

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
              className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
            >
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
              className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3"
            >
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
                      const co = byKey[g.company];
                      const href = co ? companyHref(co) : PIPELINE_HREF[g.type];
                      const content = (
                        <div className="group flex items-center gap-3 py-3 text-sm transition-colors hover:bg-surface/60">
                          <span className="h-full w-[3px] self-stretch rounded-full bg-border" aria-hidden />
                          <AlertTriangle size={14} className="shrink-0 text-muted" />
                          <span className="min-w-0 flex-1 text-foreground">
                            {g.count} {co?.name ?? g.type} deal{g.count === 1 ? "" : "s"}
                            {g.bdoName ? <span className="text-muted"> · {g.bdoName}</span> : ""}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted">{g.maxDays}d+ silent</span>
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
              <SectionHeader icon={Building2} label="Company health" />
              <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dashed border-border">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Company</th>
                      <th className="hidden px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted sm:table-cell">Active</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">Received</th>
                      <th className="hidden px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted md:table-cell">Outstanding</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-border">
                    {activeCompanies.map((c) => {
                      const dormant = c.active === 0 && c.revenue.received === 0;
                      const netOutstanding = c.revenue.outstanding > c.revenue.received * 0.4 && c.revenue.outstanding > 0;
                      return (
                        <tr key={c.key} className={dormant ? "opacity-45" : ""}>
                          <td className="p-0">
                            <Link href={`/dashboard/${c.slug}`} className="flex items-center gap-2 px-5 py-3.5 text-foreground hover:text-accent">
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