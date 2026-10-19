"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { useAuth } from "@/components/AuthProvider";
import { accessLevel, isGroupOwner, isBusinessCeo, isManager, type AccessLevel } from "@/lib/auth";
import {
  KpiStatus, KPI_STATUS_LIST, KPI_STATUS_STYLE, KPI_STATUS_LABEL, KPI_STATUS_HINT,
  fmtKpiVal, PaceBar, AutoTag,
} from "@/components/kpi";
import {
  TrendingUp, Minus, Plus, Pencil, X, Settings2, Trash2,
  ChevronLeft, ChevronRight, ChevronDown, Lock, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown,
  MoreHorizontal, Calendar, Building2, Check, AlertTriangle, AlertCircle, Clock, CheckCircle2,
  Target, MinusCircle, CalendarDays, Database, ShieldCheck, Users, FileText, Percent, Gauge, BarChart3,
  type LucideIcon,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type Def = {
  id: string; metric: string; company: string; department: string | null; definition: string | null;
  unit: string; higherIsBetter: boolean; frequency: string;
  source: string; autoKey: string | null;
};
type AutoKey = { key: string; label: string; unit: string };
type Entry = {
  id: string; definitionId: string; period: string; current: number | null; target: number | null; start: number | null;
  priority: string; actionPlan: string | null; decisionRequired: string | null;
  executiveCommentary: string | null; dataSource: string | null; bdoId: string | null; company: string | null;
  reviewStatus: ReviewStatus;
};
type AuditLog = {
  id: string; action: string; field: string | null; previousValue: string | null; newValue: string | null;
  reviewStatus: string | null; actorEmail: string | null; actorRole: string | null; note: string | null; createdAt: string;
};

type Status = KpiStatus;
type ReviewStatus = "DRAFT" | "TARGET_SET" | "ACTUAL_SUBMITTED" | "VERIFIED" | "LOCKED";
type BoardRow = {
  definition: Def; entry: Entry | null;
  current: number | null; target: number | null; variance: number; attainment: number | null;
  expected: number | null; status: Status; trend: string;
};
type Dept = { department: string; count: number };
type BdoLite = { id: string; name: string; company: string };
type SortKey = "default" | "attain_asc" | "attain_desc" | "name";

const UNIT_OPTS = ["COUNT", "CURRENCY", "PERCENT", "SCORE", "DAYS", "HOURS"];
const FREQ_OPTS = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"];
const STATUS_LIST = KPI_STATUS_LIST;
const STATUS_STYLE = KPI_STATUS_STYLE;
const STATUS_LABEL = KPI_STATUS_LABEL;

const REVIEW_STYLE: Record<ReviewStatus, string> = {
  DRAFT: "bg-foreground/5 text-muted",
  TARGET_SET: "bg-sky-500/10 text-sky-700",
  ACTUAL_SUBMITTED: "bg-accent/10 text-accent",
  VERIFIED: "bg-emerald-500/10 text-emerald-700",
  LOCKED: "bg-primary text-accent-foreground",
};
const REVIEW_LABEL: Record<ReviewStatus, string> = {
  DRAFT: "Draft", TARGET_SET: "Target set", ACTUAL_SUBMITTED: "Submitted", VERIFIED: "Verified", LOCKED: "Locked",
};

// Mirrors TRANSITIONS in server/src/routes/kpiFramework.ts — the server is the authority,
// this only decides which buttons to show.
const MANAGERS: AccessLevel[] = ["GROUP_OWNER", "BUSINESS_CEO"];
const OWNERS: AccessLevel[] = ["GROUP_OWNER"];
const TRANSITIONS: { action: string; label: string; from: ReviewStatus[]; levels: AccessLevel[] | null }[] = [
  { action: "submit_target", label: "Submit target", from: ["DRAFT"], levels: null },
  { action: "submit_actual", label: "Submit actual", from: ["DRAFT", "TARGET_SET"], levels: null },
  { action: "verify", label: "Verify", from: ["ACTUAL_SUBMITTED"], levels: MANAGERS },
  { action: "lock", label: "Lock", from: ["VERIFIED"], levels: OWNERS },
  { action: "reopen", label: "Reopen", from: ["TARGET_SET", "ACTUAL_SUBMITTED", "VERIFIED", "LOCKED"], levels: OWNERS },
];

const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-60";
const selectClass =
  "text-sm bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40";

const fmtVal = fmtKpiVal;

// Summary-card look per status. Keys are matched to KPI_STATUS_LIST; anything unknown falls back to neutral.
const CARD_ORDER = ["BEHIND", "AT_RISK", "STALE", "ON_TRACK", "ACHIEVED", "NO_TARGET"];
type CardLook = { Icon: LucideIcon; card: string; icon: string; label: string };
const CARD_NEUTRAL: CardLook = {
  Icon: MinusCircle, card: "bg-surface border-border", icon: "bg-foreground/5 text-muted", label: "text-foreground/70",
};
const STATUS_CARD: Record<string, CardLook> = {
  BEHIND: { Icon: AlertCircle, card: "bg-red-50/70 border-red-100", icon: "bg-red-100 text-red-500", label: "text-red-600" },
  AT_RISK: { Icon: AlertTriangle, card: "bg-amber-50/70 border-amber-100", icon: "bg-amber-100 text-amber-600", label: "text-amber-600" },
  STALE: { Icon: Clock, card: "bg-surface border-border", icon: "bg-foreground/5 text-muted", label: "text-foreground/70" },
  ON_TRACK: { Icon: CheckCircle2, card: "bg-emerald-50/70 border-emerald-100", icon: "bg-emerald-100 text-emerald-600", label: "text-emerald-600" },
  ACHIEVED: { Icon: Target, card: "bg-sky-50/70 border-sky-100", icon: "bg-sky-100 text-sky-600", label: "text-sky-600" },
  NO_TARGET: CARD_NEUTRAL,
};
// Match a status to a card look by its key, or failing that by its label ("Behind" → BEHIND),
// so it still works if the server names a status differently (e.g. OFF_TRACK shown as "Behind").
const statusKey = (s: string) =>
  STATUS_CARD[s] ? s : ((STATUS_LABEL as Record<string, string>)[s] ?? s).toUpperCase().replace(/[\s-]+/g, "_");
const cardRank = (s: string) => { const i = CARD_ORDER.indexOf(statusKey(s)); return i === -1 ? 99 : i; };

const AVATAR_COLORS = [
  "bg-orange-600", "bg-indigo-600", "bg-emerald-600", "bg-rose-600", "bg-sky-600", "bg-amber-600", "bg-violet-600", "bg-teal-600",
];

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// Newest first: 3 months ahead, then 2 years back. The selected period is always included.
function buildMonthOptions(selected: string) {
  const now = new Date();
  const values: string[] = [];
  for (let i = -3; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    values.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  if (!values.includes(selected)) values.unshift(selected);
  return values.map((v) => ({ value: v, label: periodLabel(v) }));
}

function kpiIcon(def: Def): LucideIcon {
  const m = `${def.metric} ${def.department ?? ""}`.toLowerCase();
  if (/meeting|call|visit/.test(m)) return CalendarDays;
  if (/pipeline|deal|lead/.test(m)) return Database;
  if (/approval|compliance|risk/.test(m)) return ShieldCheck;
  if (/conversion|win rate/.test(m)) return Target;
  if (/productiv|team|staff|hiring/.test(m)) return Users;
  if (/proposal|submission|report|document/.test(m)) return FileText;
  if (/revenue|financ|cost|spend|profit|sales/.test(m) || def.unit === "CURRENCY") return TrendingUp;
  if (def.unit === "PERCENT") return Percent;
  if (def.unit === "DAYS" || def.unit === "HOURS") return Clock;
  if (def.unit === "SCORE") return Gauge;
  return BarChart3;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function TrendCell({ trend }: { trend: string }) {
  if (trend === "IMPROVING") return <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium"><ArrowUp size={14} /> Improving</span>;
  if (trend === "NEEDS_ATTENTION") return <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium"><ArrowDown size={14} /> Attention</span>;
  if (trend === "STABLE") return <span className="inline-flex items-center gap-1 text-muted text-xs font-medium"><Minus size={14} /> Stable</span>;
  return <span className="text-muted/50 text-xs">—</span>;
}

// ─── Floating menu (fixed-position so table overflow never clips it) ────────
function Menu({ width = 192, trigger, children }: {
  width?: number;
  trigger: (p: { toggle: () => void; open: boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || wrapRef.current?.contains(t)) return;
      setPos(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    const onMove = () => setPos(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [pos]);

  const toggle = () => {
    if (pos) { setPos(null); return; }
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width));
    const room = window.innerHeight - r.bottom;
    setPos(room < 260 ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 });
  };

  return (
    <>
      <span ref={wrapRef} className="inline-flex">{trigger({ toggle, open: !!pos })}</span>
      {pos && (
        <div
          ref={menuRef}
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width }}
          className="z-50 bg-surface border border-border rounded-xl shadow-lg py-1"
        >
          {children(close)}
        </div>
      )}
    </>
  );
}

function MenuItem({ icon, active, danger, onClick, children }: {
  icon?: ReactNode; active?: boolean; danger?: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
        danger ? "text-red-600 hover:bg-red-500/10" : "text-foreground hover:bg-primary/5",
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {active && <Check size={14} className="text-accent" />}
    </button>
  );
}

// ─── Company tabs with scroll arrows ────────────────────────────────────────
function CompanyTabs({ options, value, onChange }: {
  options: { key: string; name: string }[]; value: string; onChange: (key: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dx: number) => ref.current?.scrollBy({ left: dx, behavior: "smooth" });
  const arrow = "p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-primary/5 transition-colors shrink-0";
  return (
    <div className="flex items-center gap-1 bg-surface border border-border rounded-2xl shadow-sm px-2 py-2 min-w-0">
      <button onClick={() => scroll(-260)} className={arrow} aria-label="Scroll companies left"><ChevronLeft size={16} /></button>
      <div ref={ref} className="flex items-center gap-1 overflow-x-auto flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((c) => (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={clsx(
              "px-4 py-2 text-sm rounded-xl whitespace-nowrap transition-colors",
              value === c.key ? "bg-primary text-accent-foreground font-semibold shadow-sm" : "text-foreground/70 hover:bg-primary/5",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <button onClick={() => scroll(260)} className={arrow} aria-label="Scroll companies right"><ChevronRight size={16} /></button>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function KpiFrameworkPage() {
  const { user } = useAuth();
  const isAdmin = isGroupOwner(user);
  // A Business CEO runs their own company's KPIs — same tools as the Group Owner, one company.
  const ownCompany = isBusinessCeo(user) ? (user?.bdoCompany ?? null) : null;
  const canManage = isAdmin || !!ownCompany;
  const qc = useQueryClient();
  const { companies, byKey } = useCompanies();

  const PAGE_SIZE = 15;
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [pickedCompany, setCompany] = useState("GROUP");
  const company = ownCompany ?? pickedCompany;
  const [department, setDepartment] = useState<string>(""); // "" = all departments
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const [page, setPage] = useState(1);
  const [editRow, setEditRow] = useState<BoardRow | null>(null);
  const [showDefForm, setShowDefForm] = useState(false);
  const [editDef, setEditDef] = useState<Def | null>(null);

  // Company picker: Group + every active company (Group Owner); just their own (Business CEO).
  const companyOpts = ownCompany
    ? [{ key: ownCompany, name: byKey[ownCompany]?.name ?? ownCompany }]
    : [{ key: "GROUP", name: "Group" }, ...companies.map((c) => ({ key: c.key, name: c.name }))];

  // Departments that exist within the selected company (optional sub-filter).
  const { data: departments = [] } = useQuery<Dept[]>({
    queryKey: ["kpi-departments", company],
    queryFn: () => fetcher(`/kpi-framework/departments?company=${company}`),
    enabled: !!user,
  });

  // Owner names for the board (an entry only stores the BDO id). Managers only; falls back to "Unassigned".
  const { data: bdos = [] } = useQuery<BdoLite[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
    enabled: !!user && canManage,
    retry: false,
  });
  const bdoName: Record<string, string> = Object.fromEntries(bdos.map((b) => [b.id, b.name]));

  // Reset the department sub-filter whenever the company changes.
  useEffect(() => { setDepartment(""); }, [company]);

  const qp = new URLSearchParams({ period, company });
  if (department) qp.set("department", department);

  const { data: board = [], isLoading } = useQuery<BoardRow[]>({
    queryKey: ["kpi-board", company, department, period],
    queryFn: () => fetcher(`/kpi-framework/board?${qp}`),
    enabled: !!user,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["kpi-board"] });
  const refreshAll = () => { qc.invalidateQueries({ queryKey: ["kpi-departments"] }); invalidate(); };

  const deleteDef = useMutation({
    mutationFn: (id: string) => api.delete(`/kpi-framework/definitions/${id}`),
    onSuccess: refreshAll,
  });

  // One-tap +1 for manual count KPIs. Staff update their own KPIs from My KPIs instead.
  const canQuickAdd = (r: BoardRow) =>
    isManager(user) && r.definition.source !== "AUTO"
    && r.definition.unit === "COUNT" && r.entry?.reviewStatus !== "LOCKED";
  const quickAdd = useMutation({
    mutationFn: (r: BoardRow) => api.post("/kpi-framework/quick-update", {
      definitionId: r.definition.id, period, delta: 1, bdoId: r.entry?.bdoId ?? null,
    }),
    onSuccess: invalidate,
    onError: (err) => window.alert(apiError(err, "Couldn't update the KPI.")),
  });

  const counts = board.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );
  const scored = board.filter((r) => r.attainment != null);
  const avgAttainment = scored.length
    ? Math.round(scored.reduce((s, r) => s + (r.attainment ?? 0), 0) / scored.length)
    : null;

  // Status filter → search → sort.
  const q = search.trim().toLowerCase();
  const ownerOf = (r: BoardRow) => (r.entry?.bdoId ? bdoName[r.entry.bdoId] ?? null : null);
  const filtered = board.filter((r) =>
    (!statusFilter || r.status === statusFilter) &&
    (!q || [r.definition.metric, r.definition.department, r.definition.definition, ownerOf(r)]
      .some((v) => (v ?? "").toLowerCase().includes(q))),
  );
  const rows = [...filtered].sort((a, b) => {
    if (sort === "name") return a.definition.metric.localeCompare(b.definition.metric);
    if (sort === "attain_asc" || sort === "attain_desc") {
      const av = a.attainment, bv = b.attainment;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sort === "attain_asc" ? av - bv : bv - av;
    }
    return 0;
  });

  // Client-side pagination of the board.
  useEffect(() => { setPage(1); }, [company, department, period, statusFilter, search, sort]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = rows.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const orderedStatuses = [...STATUS_LIST].sort((a, b) => cardRank(a as string) - cardRank(b as string));
  const monthOptions = buildMonthOptions(period);
  const iconBtn = (active: boolean) => clsx(
    "p-2.5 rounded-xl border bg-surface transition-colors",
    active ? "border-accent text-accent" : "border-border text-muted hover:text-foreground hover:bg-primary/5",
  );

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.2em] mb-1">Performance</p>
          <h1 className="font-serif text-3xl md:text-5xl text-foreground tracking-tight">KPI Framework</h1>
          <p className="text-sm text-muted mt-2">
            {ownCompany && <>{byKey[ownCompany]?.name ?? ownCompany} · </>}Targets vs actuals for {periodLabel(period)}. Status is calculated against pace — the tick on each bar is where a KPI should be by today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="appearance-none bg-surface border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground shadow-sm min-w-[190px] focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            >
              {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
          {canManage && (
            <button
              onClick={() => setShowDefForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-accent text-accent-foreground rounded-xl shadow-sm hover:opacity-90 transition-opacity"
            >
              <Plus size={16} /> Add KPI
            </button>
          )}
        </div>
      </div>

      {/* Company tabs + department */}
      <div className="space-y-3">
        {!ownCompany && <CompanyTabs options={companyOpts} value={company} onChange={setCompany} />}
        {departments.length > 0 && (
          <div className="relative inline-block">
            <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="appearance-none bg-surface border border-border rounded-xl pl-10 pr-10 py-3 text-sm text-foreground shadow-sm min-w-[240px] focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            >
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d.department} value={d.department}>{d.department} ({d.count})</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
        )}
      </div>

      {/* Summary — click a status to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[1.35fr_repeat(6,minmax(0,1fr))] gap-3">
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-2xl bg-primary text-accent-foreground p-4 shadow-sm flex flex-col">
          <div className="flex items-center gap-2.5">
            <BarChart3 size={20} className="opacity-80" />
            <span className="text-sm font-medium opacity-90">Average Attainment</span>
          </div>
          <div className="text-4xl font-semibold tabular-nums mt-2">{avgAttainment != null ? `${avgAttainment}%` : "—"}</div>
          <div className="text-xs opacity-60 mt-0.5">
            {scored.length
              ? `Based on ${scored.length} of ${board.length} KPI${board.length === 1 ? "" : "s"} with a target set`
              : "No targets set yet"}
          </div>
          <div className="mt-auto pt-3">
            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, avgAttainment ?? 0)}%` }} />
            </div>
          </div>
        </div>
        {orderedStatuses.map((s) => {
          const active = statusFilter === s;
          const look = STATUS_CARD[statusKey(s as string)] ?? CARD_NEUTRAL;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(active ? "" : s)}
              title={KPI_STATUS_HINT[s]}
              className={clsx(
                "rounded-2xl border p-4 text-left transition-all shadow-sm",
                look.card,
                active ? "ring-2 ring-accent border-accent" : "hover:border-accent/40",
              )}
            >
              <div className="flex items-center gap-2">
                <span className={clsx("h-8 w-8 rounded-full grid place-items-center shrink-0", look.icon)}>
                  <look.Icon size={16} />
                </span>
                <span className={clsx("text-sm font-semibold truncate", look.label)}>{STATUS_LABEL[s]}</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tabular-nums mt-3">{counts[s] ?? 0}</div>
              <div className="text-xs text-muted mt-0.5 leading-snug">{KPI_STATUS_HINT[s]}</div>
            </button>
          );
        })}
      </div>

      {/* Board */}
      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-foreground">
              {rows.length} KPI{rows.length === 1 ? "" : "s"}
              {statusFilter && <span className="text-muted font-normal text-sm"> · {STATUS_LABEL[statusFilter]}</span>}
            </span>
            {statusFilter && (
              <button onClick={() => setStatusFilter("")} className="text-xs text-muted hover:text-accent transition-colors">
                Clear filter
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none sm:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search KPIs..."
                className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </div>
            <Menu
              trigger={({ toggle }) => (
                <button onClick={toggle} className={iconBtn(!!statusFilter)} title="Filter by status" aria-label="Filter by status"><Filter size={16} /></button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem active={!statusFilter} onClick={() => { setStatusFilter(""); close(); }}>All statuses</MenuItem>
                  {orderedStatuses.map((s) => (
                    <MenuItem key={s} active={statusFilter === s} onClick={() => { setStatusFilter(s); close(); }}>{STATUS_LABEL[s]}</MenuItem>
                  ))}
                </>
              )}
            </Menu>
            <Menu
              trigger={({ toggle }) => (
                <button onClick={toggle} className={iconBtn(sort !== "default")} title="Sort" aria-label="Sort"><ArrowUpDown size={16} /></button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem active={sort === "default"} onClick={() => { setSort("default"); close(); }}>Default order</MenuItem>
                  <MenuItem active={sort === "attain_asc"} onClick={() => { setSort("attain_asc"); close(); }}>Attainment: low → high</MenuItem>
                  <MenuItem active={sort === "attain_desc"} onClick={() => { setSort("attain_desc"); close(); }}>Attainment: high → low</MenuItem>
                  <MenuItem active={sort === "name"} onClick={() => { setSort("name"); close(); }}>Name A–Z</MenuItem>
                </>
              )}
            </Menu>
          </div>
        </div>

        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm min-w-[1040px]">
            <thead className="border-b border-border">
              <tr>
                {["KPI", "Owner / Department", "Actual", "Target", "Attainment", "Status", "Trend", "Review", "Actions"].map((h) => (
                  <th
                    key={h}
                    className={clsx(
                      "px-4 py-3 text-[10.5px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap",
                      h === "Actions" ? "text-right pr-5" : "text-left",
                      h === "KPI" && "pl-5",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <p className="text-muted">{board.length === 0 ? "No KPIs set up for this company yet." : "No KPIs match this filter."}</p>
                    {canManage && board.length === 0 && (
                      <button onClick={() => setShowDefForm(true)} className="mt-3 text-sm font-medium text-accent hover:underline">
                        Add the first KPI
                      </button>
                    )}
                  </td>
                </tr>
              ) : pageRows.map((r) => {
                const Icon = kpiIcon(r.definition);
                const owner = ownerOf(r);
                return (
                  <tr key={r.definition.id} className="hover:bg-primary/[0.03] transition-colors">
                    <td className="pl-5 pr-4 py-4">
                      <button onClick={() => setEditRow(r)} className="flex items-center gap-3 text-left group">
                        <span className="h-10 w-10 rounded-full bg-foreground/5 text-foreground/80 grid place-items-center shrink-0">
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="font-semibold text-foreground group-hover:text-accent transition-colors flex items-center gap-1.5">
                            {r.definition.metric}
                            {r.definition.source === "AUTO" && <AutoTag />}
                          </span>
                          <span className="block text-xs text-muted truncate max-w-[240px]">
                            {r.definition.definition || r.definition.frequency.toLowerCase()}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2.5">
                        {owner ? (
                          <span className={clsx("h-8 w-8 rounded-full grid place-items-center text-[11px] font-semibold text-white shrink-0", avatarColor(owner))}>
                            {initials(owner)}
                          </span>
                        ) : (
                          <span className="h-8 w-8 rounded-full grid place-items-center bg-foreground/5 text-muted shrink-0"><Users size={14} /></span>
                        )}
                        <div className="min-w-0">
                          <div className={clsx("text-[13px] font-medium truncate max-w-[160px]", owner ? "text-foreground" : "text-muted")}>{owner ?? "Unassigned"}</div>
                          <div className="text-xs text-muted truncate max-w-[160px]">{r.definition.department ?? "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium text-foreground tabular-nums whitespace-nowrap">{fmtVal(r.current, r.definition.unit)}</td>
                    <td className="px-4 py-4 text-foreground/80 tabular-nums whitespace-nowrap">{fmtVal(r.target, r.definition.unit)}</td>
                    <td className="px-4 py-4 min-w-[150px]">
                      {r.attainment != null ? (
                        <div className="w-36">
                          <div className="text-xs font-medium tabular-nums text-foreground mb-1">{r.attainment}%</div>
                          <div className="flex"><PaceBar attainment={r.attainment} expected={r.expected} status={r.status} /></div>
                        </div>
                      ) : <span className="text-muted/50">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      <span title={KPI_STATUS_HINT[r.status]} className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap"><TrendCell trend={r.attainment != null ? r.trend : ""} /></td>
                    <td className="px-4 py-4">
                      {r.entry ? <ReviewBadge value={r.entry.reviewStatus} /> : <span className="text-muted/50 text-xs">—</span>}
                    </td>
                    <td className="pl-4 pr-5 py-4">
                      <div className="flex items-center gap-0.5 justify-end">
                        {canQuickAdd(r) && (
                          <button
                            onClick={() => quickAdd.mutate(r)}
                            disabled={quickAdd.isPending}
                            title="Add 1 to the actual"
                            className="px-1.5 py-0.5 mr-1 rounded-md border border-border text-xs font-medium text-foreground hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                          >
                            +1
                          </button>
                        )}
                        <IconButton title="Enter target / actual" onClick={() => setEditRow(r)}><Pencil size={15} /></IconButton>
                        {canManage && (
                          <Menu
                            width={176}
                            trigger={({ toggle }) => (
                              <IconButton title="More actions" onClick={toggle}><MoreHorizontal size={16} /></IconButton>
                            )}
                          >
                            {(close) => (
                              <>
                                <MenuItem icon={<Settings2 size={14} />} onClick={() => { close(); setEditDef(r.definition); }}>Edit KPI</MenuItem>
                                <MenuItem
                                  icon={<Trash2 size={14} />}
                                  danger
                                  onClick={() => {
                                    close();
                                    if (window.confirm(`Delete KPI "${r.definition.metric}"? This removes it from the framework.`)) deleteDef.mutate(r.definition.id);
                                  }}
                                >
                                  Delete KPI
                                </MenuItem>
                              </>
                            )}
                          </Menu>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
            <span className="text-muted">
              {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, rows.length)} of {rows.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
                className="p-1.5 rounded-lg border border-border text-foreground hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed"
              ><ChevronLeft size={16} /></button>
              <span className="px-2 text-muted">Page {pageSafe} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe >= totalPages}
                className="p-1.5 rounded-lg border border-border text-foreground hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed"
              ><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {editRow && (
        <EntryModal
          row={editRow}
          period={period}
          company={company}
          role={user?.role ?? ""}
          onClose={() => setEditRow(null)}
          onSaved={invalidate}
        />
      )}
      {(showDefForm || editDef) && (
        <DefinitionModal
          editDef={editDef}
          departments={departments}
          companyOpts={companyOpts}
          defaultCompany={company}
          onClose={() => { setShowDefForm(false); setEditDef(null); }}
          onSaved={() => { setShowDefForm(false); setEditDef(null); refreshAll(); }}
        />
      )}
    </div>
  );
}

function ReviewBadge({ value }: { value: ReviewStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${REVIEW_STYLE[value] ?? REVIEW_STYLE.DRAFT}`}>
      {value === "LOCKED" && <Lock size={10} />}
      {REVIEW_LABEL[value] ?? value}
    </span>
  );
}

function IconButton({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        "p-1.5 rounded-lg text-muted transition-colors",
        danger ? "hover:text-red-600 hover:bg-red-500/10" : "hover:text-accent hover:bg-accent/10",
      )}
    >
      {children}
    </button>
  );
}

function Modal({ title, subtitle, onClose, footer, children, wide }: {
  title: React.ReactNode; subtitle?: string; onClose: () => void; footer: React.ReactNode; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className={clsx("bg-surface rounded-2xl shadow-xl border border-border w-full max-h-[90vh] flex flex-col", wide ? "max-w-lg" : "max-w-md")}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-serif text-lg text-foreground flex items-center gap-2">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors shrink-0"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">{children}</div>
        <div className="px-5 py-3 border-t border-border flex flex-wrap justify-end gap-2 shrink-0">{footer}</div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted block mb-1">{children}</label>;
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-lg">{message}</p>;
}

const btnSecondary = "px-4 py-2 text-sm text-foreground rounded-lg border border-border hover:bg-primary/5 transition-colors disabled:opacity-50";
const btnPrimary = "px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity";

// ─── Entry editor: set target; actual is typed for MANUAL, live for AUTO ───
function EntryModal({ row, period, company, role, onClose, onSaved }: {
  row: BoardRow; period: string; company: string; role: string; onClose: () => void; onSaved: () => void;
}) {
  const { definition, current } = row;
  const isAuto = definition.source === "AUTO";
  const [entry, setEntry] = useState<Entry | null>(row.entry);
  const [form, setForm] = useState({
    current: row.entry?.current != null ? String(row.entry.current) : "",
    target: row.entry?.target != null ? String(row.entry.target) : "",
    start: row.entry?.start != null ? String(row.entry.start) : "",
    actionPlan: row.entry?.actionPlan ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const review: ReviewStatus = entry?.reviewStatus ?? "DRAFT";
  const locked = review === "LOCKED";
  const actions = entry
    ? TRANSITIONS.filter((t) => t.from.includes(review) && (!t.levels || t.levels.includes(accessLevel(role))))
    : [];

  const { data: audit = [], refetch: refetchAudit } = useQuery<AuditLog[]>({
    queryKey: ["kpi-audit", entry?.id],
    queryFn: () => fetcher(`/kpi-framework/entries/${entry!.id}/audit`),
    enabled: !!entry,
  });

  const save = async () => {
    setBusy(true); setError("");
    const body = {
      definitionId: definition.id,
      period: `${period}-01`,
      // AUTO KPIs never store an actual — it's computed live.
      current: isAuto ? null : (form.current !== "" ? Number(form.current) : null),
      target: form.target !== "" ? Number(form.target) : null,
      start: form.start !== "" ? Number(form.start) : null,
      actionPlan: form.actionPlan || null,
      company,
      bdoId: entry?.bdoId ?? null,
    };
    try {
      const res = entry
        ? await api.put(`/kpi-framework/entries/${entry.id}`, body)
        : await api.post("/kpi-framework/entries", body);
      setEntry(res.data);
      onSaved();
      refetchAudit();
    } catch (err) {
      setError(apiError(err, "Failed to save."));
    } finally { setBusy(false); }
  };

  const transition = async (action: string) => {
    if (!entry) return;
    setBusy(true); setError("");
    try {
      const res = await api.post(`/kpi-framework/entries/${entry.id}/transition`, { action });
      setEntry(res.data);
      onSaved();
      refetchAudit();
    } catch (err) {
      setError(apiError(err, "Failed to update review status."));
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title={<>{definition.metric}{isAuto && <AutoTag />}</>}
      subtitle={[definition.department, periodLabel(period), definition.unit.toLowerCase()].filter(Boolean).join(" · ")}
      onClose={onClose}
      footer={
        <>
          {actions.map((t) => (
            <button key={t.action} onClick={() => transition(t.action)} disabled={busy} className={btnSecondary}>
              {t.label}
            </button>
          ))}
          <span className="flex-1" />
          <button onClick={onClose} className={btnSecondary}>Close</button>
          <button onClick={save} disabled={busy || locked} className={btnPrimary}>{busy ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <div className="flex items-center justify-between">
        <ReviewBadge value={review} />
        {!entry && <span className="text-[11px] text-muted">Save once to start the review workflow.</span>}
      </div>

      {definition.definition && (
        <p className="text-xs text-muted bg-background border border-border rounded-lg p-3 leading-relaxed">{definition.definition}</p>
      )}
      {locked && (
        <p className="text-xs text-foreground bg-foreground/5 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <Lock size={12} /> This scorecard is locked. An admin must reopen it before values can change.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Actual {isAuto && <span className="text-sky-700">(auto)</span>}</Label>
          {isAuto ? (
            <div className="w-full border border-sky-200 rounded-lg px-3 py-2 text-sm bg-sky-500/5 text-sky-800 tabular-nums">{fmtVal(current, definition.unit)}</div>
          ) : (
            <input type="number" value={form.current} onChange={(e) => set("current", e.target.value)} disabled={locked} className={inputClass} />
          )}
        </div>
        <div>
          <Label>Target</Label>
          <input type="number" value={form.target} onChange={(e) => set("target", e.target.value)} disabled={locked} className={inputClass} />
        </div>
        <div className="col-span-2">
          <Label>Start value <span className="text-muted/60">(optional — e.g. spend starting at 4,000 to cut to 2,500)</span></Label>
          <input type="number" value={form.start} onChange={(e) => set("start", e.target.value)} disabled={locked} className={inputClass} placeholder="Measure progress from this value" />
        </div>
      </div>
      {isAuto && (
        <p className="text-[11px] text-sky-700 bg-sky-500/5 rounded-lg px-3 py-2">
          The actual is calculated live from your deals, leads, referrals & partnerships. Just set the target.
        </p>
      )}

      <div>
        <Label>Note</Label>
        <textarea
          value={form.actionPlan}
          onChange={(e) => set("actionPlan", e.target.value)}
          rows={2}
          className={inputClass + " resize-none"}
          placeholder="Optional action plan / context"
        />
      </div>

      <ErrorNote message={error} />

      {entry && audit.length > 0 && (
        <div className="pt-1">
          <p className="text-xs font-semibold text-muted mb-2">Change history</p>
          <ul className="space-y-1.5 max-h-40 overflow-y-auto border-l border-border pl-3">
            {audit.map((l) => (
              <li key={l.id} className="text-[11px] text-muted">
                <span className="text-muted/60 mr-2">{new Date(l.createdAt).toLocaleDateString()}</span>
                <span className="font-medium text-foreground">{l.action.replace(/_/g, " ")}</span>
                {l.field
                  ? <> — {l.field}: <span className="line-through">{l.previousValue || "—"}</span> → {l.newValue || "—"}</>
                  : l.previousValue && l.newValue && <> — {l.previousValue.replace(/_/g, " ").toLowerCase()} → {l.newValue.replace(/_/g, " ").toLowerCase()}</>}
                {l.actorEmail && <span className="text-muted/70"> · {l.actorEmail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

// ─── Add / Edit KPI definition (admin) ──────────────────────────────────────
function DefinitionModal({ editDef, departments, companyOpts, defaultCompany, onClose, onSaved }: {
  editDef?: Def | null; departments: Dept[]; companyOpts: { key: string; name: string }[]; defaultCompany: string; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!editDef;
  const { data: autoKeys = [] } = useQuery<AutoKey[]>({ queryKey: ["kpi-auto-keys"], queryFn: () => fetcher("/kpi-framework/auto-keys") });
  const [form, setForm] = useState({
    metric: editDef?.metric ?? "",
    company: editDef?.company ?? defaultCompany ?? "GROUP",
    department: editDef?.department ?? "",
    definition: editDef?.definition ?? "",
    unit: editDef?.unit ?? "COUNT",
    higherIsBetter: editDef?.higherIsBetter ?? true,
    frequency: editDef?.frequency ?? "MONTHLY",
    source: editDef?.source ?? "MANUAL",
    autoKey: editDef?.autoKey ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  // Picking an auto-feed also sets a sensible unit.
  const pickAutoKey = (key: string) => {
    const ak = autoKeys.find((a) => a.key === key);
    setForm((f) => ({ ...f, autoKey: key, unit: ak?.unit ?? f.unit }));
  };

  const save = async () => {
    if (!form.metric.trim()) { setError("Metric name is required."); return; }
    if (form.source === "AUTO" && !form.autoKey) { setError("Pick which data feeds this auto KPI."); return; }
    setSaving(true); setError("");
    const body = {
      metric: form.metric,
      company: form.company,
      department: form.department || null,
      definition: form.definition || null,
      unit: form.unit,
      higherIsBetter: form.higherIsBetter,
      frequency: form.frequency,
      source: form.source,
      autoKey: form.source === "AUTO" ? (form.autoKey || null) : null,
    };
    try {
      if (isEdit) await api.put(`/kpi-framework/definitions/${editDef!.id}`, body);
      else await api.post("/kpi-framework/definitions", body);
      onSaved();
    } catch (err) {
      setError(apiError(err, "Failed to save."));
    } finally { setSaving(false); }
  };

  return (
    <Modal
      wide
      title={isEdit ? "Edit KPI" : "Add KPI"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={save} disabled={saving || !form.metric.trim()} className={btnPrimary}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add KPI"}
          </button>
        </>
      }
    >
      <div>
        <Label>Metric name *</Label>
        <input value={form.metric} onChange={(e) => set("metric", e.target.value)} className={inputClass} placeholder="e.g. Advisory Revenue" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {companyOpts.length > 1 && (
        <div>
          <Label>Company *</Label>
          <select value={form.company} onChange={(e) => set("company", e.target.value)} className={selectClass + " w-full py-2"}>
            {companyOpts.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>
        )}
        <div>
          <Label>Department <span className="text-muted/60">(optional)</span></Label>
          <input value={form.department} onChange={(e) => set("department", e.target.value)} list="dept-list" className={inputClass} />
          <datalist id="dept-list">{departments.map((d) => <option key={d.department} value={d.department} />)}</datalist>
        </div>
        <div>
          <Label>Unit</Label>
          <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className={selectClass + " w-full py-2"}>
            {UNIT_OPTS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <Label>Frequency</Label>
          <select value={form.frequency} onChange={(e) => set("frequency", e.target.value)} className={selectClass + " w-full py-2"}>
            {FREQ_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Source: manual vs auto-computed */}
      <div>
        <Label>How is the actual measured?</Label>
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {[["MANUAL", "Entered manually"], ["AUTO", "Auto from data"]].map(([key, label], i) => (
            <button
              key={key}
              type="button"
              onClick={() => set("source", key)}
              className={clsx(
                "flex-1 px-3 py-2 transition-colors",
                i > 0 && "border-l border-border",
                form.source === key ? "bg-primary text-accent-foreground" : "bg-background text-foreground/70 hover:bg-primary/5",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {form.source === "AUTO" && (
        <div>
          <Label>Data feed *</Label>
          <select value={form.autoKey} onChange={(e) => pickAutoKey(e.target.value)} className={selectClass + " w-full py-2"}>
            <option value="">— Select a feed —</option>
            {autoKeys.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
          <p className="text-[11px] text-sky-700 mt-1">The actual updates automatically; you only set the target.</p>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" checked={form.higherIsBetter} onChange={(e) => set("higherIsBetter", e.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />
        <span>Higher is better <span className="text-muted text-xs">(uncheck for metrics like cycle time or overdue counts)</span></span>
      </label>
      <div>
        <Label>Description</Label>
        <textarea value={form.definition} onChange={(e) => set("definition", e.target.value)} rows={2} className={inputClass + " resize-none"} />
      </div>

      <ErrorNote message={error} />
    </Modal>
  );
}