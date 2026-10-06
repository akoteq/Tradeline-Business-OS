"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, ArrowRight, CheckCircle2, AlertTriangle, Clock, Minus } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useCompanies } from "@/lib/companies";
import { KpiStatus, KPI_STATUS_STYLE, KPI_STATUS_LABEL, fmtKpiVal, PaceBar } from "@/components/kpi";

// ─── Types (mirror GET /dashboard/me) ───────────────────────────────────────
type TaskRow = { id: string; title: string; targetDate: string | null; status: string; priority: string };
type Overview = {
  person: { id: string; name: string; company: string; title: string | null };
  tasks: {
    open: number; overdue: number; dueThisMonth: number;
    completed: number; completedPrev: number;
    onTimeRate: number | null; onTimeRatePrev: number | null;
    dueSoon: TaskRow[]; overdueList: TaskRow[];
  };
  proposals: { sent: number; winRate: number | null; open: number };
  leads: { open: number; added: number; addedPrev: number; converted: number; followUpsDue: number };
  deals: {
    open: number; pipelineValue: number; received: number; won: number; wonPrev: number; stale: number;
    staleList: { id: string; name: string; daysIdle: number; health: string }[];
  };
};
type KpiRow = {
  definition: { id: string; metric: string; unit: string };
  current: number | null; target: number | null; attainment: number | null; expected: number | null; status: KpiStatus;
};
type Focus = { tone: "danger" | "warning"; text: string; href: string };

const ghs = (n: number) => "GHS " + Math.round(n).toLocaleString();

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function shortDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const { user } = useAuth();
  const { byKey } = useCompanies();
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const isCurrent = period === new Date().toISOString().slice(0, 7);

  const { data, isLoading, error } = useQuery<Overview>({
    queryKey: ["overview", period],
    queryFn: () => fetcher(`/dashboard/me?period=${period}`),
    enabled: !!user?.bdoId,
  });
  const { data: kpis } = useQuery<{ rows: KpiRow[] }>({
    queryKey: ["my-kpis", period, "me"],
    queryFn: () => fetcher(`/kpi-framework/my?period=${period}`),
    enabled: !!user?.bdoId,
  });

  if (user && !user.bdoId) {
    return (
      <Shell>
        <Header title="Your overview" period={period} setPeriod={setPeriod} />
        <Card><p className="text-sm text-muted py-6 text-center">Your login isn&apos;t linked to a staff profile yet, so there&apos;s nothing to show. Ask a Group Owner to link it in Team &amp; Access.</p></Card>
      </Shell>
    );
  }

  const first = (data?.person.name ?? user?.bdoName ?? "").trim().split(/\s+/)[0];
  const trackedKpis = (kpis?.rows ?? []).filter((r) => r.status !== "NO_TARGET");
  const kpiOrder: KpiStatus[] = ["OFF_TRACK", "AT_RISK", "STALE", "ON_TRACK", "ACHIEVED"];
  const kpiShown = [...trackedKpis].sort((a, b) => kpiOrder.indexOf(a.status) - kpiOrder.indexOf(b.status)).slice(0, 4);

  // What to work on, worst first. Only flags things the person can act on today.
  const focus: Focus[] = [];
  if (data) {
    const t = data.tasks, l = data.leads, d = data.deals;
    if (t.overdue) focus.push({ tone: "danger", text: `${t.overdue} task${t.overdue === 1 ? " is" : "s are"} overdue`, href: "/tasks" });
    const behind = trackedKpis.filter((k) => k.status === "OFF_TRACK").length;
    if (behind) focus.push({ tone: "danger", text: `${behind} KPI${behind === 1 ? " is" : "s are"} behind pace`, href: "/my-kpis" });
    if (l.followUpsDue) focus.push({ tone: "warning", text: `${l.followUpsDue} lead follow-up${l.followUpsDue === 1 ? " is" : "s are"} past due`, href: "/leads" });
    if (d.stale) focus.push({ tone: "warning", text: `${d.stale} deal${d.stale === 1 ? " hasn't" : "s haven't"} moved in 2+ weeks`, href: "#stale" });
    const stale = trackedKpis.filter((k) => k.status === "STALE").length;
    if (stale) focus.push({ tone: "warning", text: `${stale} KPI${stale === 1 ? " needs" : "s need"} an update`, href: "/my-kpis" });
    if (t.onTimeRate != null && t.onTimeRate < 70) focus.push({ tone: "warning", text: `Only ${t.onTimeRate}% of this month's tasks were finished on time`, href: "/tasks" });
  }

  return (
    <Shell>
      <Header
        title={isCurrent && first ? `${greeting()}, ${first}` : "Your overview"}
        subtitle={data ? [data.person.title, byKey[data.person.company]?.name ?? data.person.company].filter(Boolean).join(" · ") : undefined}
        period={period}
        setPeriod={setPeriod}
      />

      {isLoading ? (
        <Card><p className="text-sm text-muted py-8 text-center">Loading your overview…</p></Card>
      ) : error || !data ? (
        <Card><p className="text-sm text-muted py-8 text-center">Couldn&apos;t load your overview. Try again in a moment.</p></Card>
      ) : (
        <>
          {/* Focus */}
          <Card>
            <SectionTitle>{focus.length ? "Where to focus" : "You're on top of things"}</SectionTitle>
            {focus.length ? (
              <ul className="divide-y divide-border/70 -mx-1">
                {focus.map((f) => (
                  <li key={f.text}>
                    <Link href={f.href} className="flex items-center gap-3 px-1 py-2.5 group">
                      <AlertTriangle size={16} className={f.tone === "danger" ? "text-red-600 shrink-0" : "text-amber-600 shrink-0"} />
                      <span className="flex-1 text-sm text-foreground">{f.text}</span>
                      <ArrowRight size={14} className="text-muted group-hover:text-accent transition-colors" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted">
                <CheckCircle2 size={16} className="text-emerald-600" /> Nothing overdue, no stale deals, no KPIs behind. Keep it up.
              </p>
            )}
          </Card>

          {/* This month at a glance */}
          <div>
            <SectionTitle>{periodLabel(period)} at a glance</SectionTitle>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              <Stat label="Tasks completed" value={String(data.tasks.completed)} sub={`of ${data.tasks.dueThisMonth} due this month`} now={data.tasks.completed} prev={data.tasks.completedPrev} />
              <Stat label="On-time rate" value={data.tasks.onTimeRate != null ? `${data.tasks.onTimeRate}%` : "—"} sub="tasks done by their due date" now={data.tasks.onTimeRate} prev={data.tasks.onTimeRatePrev} suffix="pts" />
              <Stat label="Leads added" value={String(data.leads.added)} sub={`${data.leads.open} open · ${data.leads.converted} won`} now={data.leads.added} prev={data.leads.addedPrev} />
              <Stat label="Deals won" value={String(data.deals.won)} sub={`${data.deals.open} still open`} now={data.deals.won} prev={data.deals.wonPrev} />
              <Stat label="Open pipeline" value={ghs(data.deals.pipelineValue)} sub={`${ghs(data.deals.received)} received to date`} />
              <Stat label="Proposal win rate" value={data.proposals.winRate != null ? `${data.proposals.winRate}%` : "—"} sub={`${data.proposals.sent} sent this month · ${data.proposals.open} awaiting`} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* KPIs */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle className="mb-0">My KPIs</SectionTitle>
                <Link href="/my-kpis" className="text-xs font-medium text-accent hover:opacity-80">Open →</Link>
              </div>
              {kpiShown.length ? (
                <ul className="space-y-3">
                  {kpiShown.map((k) => (
                    <li key={k.definition.id}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm text-foreground truncate">{k.definition.metric}</span>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${KPI_STATUS_STYLE[k.status]}`}>{KPI_STATUS_LABEL[k.status]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <PaceBar attainment={k.attainment} expected={k.expected} status={k.status} />
                        <span className="text-xs tabular-nums text-muted whitespace-nowrap">{fmtKpiVal(k.current, k.definition.unit)} / {fmtKpiVal(k.target, k.definition.unit)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No KPI targets for this month yet. <Link href="/my-kpis" className="text-accent hover:opacity-80">Set one →</Link></p>
              )}
            </Card>

            {/* Coming up */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle className="mb-0">{data.tasks.overdueList.length ? "Overdue & coming up" : "Coming up this week"}</SectionTitle>
                <Link href="/tasks" className="text-xs font-medium text-accent hover:opacity-80">All tasks →</Link>
              </div>
              {data.tasks.overdueList.length + data.tasks.dueSoon.length ? (
                <ul className="divide-y divide-border/70">
                  {[...data.tasks.overdueList.map((t) => ({ ...t, late: true })), ...data.tasks.dueSoon.map((t) => ({ ...t, late: false }))].slice(0, 6).map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2">
                      <Clock size={14} className={t.late ? "text-red-600 shrink-0" : "text-muted shrink-0"} />
                      <span className="flex-1 text-sm text-foreground truncate">{t.title}</span>
                      <span className={`text-xs tabular-nums whitespace-nowrap ${t.late ? "text-red-600 font-medium" : "text-muted"}`}>{t.late ? "Overdue · " : ""}{shortDate(t.targetDate)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nothing due in the next 7 days.</p>
              )}
            </Card>
          </div>

          {data.deals.staleList.length > 0 && (
            <Card id="stale">
              <SectionTitle>Deals that need a nudge</SectionTitle>
              <ul className="divide-y divide-border/70">
                {data.deals.staleList.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1 text-sm text-foreground truncate">{d.name}</span>
                    <span className="text-xs text-muted whitespace-nowrap">{d.daysIdle} days without an update</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </Shell>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">{children}</div>;
}

function Header({ title, subtitle, period, setPeriod }: { title: string; subtitle?: string; period: string; setPeriod: (p: string) => void }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-3">
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">Overview</p>
        <h1 className="font-serif text-2xl md:text-3xl text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      <input
        type="month"
        value={period}
        onChange={(e) => e.target.value && setPeriod(e.target.value)}
        className="text-sm bg-background border border-border rounded-lg px-2 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </div>
  );
}

function Card({ children, id }: { children: React.ReactNode; id?: string }) {
  return <section id={id} className="rounded-xl border border-border bg-surface p-4 md:p-5">{children}</section>;
}

function SectionTitle({ children, className = "mb-3" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-[11px] font-semibold uppercase tracking-widest text-muted ${className}`}>{children}</h2>;
}

// A stat tile with an optional change versus last month.
function Stat({ label, value, sub, now, prev, suffix }: {
  label: string; value: string; sub?: string; now?: number | null; prev?: number | null; suffix?: string;
}) {
  const diff = now != null && prev != null ? now - prev : null;
  // Equal-height tiles: label and value up top, the comparison pinned to the bottom edge.
  return (
    <div className="h-full rounded-xl border border-border bg-surface px-4 py-4 md:px-5 md:py-5 flex flex-col">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-3 text-2xl md:text-[28px] leading-none font-semibold text-foreground tabular-nums break-words">{value}</div>
      {sub && <div className="mt-2 text-xs leading-relaxed text-muted">{sub}</div>}
      {diff != null && (
        <div className="mt-auto pt-4">
          <div className={`pt-3 border-t border-border/70 flex items-center gap-1 text-xs font-medium ${diff > 0 ? "text-emerald-700" : diff < 0 ? "text-red-600" : "text-muted"}`}>
            {diff > 0 ? <ArrowUpRight size={13} /> : diff < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
            {diff === 0 ? "Same as last month" : `${diff > 0 ? "+" : ""}${diff}${suffix ? ` ${suffix}` : ""} vs last month`}
          </div>
        </div>
      )}
    </div>
  );
}
