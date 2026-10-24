"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Plus, Trash2, ChevronLeft, ChevronDown, Search, Filter, ArrowUpDown, MoreVertical,
  Target, Check, AlertTriangle, AlertCircle, CalendarDays, ArrowUp, ArrowDown, X, Ban, AlarmClock, ListTodo,
} from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isManager } from "@/lib/auth";
import { useCompanies } from "@/lib/companies";
import {
  KpiStatus, KpiRow, KPI_STATUS_LIST, KPI_STATUS_STYLE, KPI_STATUS_LABEL, KPI_STATUS_HINT,
  fmtKpiVal, PaceBar, AutoTag, Tag, StatusPill, WorkChip, KpiSheet, KpiDetailSheet, windowLabel, daysLeftIn,
  type ParentOpt, fitsUnder, ShareHint, FREQ_WORD,
} from "@/components/kpi";

// ─── Types ──────────────────────────────────────────────────────────────────
type Row = KpiRow & { kind: "PERSONAL" | "STANDARD" | "ACCOUNTABLE"; canManage: boolean; canSetTarget: boolean };
type MyKpis = { owner: { id: string; name: string; company: string }; rows: Row[] };
type AutoKey = { key: string; label: string; unit: string; kind: string; personal: boolean };
type Bdo = { id: string; name: string; company: string };
type TeamRow = {
  person: { id: string; name: string; company: string; title: string | null };
  counts: Partial<Record<KpiStatus, number>>; personalCount: number; tracked: number; achievement: number | null;
  kpis: { id: string; metric: string; unit: string; status: KpiStatus; current: number | null; target: number | null; attainment: number | null; expected: number | null }[];
  work: { open: number; overdue: number; blocked: number };
};

const UNIT_CHOICES = [["COUNT", "Number"], ["CURRENCY", "GHS"], ["PERCENT", "%"]] as const;

const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-60";
const selectClass =
  "text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40";
const btnSecondary = "px-4 py-2 text-sm text-foreground rounded-lg border border-border hover:bg-primary/5 transition-colors disabled:opacity-50";
const btnPrimary = "px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity";
const btnGhost = "px-3 py-2 text-sm text-muted hover:text-foreground transition-colors";

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

// "YYYY-MM" in the user's local time (toISOString would be UTC and can land on the wrong month).
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function prevPeriod(period: string) {
  const [y, m] = period.split("-").map(Number);
  return monthKey(new Date(y, m - 2, 1));
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted block mb-1">{children}</label>;
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-lg">{message}</p>;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden text-sm">
      {options.map(([key, label], i) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={clsx(
            "flex-1 px-3 py-2 transition-colors",
            i > 0 && "border-l border-border",
            value === key ? "bg-primary text-accent-foreground" : "bg-background text-foreground/70 hover:bg-primary/5",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Select with a custom chevron so it matches the rest of the toolbar.
function SelectField({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...rest} className={clsx(selectClass, "appearance-none pr-8 w-full", className)}>{children}</select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

// Closes a popover when Escape is pressed.
function useEscape(active: boolean, close: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close]);
}

// ─── Page ───────────────────────────────────────────────────────────────────
// view: "team" (managers' overview), "me", or a staff profile id.
export default function MyKpisPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { byKey } = useCompanies();
  const companyName = (k: string) => (k === "GROUP" ? "Group" : byKey[k]?.name ?? k);
  // Mirrors KPI_ASSIGNER_ROLES in server/src/routes/kpiFramework.ts: Group Owner or Business CEO.
  const canAssign = isManager(user);
  const hasProfile = !!user?.bdoId;

  const [period, setPeriod] = useState(() => monthKey(new Date()));
  const [view, setView] = useState<string>(""); // "" = default for the role
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const [openKpi, setOpenKpi] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const current = view || (canAssign ? "team" : "me");
  const isTeam = current === "team";
  const personId = isTeam || current === "me" ? null : current;
  const viewingSomeoneElse = !!personId && personId !== user?.bdoId;
  // Staff whose login has no staff profile have nothing to track yet.
  const unlinked = !isTeam && !personId && !hasProfile;

  const go = (v: string) => { setCreating(false); setView(v); };

  const { data: people = [] } = useQuery<Bdo[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
    enabled: canAssign,
  });

  const qp = new URLSearchParams({ period });
  if (personId) qp.set("bdoId", personId);
  const { data, isLoading, error } = useQuery<MyKpis>({
    queryKey: ["my-kpis", period, personId ?? "me"],
    queryFn: () => fetcher(`/kpi-framework/my?${qp}`),
    enabled: !!user && !isTeam && !unlinked,
  });
  const rows = data?.rows ?? [];
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-kpis"] });
    qc.invalidateQueries({ queryKey: ["kpi-team"] });
    qc.invalidateQueries({ queryKey: ["kpi-detail"] });
  };

  const quickAdd = useMutation({
    mutationFn: (r: Row) => api.post("/kpi-framework/quick-update", { definitionId: r.definition.id, period, delta: 1, bdoId: data?.owner.id }),
    onSuccess: invalidate,
    onError: (err) => window.alert(apiError(err, "Couldn't update the KPI.")),
  });

  const counts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const title = isTeam ? "Team KPIs" : viewingSomeoneElse && data ? `${data.owner.name}'s KPIs` : "My KPIs";
  const canCreate = !isTeam && !!data;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">Performance</p>
          {canAssign && !isTeam && (
            <button onClick={() => go("team")} className="text-xs text-muted hover:text-accent transition-colors mb-1 inline-flex items-center gap-1">
              <ChevronLeft size={13} /> Team
            </button>
          )}
          <h1 className="font-serif text-3xl md:text-4xl text-foreground">{title}</h1>
          <p className="text-sm text-muted mt-1.5">
            {isTeam
              ? "Track targets, progress and the work behind them. People who need attention are listed first."
              : <>{periodLabel(period)} for recurring KPIs; fixed-date KPIs show their whole window. The tick on each bar is where you should be by today.</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canAssign && (
            <SelectField value={current} onChange={(e) => go(e.target.value)} className="min-w-[160px]">
              <option value="team">Whole team</option>
              {hasProfile && <option value="me">Me</option>}
              {people.filter((p) => p.id !== user?.bdoId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectField>
          )}
          <div className="relative">
            <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/70" />
            <input
              type="month"
              value={period}
              onChange={(e) => e.target.value && setPeriod(e.target.value)}
              className={clsx(
                selectClass, "relative pl-9 cursor-pointer",
                // Hide the browser's own icon but keep the whole field clickable.
                "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0",
                "[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full",
                "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
              )}
            />
          </div>
          {canCreate && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity">
              <Plus size={15} /> {viewingSomeoneElse ? "Assign KPI" : "New KPI"}
            </button>
          )}
        </div>
      </div>

      {isTeam ? (
        <TeamOverview
          period={period}
          onOpen={(id) => go(id)}
          onAssign={(id) => { setView(id); setCreating(true); }}
        />
      ) : (
        <>
          {rows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {KPI_STATUS_LIST.filter((s) => counts[s]).map((s) => (
                <span key={s} title={KPI_STATUS_HINT[s]} className={`px-2.5 py-1 rounded-full text-xs font-medium ${KPI_STATUS_STYLE[s]}`}>
                  {counts[s]} {KPI_STATUS_LABEL[s]}
                </span>
              ))}
            </div>
          )}

          {unlinked ? (
            <Empty text="Your login isn't linked to a staff profile yet, so there are no KPIs to track. Ask a Group Owner to link it in Team & Access." />
          ) : isLoading ? (
            <Empty text="Loading…" />
          ) : error ? (
            <Empty text={apiError(error, "Couldn't load KPIs.")} />
          ) : rows.length === 0 ? (
            <Empty text="No KPIs yet. Create one: a title, a target, and the company KPI it contributes to." action={<button onClick={() => setCreating(true)} className="mt-3 text-sm font-medium text-accent hover:underline">Create the first KPI</button>} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rows.map((r) => (
                <KpiCard
                  key={`${r.definition.id}-${r.kind}`}
                  row={r}
                  companyName={companyName}
                  onOpen={() => setOpenRow(r)}
                  onPlusOne={() => quickAdd.mutate(r)}
                  busy={quickAdd.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}

      {openRow && data && (
        <KpiDetailSheet
          kpiId={openRow.definition.id}
          period={period}
          bdoId={openRow.kind === "ACCOUNTABLE" ? null : data.owner.id}
          onClose={() => setOpenRow(null)}
          onChanged={invalidate}
          onOpen={(id) => { setOpenRow(null); setOpenKpi(id); }}
          companyName={companyName}
          extra={(row) => <TargetAndManage row={row} meta={openRow} period={period} bdoId={data.owner.id} onSaved={invalidate} onRemoved={() => { setOpenRow(null); invalidate(); }} />}
        />
      )}
      {openKpi && (
        <KpiDetailSheet kpiId={openKpi} period={period} onClose={() => setOpenKpi(null)} onOpen={setOpenKpi} onChanged={invalidate} companyName={companyName} />
      )}
      {creating && data && (
        <CreateSheet
          ownerId={data.owner.id}
          ownerCompany={data.owner.company}
          ownerName={viewingSomeoneElse ? data.owner.name : null}
          period={period}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); invalidate(); }}
        />
      )}
    </div>
  );
}

// ─── Team overview ──────────────────────────────────────────────────────────
// KPI statuses folded into three buckets for the team view. Not started, No target and Draft
// KPIs aren't judged, so they don't count either way.
type Bucket = "ON_TRACK" | "AT_RISK" | "BEHIND";
const BUCKET: Partial<Record<KpiStatus, Bucket>> = {
  ON_TRACK: "ON_TRACK", ACHIEVED: "ON_TRACK",
  AT_RISK: "AT_RISK", STALE: "AT_RISK",
  OFF_TRACK: "BEHIND", OVERDUE: "BEHIND",
};

type Tally = { onTrack: number; atRisk: number; behind: number; total: number };
function tally(counts: TeamRow["counts"]): Tally {
  const t: Tally = { onTrack: 0, atRisk: 0, behind: 0, total: 0 };
  for (const [status, n] of Object.entries(counts)) {
    const b = BUCKET[status as KpiStatus];
    const c = Number(n) || 0;
    if (!b || !c) continue;
    t.total += c;
    if (b === "ON_TRACK") t.onTrack += c;
    else if (b === "AT_RISK") t.atRisk += c;
    else t.behind += c;
  }
  return t;
}

function sumTeam(rows: TeamRow[] | undefined): Tally {
  return (rows ?? []).reduce((a, r) => {
    const t = tally(r.counts);
    a.onTrack += t.onTrack; a.atRisk += t.atRisk; a.behind += t.behind; a.total += t.total;
    return a;
  }, { onTrack: 0, atRisk: 0, behind: 0, total: 0 } as Tally);
}

// Average progress across everyone with a target (the server works out each person's).
function teamAchievement(rows: TeamRow[] | undefined) {
  const scored = (rows ?? []).filter((t) => t.achievement != null);
  return scored.length ? Math.round(scored.reduce((s, t) => s + (t.achievement ?? 0), 0) / scored.length) : null;
}

const relDelta = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);

type PersonStatus = Bucket | "NONE";
const PERSON_STATUS: Record<PersonStatus, { label: string; pill: string; bar: string; rank: number }> = {
  BEHIND: { label: "Behind", pill: "bg-red-500/10 text-red-700", bar: "bg-red-500", rank: 0 },
  AT_RISK: { label: "At Risk", pill: "bg-orange-500/10 text-orange-700", bar: "bg-orange-500", rank: 1 },
  NONE: { label: "No targets", pill: "bg-foreground/5 text-foreground/60", bar: "bg-foreground/20", rank: 2 },
  ON_TRACK: { label: "On Track", pill: "bg-emerald-500/10 text-emerald-700", bar: "bg-emerald-500", rank: 3 },
};

function personStatus(t: Tally, pct: number | null): PersonStatus {
  if (!t.total || pct == null) return "NONE";
  if (t.behind > 0 && t.behind / t.total >= 0.5) return "BEHIND";
  if (t.behind > 0 || t.atRisk > 0 || pct < 50) return "AT_RISK";
  return "ON_TRACK";
}

type Person = { row: TeamRow; t: Tally; pct: number | null; status: PersonStatus; companyName: string };

type SortKey = "attention" | "performance" | "name";
const SORT_LABEL: Record<SortKey, string> = { attention: "Needs attention", performance: "Performance", name: "Name" };
const STATUS_FILTERS = [
  ["ALL", "All"], ["ON_TRACK", "On track"], ["AT_RISK", "At risk"], ["BEHIND", "Behind"], ["NONE", "No targets"],
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number][0];

const TONE = {
  green: { solid: "bg-emerald-500", bar: "bg-emerald-500" },
  orange: { solid: "bg-orange-500", bar: "bg-orange-500" },
  red: { solid: "bg-red-500", bar: "bg-red-500" },
} as const;

function TeamOverview({ period, onOpen, onAssign }: { period: string; onOpen: (id: string) => void; onAssign: (id: string) => void }) {
  const { byKey } = useCompanies();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("attention");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [companyFilter, setCompanyFilter] = useState("");

  useEscape(sortOpen || filterOpen, () => { setSortOpen(false); setFilterOpen(false); });

  const { data: team = [], isLoading, error } = useQuery<TeamRow[]>({
    queryKey: ["kpi-team", period],
    queryFn: () => fetcher(`/kpi-framework/team?period=${period}`),
  });
  const { data: prev } = useQuery<TeamRow[]>({
    queryKey: ["kpi-team", prevPeriod(period)],
    queryFn: () => fetcher(`/kpi-framework/team?period=${prevPeriod(period)}`),
  });

  const people = useMemo<Person[]>(
    () => team.map((row) => {
      const t = tally(row.counts);
      const pct = row.achievement;
      return { row, t, pct, status: personStatus(t, pct), companyName: byKey[row.person.company]?.name ?? row.person.company };
    }),
    [team, byKey],
  );

  const companies = useMemo(() => {
    const seen = new Map<string, string>();
    people.forEach((p) => seen.set(p.row.person.company, p.companyName));
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [people]);

  // The server lists people who need attention first; "Needs attention" keeps that order within a status.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = people.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (companyFilter && p.row.person.company !== companyFilter) return false;
      if (!q) return true;
      return [p.row.person.name, p.row.person.title ?? "", p.companyName].some((s) => s.toLowerCase().includes(q));
    });
    const byName = (a: Person, b: Person) => a.row.person.name.localeCompare(b.row.person.name);
    return list.sort((a, b) => {
      if (sort === "name") return byName(a, b);
      if (sort === "performance") return (b.pct ?? -1) - (a.pct ?? -1) || byName(a, b);
      return PERSON_STATUS[a.status].rank - PERSON_STATUS[b.status].rank;
    });
  }, [people, query, statusFilter, companyFilter, sort]);

  if (isLoading) return <Empty text="Loading team…" />;
  if (error) return <Empty text={apiError(error, "Couldn't load the team.")} />;
  if (team.length === 0) return <Empty text="No staff profiles yet. Add people in Team & Access." />;

  const cur = sumTeam(team);
  const old = prev ? sumTeam(prev) : null;
  const curPct = teamAchievement(team);
  const oldPct = prev ? teamAchievement(prev) : null;
  const activeFilters = (statusFilter !== "ALL" ? 1 : 0) + (companyFilter ? 1 : 0);
  const share = (n: number) => (cur.total ? Math.round((n / cur.total) * 100) : 0);
  const work = team.reduce((w, t) => ({ open: w.open + t.work.open, overdue: w.overdue + t.work.overdue, blocked: w.blocked + t.work.blocked }), { open: 0, overdue: 0, blocked: 0 });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          tone="green" icon={<Target size={20} />} label="Target Achievement"
          value={curPct != null ? `${curPct}%` : "—"}
          sub={`${cur.onTrack} / ${cur.total} KPIs on track`}
          bar={curPct ?? 0}
          delta={curPct != null && oldPct != null ? curPct - oldPct : null} unit=" pts" goodWhenUp
        />
        <StatCard
          tone="green" icon={<Check size={20} />} label="On Track"
          value={String(cur.onTrack)} sub={`of ${cur.total} KPIs · includes achieved`} bar={share(cur.onTrack)}
          delta={old ? relDelta(cur.onTrack, old.onTrack) : null} unit="%" goodWhenUp
        />
        <StatCard
          tone="orange" icon={<AlertTriangle size={20} />} label="At Risk"
          value={String(cur.atRisk)} sub={`of ${cur.total} KPIs · includes stale`} bar={share(cur.atRisk)}
          delta={old ? relDelta(cur.atRisk, old.atRisk) : null} unit="%" goodWhenUp={false}
        />
        <StatCard
          tone="red" icon={<AlertCircle size={20} />} label="Behind / Overdue"
          value={String(cur.behind)} sub={`of ${cur.total} KPIs · ${work.overdue} task${work.overdue === 1 ? "" : "s"} overdue, ${work.blocked} blocked`} bar={share(cur.behind)}
          delta={old ? relDelta(cur.behind, old.behind) : null} unit="%" goodWhenUp={false}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface/60 p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team members…"
              className={clsx(inputClass, "pl-9 bg-surface")}
            />
          </div>

          <div className="relative">
            <button
              onClick={() => { setSortOpen((o) => !o); setFilterOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground hover:bg-primary/5 transition-colors"
            >
              <ArrowUpDown size={14} className="text-muted" />
              <span>Sort by: {SORT_LABEL[sort]}</span>
              <ChevronDown size={14} className="text-muted" />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border border-border bg-surface shadow-lg py-1 text-sm">
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => { setSort(k); setSortOpen(false); }}
                      className={clsx("w-full text-left px-3 py-2 hover:bg-primary/5 transition-colors", sort === k && "font-medium text-accent")}
                    >
                      {SORT_LABEL[k]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => { setFilterOpen((o) => !o); setSortOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground hover:bg-primary/5 transition-colors"
            >
              <Filter size={14} className="text-muted" />
              Filter
              {activeFilters > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-accent text-accent-foreground text-[10px] font-semibold">
                  {activeFilters}
                </span>
              )}
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-72 rounded-xl border border-border bg-surface shadow-lg p-3 space-y-3">
                  <div>
                    <Label>Status</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_FILTERS.map(([k, label]) => (
                        <button
                          key={k}
                          onClick={() => setStatusFilter(k)}
                          className={clsx(
                            "px-2.5 py-1 rounded-full text-xs border transition-colors",
                            statusFilter === k ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground/70 hover:border-accent/40",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {companies.length > 1 && (
                    <div>
                      <Label>Company</Label>
                      <SelectField value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
                        <option value="">All companies</option>
                        {companies.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                      </SelectField>
                    </div>
                  )}
                  {activeFilters > 0 && (
                    <button
                      onClick={() => { setStatusFilter("ALL"); setCompanyFilter(""); }}
                      className="text-xs text-muted hover:text-accent inline-flex items-center gap-1"
                    >
                      <X size={12} /> Clear filters
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <Empty text="No one matches those filters." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((p) => (
              <PersonCard key={p.row.person.id} p={p} onOpen={() => onOpen(p.row.person.id)} onAssign={() => onAssign(p.row.person.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ tone, icon, label, value, sub, bar, delta, unit, goodWhenUp }: {
  tone: keyof typeof TONE; icon: React.ReactNode; label: string; value: string; sub: string;
  bar: number; delta: number | null; unit: string; goodWhenUp: boolean;
}) {
  const t = TONE[tone];
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-start gap-3">
        <span className={clsx("h-11 w-11 shrink-0 rounded-full grid place-items-center text-white", t.solid)}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="flex items-end justify-between gap-2">
            <span className="text-3xl font-semibold text-foreground tabular-nums leading-tight">{value}</span>
            <Delta value={delta} unit={unit} goodWhenUp={goodWhenUp} />
          </div>
          <p className="text-xs text-muted tabular-nums">{sub}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
        <div className={clsx("h-full rounded-full transition-all", t.bar)} style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
      </div>
    </div>
  );
}

// Trend vs last month. Green = moving the right way, red = the wrong way.
function Delta({ value, unit, goodWhenUp }: { value: number | null; unit: string; goodWhenUp: boolean }) {
  if (value == null) return null;
  const good = value === 0 ? null : (value > 0) === goodWhenUp;
  return (
    <div className="text-right shrink-0 pb-0.5">
      <div className={clsx("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", good == null ? "text-muted" : good ? "text-emerald-600" : "text-red-600")}>
        {value > 0 && <ArrowUp size={12} />}
        {value < 0 && <ArrowDown size={12} />}
        {value > 0 ? "+" : ""}{value}{unit}
      </div>
      <div className="text-[10px] text-muted leading-tight">vs. last month</div>
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-slate-700", "bg-orange-500", "bg-violet-600", "bg-emerald-600",
  "bg-teal-600", "bg-indigo-500", "bg-amber-500", "bg-purple-600", "bg-sky-600", "bg-rose-500",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[1][0] : "")).toUpperCase() || "?";
}

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// One card per person: how they're doing, their worst KPIs, and the work behind them.
function PersonCard({ p, onOpen, onAssign }: { p: Person; onOpen: () => void; onAssign: () => void }) {
  const { person, kpis, work } = p.row;
  const st = PERSON_STATUS[p.status];
  const subtitle = [person.title, p.companyName].filter(Boolean).join(" · ");
  const hasTargets = p.status !== "NONE";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(); } }}
      className="text-left rounded-xl border border-border bg-surface p-3.5 flex flex-col gap-2.5 cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent/40"
    >
      <div className="flex items-start gap-3">
        <span className={clsx("h-11 w-11 shrink-0 rounded-full grid place-items-center text-white text-sm font-semibold", avatarColor(person.name))}>
          {initials(person.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {/* Wraps instead of truncating so long names stay readable. */}
            <div className="font-medium text-foreground leading-snug break-words min-w-0">{person.name}</div>
            <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
              {hasTargets && (
                <span className={clsx("px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap", st.pill)}>{st.label}</span>
              )}
              <CardMenu onView={onOpen} onAssign={onAssign} />
            </div>
          </div>
          <div className="text-xs text-muted truncate" title={subtitle}>{subtitle}</div>
        </div>
      </div>

      {hasTargets ? (
        <div>
          <div className="text-sm font-medium text-foreground">{p.t.total} KPI{p.t.total === 1 ? "" : "s"}</div>
          <div className="text-[11px] text-muted tabular-nums">
            {p.t.onTrack} on track · {p.t.atRisk} at risk · {p.t.behind} behind
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted">{kpis.length ? "No targets set yet" : "No KPIs yet"}</div>
      )}

      {kpis.length > 0 && (
        <ul className="space-y-1.5">
          {kpis.map((k) => (
            <li key={k.id} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-foreground">{k.metric}</span>
                <span className="tabular-nums text-muted whitespace-nowrap">{fmtKpiVal(k.current, k.unit)} / {fmtKpiVal(k.target, k.unit)}</span>
              </div>
              <PaceBar attainment={k.attainment} expected={k.expected} status={k.status} className="h-1 mt-1" />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1">
        <div className="flex-1 h-2 rounded-full bg-foreground/10 overflow-hidden" title="Average progress across their KPIs with a target">
          <div className={clsx("h-full rounded-full transition-all", st.bar)} style={{ width: `${Math.min(100, p.pct ?? 0)}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted w-9 text-right">{p.pct != null ? `${p.pct}%` : "—"}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1"><ListTodo size={12} />{work.open} open</span>
        {work.overdue > 0 && <span className="inline-flex items-center gap-1 text-red-700"><AlarmClock size={12} />{work.overdue} overdue</span>}
        {work.blocked > 0 && <span className="inline-flex items-center gap-1 text-amber-700"><Ban size={12} />{work.blocked} blocked</span>}
      </div>
    </div>
  );
}

function CardMenu({ onView, onAssign }: { onView: () => void; onAssign: () => void }) {
  const [open, setOpen] = useState(false);
  useEscape(open, () => setOpen(false));
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        aria-label="More actions"
        onClick={() => setOpen((o) => !o)}
        className="p-1 rounded-md text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-border bg-surface shadow-lg py-1 text-sm">
            <button onClick={() => { setOpen(false); onView(); }} className="w-full text-left px-3 py-2 hover:bg-primary/5 transition-colors">View KPIs</button>
            <button onClick={() => { setOpen(false); onAssign(); }} className="w-full text-left px-3 py-2 hover:bg-primary/5 transition-colors">Assign KPI</button>
          </div>
        </>
      )}
    </div>
  );
}

function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center">
      <p className="text-muted">{text}</p>
      {action}
    </div>
  );
}

function KpiCard({ row, onOpen, onPlusOne, busy, companyName }: { row: Row; onOpen: () => void; onPlusOne: () => void; busy: boolean; companyName: (k: string) => string }) {
  const { definition: d, current, target, status } = row;
  const isAuto = d.source === "AUTO";
  const locked = row.entry?.reviewStatus === "LOCKED";
  const left = daysLeftIn(row.window);
  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 text-left group">
          <div className="font-medium text-foreground leading-snug group-hover:text-accent">{d.metric}</div>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {isAuto && <AutoTag />}
            {d.assignedBy && <Tag>Assigned</Tag>}
            {row.kind === "STANDARD" && <Tag>Scorecard</Tag>}
            {row.kind === "ACCOUNTABLE" && <Tag title="A company KPI you are accountable for">Owner</Tag>}
            {!d.higherIsBetter && <Tag>Decrease</Tag>}
            {d.state === "DRAFT" && <Tag>Draft</Tag>}
          </div>
          {row.parent && <div className="text-[11px] text-muted mt-1 truncate">↳ part of {row.parent.metric} ({companyName(row.parent.company)})</div>}
        </button>
        <StatusPill status={status} className="shrink-0" />
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold text-foreground tabular-nums">{fmtKpiVal(current, d.unit)}</span>
        <span className="text-sm text-muted tabular-nums">/ {fmtKpiVal(target, d.unit)}</span>
      </div>

      <div className="flex items-center gap-2">
        <PaceBar attainment={row.attainment} expected={row.expected} status={status} className="h-2" />
        <span className="text-xs tabular-nums text-muted w-9 text-right">{row.attainment != null ? `${row.attainment}%` : "—"}</span>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span>{windowLabel(row.window, d.frequency)}{left != null && ` · ${left} day${left === 1 ? "" : "s"} left`}</span>
        <WorkChip work={row.work} />
      </div>

      <div className="flex items-center gap-2 mt-auto pt-1">
        {!isAuto && row.aggregation === "SUM" && d.unit === "COUNT" && !locked && d.state !== "DRAFT" && (
          <button onClick={onPlusOne} disabled={busy} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-foreground hover:border-accent hover:text-accent transition-colors disabled:opacity-50">
            +1
          </button>
        )}
        <button onClick={onOpen} className="flex-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary/5 text-foreground hover:bg-primary/10 transition-colors">
          {isAuto ? "Details" : "Log result"}
        </button>
      </div>
    </div>
  );
}

// Inside the detail sheet: the target (for whoever manages the KPI) and removing a personal KPI.
function TargetAndManage({ row, meta, period, bdoId, onSaved, onRemoved }: { row: KpiRow; meta: Row; period: string; bdoId: string; onSaved: () => void; onRemoved: () => void }) {
  const [target, setTarget] = useState(row.target != null ? String(row.target) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!meta.canSetTarget && !meta.canManage) return null;
  const save = async () => {
    setBusy(true); setError("");
    try {
      await api.post("/kpi-framework/quick-update", { definitionId: row.definition.id, period, target, bdoId: meta.kind === "ACCOUNTABLE" ? undefined : bdoId });
      onSaved();
    } catch (err) { setError(apiError(err, "Couldn't save the target.")); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Remove "${row.definition.metric}"? Its history is kept.`)) return;
    try { await api.delete(`/kpi-framework/my/${row.definition.id}`); onRemoved(); }
    catch (err) { setError(apiError(err, "Couldn't remove it.")); }
  };
  return (
    <div className="rounded-xl border border-border p-3 space-y-2">
      {meta.canSetTarget && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label>{row.window.windowed ? "Target for the window" : `Target for ${windowLabel(row.window, row.definition.frequency)}`}</Label>
            <input type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} />
          </div>
          <button onClick={save} disabled={busy} className={btnSecondary}>Save target</button>
        </div>
      )}
      {meta.canManage && meta.kind === "PERSONAL" && (
        <button onClick={remove} className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-600"><Trash2 size={12} /> Remove this KPI</button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Create: title, target, what it's part of, and the window ───────────────
// Same three-step flow as adding a KPI on the KPI framework.
const CREATE_STEPS = [
  { title: "What do you want to track?", subtitle: "Name it and pick how it's measured.", nudge: "Let's start" },
  { title: "What does it count toward?", subtitle: "How often it's tracked, and the bigger KPI it feeds.", nudge: "Halfway there" },
  { title: "What's the goal?", subtitle: "How much, and which way it should move.", nudge: "Almost done" },
] as const;

function CreateSheet({ ownerId, ownerCompany, ownerName, period, onClose, onSaved }: {
  ownerId: string; ownerCompany: string; ownerName: string | null; period: string; onClose: () => void; onSaved: () => void;
}) {
  const { data: autoKeys = [] } = useQuery<AutoKey[]>({ queryKey: ["kpi-auto-keys"], queryFn: () => fetcher("/kpi-framework/auto-keys") });
  const { data: parents = [] } = useQuery<ParentOpt[]>({ queryKey: ["kpi-parents", ownerCompany, "", period], queryFn: () => fetcher(`/kpi-framework/parents?company=${ownerCompany}&period=${period}`) });
  const otherFeeds = autoKeys.filter((k) => k.personal && k.kind !== "PERIOD");

  const [metric, setMetric] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState<string>("COUNT");
  const [direction, setDirection] = useState<"UP" | "DOWN">("UP");
  const [start, setStart] = useState("");
  const [autoKey, setAutoKey] = useState("");
  const [parentId, setParentId] = useState("");
  const [frequency, setFrequency] = useState<"WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL">("MONTHLY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Same unit, and tracked as often as this KPI or less often, so results roll up.
  const parentChoices = parents.filter((p) => p.unit === unit && fitsUnder(p, frequency));
  const parent = parents.find((p) => p.id === parentId);
  const pickFrequency = (f: typeof frequency) => { setFrequency(f); if (parent && !fitsUnder(parent, f)) setParentId(""); };
  const pickFeed = (key: string) => {
    const k = autoKeys.find((a) => a.key === key);
    setAutoKey(key);
    if (k) {
      setUnit(k.unit);
      setDirection("UP");
      if (!metric.trim()) setMetric(k.label.replace(/\s*\(.*\)$/, ""));
    }
  };

  const save = async () => {
    if (!metric.trim()) { setError("Give the KPI a title."); return; }
    if (target === "") { setError("Set a target."); return; }
    if (direction === "DOWN" && start === "") { setError("For a decrease, enter where it starts from."); return; }
    setBusy(true); setError("");
    try {
      await api.post("/kpi-framework/my", {
        metric, target, unit, period,
        higherIsBetter: direction === "UP",
        start: direction === "DOWN" ? start : null,
        source: autoKey ? "AUTO" : "MANUAL",
        autoKey: autoKey || null,
        ownerBdoId: ownerId,
        parentId: parentId || null,
        frequency,
      });
      onSaved();
    } catch (err) {
      setError(apiError(err, "Failed to create KPI."));
    } finally { setBusy(false); }
  };

  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [reached, setReached] = useState(0);
  const go = (to: number) => { setDir(to > step ? 1 : -1); setStep(to); setReached((r) => Math.max(r, to)); };
  const last = step === CREATE_STEPS.length - 1;
  const canContinue =
    step === 0 ? metric.trim() !== "" : true;
  const next = () => { if (canContinue) { setError(""); go(step + 1); } };
  const meta = CREATE_STEPS[step];
  const slide = reduce ? 0 : 24;

  return (
    <KpiSheet
      title={step === 0 && ownerName ? `Assign a KPI to ${ownerName}` : meta.title}
      subtitle={meta.subtitle}
      onClose={onClose}
      footer={
        <>
          {step === 0 ? <button onClick={onClose} className={btnSecondary}>Cancel</button> : <button onClick={() => go(step - 1)} className={btnGhost}>Back</button>}
          <button onClick={last ? save : next} disabled={last ? busy : !canContinue} className={btnPrimary}>
            {last ? (busy ? "Saving…" : ownerName ? "Assign" : "Create") : "Continue"}
          </button>
        </>
      }
    >
      <div>
        <div className="flex gap-1.5" role="list" aria-label="Progress">
          {CREATE_STEPS.map((s, i) => (
            <button
              key={s.title} type="button" role="listitem" disabled={i > reached || i === step}
              onClick={() => go(i)} aria-label={`Step ${i + 1}`} aria-current={i === step ? "step" : undefined}
              className="group flex-1 py-1.5 disabled:cursor-default"
            >
              <span className={clsx("block h-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-foreground/10 group-enabled:group-hover:bg-foreground/20")} />
            </button>
          ))}
        </div>
        <p className="text-xs text-muted mt-1">{step + 1} of {CREATE_STEPS.length} · {meta.nudge}</p>
      </div>

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={step} custom={dir} className="space-y-4"
          initial={{ opacity: 0, x: dir * slide }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -dir * slide }} transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {step === 0 && (
            <>
              <div>
                <Label>Title *</Label>
                <input
                  value={metric} onChange={(e) => setMetric(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") next(); }}
                  className={inputClass} placeholder="e.g. Revenue collected" autoFocus
                />
              </div>

              <div>
                <Label>Unit</Label>
                <Segmented value={unit as "COUNT"} options={UNIT_CHOICES} onChange={(v) => { setUnit(v); setParentId(""); }} />
              </div>

              {otherFeeds.length > 0 && (
                <div>
                  <Label>Or track a running total</Label>
                  <SelectField value={autoKey} onChange={(e) => (e.target.value ? pickFeed(e.target.value) : setAutoKey(""))}>
                    <option value="">Manual — I&apos;ll log results myself</option>
                    {otherFeeds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </SelectField>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Every</Label>
                <Segmented value={frequency} options={[["WEEKLY", "Week"], ["MONTHLY", "Month"], ["QUARTERLY", "Quarter"], ["ANNUAL", "Year"]] as const} onChange={pickFrequency} />
                <p className="text-[11px] text-muted">The target repeats each {FREQ_WORD[frequency]} until it is changed.</p>
              </div>

              <div>
                <Label>Part of <span className="text-muted/60">(the company or Group KPI this counts toward)</span></Label>
                <SelectField value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">— Not part of a bigger KPI —</option>
                  {parentChoices.map((p) => <option key={p.id} value={p.id}>{p.company === "GROUP" ? "Group" : p.company} · {p.metric}{p.targetValue != null ? ` (${p.targetValue.toLocaleString()}${p.startDate && p.endDate ? "" : ` a ${FREQ_WORD[p.frequency] ?? "period"}`})` : ""}</option>)}
                </SelectField>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label>Target * <span className="text-muted/60">(each {FREQ_WORD[frequency]})</span></Label>
                <input
                  type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); }} className={inputClass} autoFocus
                />
                <ShareHint parent={parent} frequency={frequency} onUse={(v) => setTarget(String(v))} />
              </div>

              {!autoKey && (
                <>
                  <div>
                    <Label>Direction</Label>
                    <Segmented value={direction} options={[["UP", "Increase"], ["DOWN", "Decrease"]] as const} onChange={setDirection} />
                  </div>
                  {direction === "DOWN" && (
                    <div>
                      <Label>Starting from *</Label>
                      <input type="number" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} placeholder="e.g. 4000" />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <ErrorNote message={error} />
    </KpiSheet>
  );
}
