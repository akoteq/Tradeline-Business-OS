"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { useAuth } from "@/components/AuthProvider";
import { accessLevel, isGroupOwner, isBusinessCeo, isManager, type AccessLevel } from "@/lib/auth";
import {
  KpiStatus, KpiRow, KpiDef, KPI_STATUS_LIST, KPI_STATUS_STYLE, KPI_STATUS_LABEL, KPI_STATUS_HINT,
  fmtKpiVal, PaceBar, AutoTag, Tag, StatusPill, WorkChip, KpiSheet, KpiDetailSheet, windowLabel,
  type ParentOpt, fitsUnder, ShareHint, FREQ_WORD,
} from "@/components/kpi";
import {
  TrendingUp, Minus, Plus, X, Settings2, Archive, Pencil,
  ChevronLeft, ChevronRight, ChevronDown, Lock, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown,
  MoreHorizontal, Calendar, Building2, Check, AlertTriangle, AlertCircle, Clock, CheckCircle2,
  Target, CalendarDays, Database, ShieldCheck, Users, FileText, Percent, Gauge, BarChart3,
  FolderTree, Tags, List, GitBranch, CalendarX,
  type LucideIcon,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type AutoKey = { key: string; label: string; unit: string; kind: string };
type Dept = { department: string; count: number };
type Category = { id: string; name: string; company: string; status: string; kpiCount: number };
type Bdo = { id: string; name: string; company: string };
type ReviewStatus = "DRAFT" | "TARGET_SET" | "ACTUAL_SUBMITTED" | "VERIFIED" | "LOCKED";
type SortKey = "default" | "attain_asc" | "attain_desc" | "name";
type View = "list" | "category" | "cascade";
type CascadeNode = { row: KpiRow; children: CascadeNode[] };

const UNIT_OPTS = ["COUNT", "CURRENCY", "PERCENT", "SCORE", "DAYS", "HOURS"];
const FREQ_OPTS = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"];
const AGG_LABEL: Record<string, string> = { SUM: "Total of results", LATEST: "Latest reading", AVERAGE: "Average of readings" };
const defaultAgg = (unit: string) => (unit === "COUNT" || unit === "CURRENCY" ? "SUM" : "LATEST");

const REVIEW_STYLE: Record<ReviewStatus, string> = {
  DRAFT: "bg-foreground/5 text-muted",
  TARGET_SET: "bg-sky-500/10 text-sky-700",
  ACTUAL_SUBMITTED: "bg-accent/10 text-accent",
  VERIFIED: "bg-emerald-500/10 text-emerald-700",
  LOCKED: "bg-primary text-accent-foreground",
};
const REVIEW_LABEL: Record<ReviewStatus, string> = {
  DRAFT: "Open", TARGET_SET: "Target set", ACTUAL_SUBMITTED: "Submitted", VERIFIED: "Verified", LOCKED: "Locked",
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
const btnSecondary = "px-4 py-2 text-sm text-foreground rounded-lg border border-border hover:bg-primary/5 transition-colors disabled:opacity-50";
const btnPrimary = "px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity";
const pickerClass =
  "appearance-none bg-surface border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent";

// Summary cards, worst first. The other statuses (Not started, No target, Draft) are in the filter menu.
const CARD_STATUSES: KpiStatus[] = ["OVERDUE", "OFF_TRACK", "AT_RISK", "STALE", "ON_TRACK", "ACHIEVED"];
type CardLook = { Icon: LucideIcon; card: string; icon: string; label: string };
const STATUS_CARD: Partial<Record<KpiStatus, CardLook>> = {
  OVERDUE: { Icon: CalendarX, card: "bg-red-50/70 border-red-200", icon: "bg-red-600 text-white", label: "text-red-700" },
  OFF_TRACK: { Icon: AlertCircle, card: "bg-red-50/70 border-red-100", icon: "bg-red-100 text-red-500", label: "text-red-600" },
  AT_RISK: { Icon: AlertTriangle, card: "bg-amber-50/70 border-amber-100", icon: "bg-amber-100 text-amber-600", label: "text-amber-600" },
  STALE: { Icon: Clock, card: "bg-surface border-border", icon: "bg-foreground/5 text-muted", label: "text-foreground/70" },
  ON_TRACK: { Icon: CheckCircle2, card: "bg-emerald-50/70 border-emerald-100", icon: "bg-emerald-100 text-emerald-600", label: "text-emerald-600" },
  ACHIEVED: { Icon: Target, card: "bg-sky-50/70 border-sky-100", icon: "bg-sky-100 text-sky-600", label: "text-sky-600" },
};

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

// The period a recurring KPI's target is set for: "Week of 19 Oct 2026", "October 2026",
// "Q4 2026" or "2026". A week is this week in the current month, else the month's last week
// (as the server works it out).
function periodLabelFor(period: string, frequency: string) {
  const [y, m] = period.split("-").map(Number);
  if (frequency === "WEEKLY") {
    const now = new Date();
    const day = now.getFullYear() === y && now.getMonth() === m - 1 ? now : new Date(y, m, 0);
    const monday = new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7));
    return `the week of ${monday.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  if (frequency === "ANNUAL") return String(y);
  if (frequency === "QUARTERLY") return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
  return periodLabel(period);
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

function kpiIcon(def: KpiDef): LucideIcon {
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

// Keeps the branches that hold a KPI of this company, with their parents for context.
function pruneCascade(nodes: CascadeNode[], company: string): CascadeNode[] {
  if (company === "GROUP") return nodes;
  return nodes.flatMap((n) => {
    const kids = pruneCascade(n.children, company);
    return n.row.definition.company === company || kids.length ? [{ ...n, children: n.row.definition.company === company ? n.children : kids }] : [];
  });
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

function Picker({ icon: Icon, value, onChange, children, className }: {
  icon: LucideIcon; value: string; onChange: (v: string) => void; children: ReactNode; className?: string;
}) {
  return (
    <div className="relative inline-block">
      <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className={clsx(pickerClass, className)}>
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
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
  const companyName = (k: string) => (k === "GROUP" ? "Group" : byKey[k]?.name ?? k);

  const PAGE_SIZE = 20;
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [pickedCompany, setCompany] = useState("GROUP");
  const company = ownCompany ?? pickedCompany;
  const [department, setDepartment] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<KpiStatus | "">("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const [view, setView] = useState<View>("list");
  const [page, setPage] = useState(1);
  const [openKpi, setOpenKpi] = useState<string | null>(null);
  const [showDefForm, setShowDefForm] = useState(false);
  const [editDef, setEditDef] = useState<KpiDef | null>(null);
  const [editTarget, setEditTarget] = useState<KpiRow | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Links like /kpi-framework?view=cascade&kpi=<id> (alerts, the assistant) open a view or a KPI.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const v = q.get("view");
    if (v === "cascade" || v === "category" || v === "list") setView(v);
    const id = q.get("kpi");
    if (id) setOpenKpi(id);
  }, []);

  const companyOpts = ownCompany
    ? [{ key: ownCompany, name: byKey[ownCompany]?.name ?? ownCompany }]
    : [{ key: "GROUP", name: "Group" }, ...companies.map((c) => ({ key: c.key, name: c.name }))];

  const { data: departments = [] } = useQuery<Dept[]>({
    queryKey: ["kpi-departments", company],
    queryFn: () => fetcher(`/kpi-framework/departments?company=${company}`),
    enabled: !!user,
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["kpi-categories", company],
    queryFn: () => fetcher(`/kpi-framework/categories?company=${company}`),
    enabled: !!user,
  });

  useEffect(() => { setDepartment(""); setCategoryId(""); }, [company]);

  const qp = new URLSearchParams({ period, company });
  if (department) qp.set("department", department);
  if (categoryId) qp.set("categoryId", categoryId);

  const { data: board = [], isLoading, error } = useQuery<KpiRow[]>({
    queryKey: ["kpi-board", company, department, categoryId, period],
    queryFn: () => fetcher(`/kpi-framework/board?${qp}`),
    enabled: !!user,
  });
  const { data: cascade = [], isLoading: cascadeLoading, error: cascadeError } = useQuery<CascadeNode[]>({
    queryKey: ["kpi-cascade", period],
    queryFn: () => fetcher(`/kpi-framework/cascade?period=${period}`),
    enabled: !!user && view === "cascade",
  });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["kpi-board"] }); qc.invalidateQueries({ queryKey: ["kpi-cascade"] }); };
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["kpi-departments"] });
    qc.invalidateQueries({ queryKey: ["kpi-categories"] });
    invalidate();
  };

  const archiveDef = useMutation({
    mutationFn: (id: string) => api.delete(`/kpi-framework/definitions/${id}`),
    onSuccess: refreshAll,
  });

  // One-tap +1 for manual totals.
  const canQuickAdd = (r: KpiRow) =>
    isManager(user) && r.definition.source !== "AUTO" && r.aggregation === "SUM"
    && r.definition.unit === "COUNT" && r.entry?.reviewStatus !== "LOCKED" && r.status !== "DRAFT";
  const quickAdd = useMutation({
    mutationFn: (r: KpiRow) => api.post("/kpi-framework/quick-update", { definitionId: r.definition.id, period, delta: 1 }),
    onSuccess: invalidate,
    onError: (err) => window.alert(apiError(err, "Couldn't update the KPI.")),
  });

  const counts = board.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  // Achievement covers every live KPI with a target, so a few good ones can't hide the rest.
  const judged = board.filter((r) => r.status !== "DRAFT" && r.status !== "NOT_STARTED");
  const scored = judged.filter((r) => r.attainment != null);
  const avgAttainment = scored.length ? Math.round(scored.reduce((s, r) => s + Math.min(100, r.attainment ?? 0), 0) / scored.length) : null;
  const withTarget = judged.filter((r) => r.target != null).length;

  // Status filter → search → sort.
  const q = search.trim().toLowerCase();
  const filtered = board.filter((r) =>
    (!statusFilter || r.status === statusFilter) &&
    (!q || [r.definition.metric, r.definition.department, r.definition.definition, r.owner?.name, r.category?.name, r.parent?.metric]
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

  useEffect(() => { setPage(1); }, [company, department, categoryId, period, statusFilter, search, sort, view]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = view === "category" ? rows : rows.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  // By-category view: one block per category (uncategorised last).
  const groups = view === "category"
    ? [...categories.map((c) => ({ key: c.id, name: c.name, rows: rows.filter((r) => r.category?.id === c.id) })),
       { key: "none", name: "No category", rows: rows.filter((r) => !r.category) }].filter((g) => g.rows.length)
    : [{ key: "all", name: "", rows: pageRows }];

  const tree = pruneCascade(cascade, company);
  const toggleBranch = (id: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const monthOptions = buildMonthOptions(period);
  const iconBtn = (active: boolean) => clsx(
    "p-2.5 rounded-xl border bg-surface transition-colors",
    active ? "border-accent text-accent" : "border-border text-muted hover:text-foreground hover:bg-primary/5",
  );
  const COLS = ["KPI", "Owner / Category", "Actual", "Target", "Attainment", "Work", "Status", "Trend", "Review", "Actions"];

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.2em] mb-1">Performance</p>
          <h1 className="font-serif text-3xl md:text-5xl text-foreground tracking-tight">KPI Framework</h1>
          <p className="text-sm text-muted mt-2 max-w-3xl">
            {ownCompany && <>{companyName(ownCompany)} · </>}Recurring KPIs show {periodLabel(period)}; KPIs with fixed dates show their whole window.
            Status is judged against pace — the tick on each bar is where a KPI should be by today.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Picker icon={Calendar} value={period} onChange={setPeriod} className="min-w-[190px]">
            {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Picker>
          {canManage && (
            <button onClick={() => setShowCategories(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border border-border bg-surface text-foreground shadow-sm hover:bg-primary/5 transition-colors">
              <Tags size={16} /> Categories
            </button>
          )}
          {canManage && (
            <button onClick={() => setShowDefForm(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-accent text-accent-foreground rounded-xl shadow-sm hover:opacity-90 transition-opacity">
              <Plus size={16} /> Add KPI
            </button>
          )}
        </div>
      </div>

      {/* Company tabs + category / department + view */}
      <div className="space-y-3">
        {!ownCompany && <CompanyTabs options={companyOpts} value={company} onChange={setCompany} />}
        <div className="flex flex-wrap items-center gap-3">
          {categories.length > 0 && view !== "cascade" && (
            <Picker icon={Tags} value={categoryId} onChange={setCategoryId} className="min-w-[220px]">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.kpiCount})</option>)}
              <option value="none">No category</option>
            </Picker>
          )}
          {departments.length > 0 && view !== "cascade" && (
            <Picker icon={Building2} value={department} onChange={setDepartment} className="min-w-[220px]">
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d.department} value={d.department}>{d.department} ({d.count})</option>)}
            </Picker>
          )}
          <div className="flex rounded-xl border border-border bg-surface shadow-sm overflow-hidden text-sm ml-auto">
            {([["list", "List", List], ["category", "By category", FolderTree], ["cascade", "Cascade", GitBranch]] as const).map(([v, label, Icon], i) => (
              <button
                key={v}
                onClick={() => setView(v)}
                title={v === "cascade" ? "Group → company → person: how each target is shared down the chain" : undefined}
                className={clsx("flex items-center gap-1.5 px-3.5 py-2.5 transition-colors", i > 0 && "border-l border-border", view === v ? "bg-primary text-accent-foreground font-medium" : "text-foreground/70 hover:bg-primary/5")}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary — click a status to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[1.35fr_repeat(6,minmax(0,1fr))] gap-3">
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-2xl bg-primary text-accent-foreground p-4 shadow-sm flex flex-col">
          <div className="flex items-center gap-2.5">
            <BarChart3 size={20} className="opacity-80" />
            <span className="text-sm font-medium opacity-90">Achievement</span>
          </div>
          <div className="text-4xl font-semibold tabular-nums mt-2">{avgAttainment != null ? `${avgAttainment}%` : "—"}</div>
          <div className="text-xs opacity-60 mt-0.5">
            {judged.length ? `${withTarget} of ${judged.length} live KPI${judged.length === 1 ? "" : "s"} have a target` : "No live KPIs yet"}
          </div>
          <div className="mt-auto pt-3">
            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, avgAttainment ?? 0)}%` }} />
            </div>
          </div>
        </div>
        {CARD_STATUSES.map((s) => {
          const active = statusFilter === s;
          const look = STATUS_CARD[s]!;
          return (
            <button
              key={s}
              onClick={() => { setStatusFilter(active ? "" : s); if (view === "cascade") setView("list"); }}
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
                <span className={clsx("text-sm font-semibold truncate", look.label)}>{KPI_STATUS_LABEL[s]}</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tabular-nums mt-3">{counts[s] ?? 0}</div>
              <div className="text-xs text-muted mt-0.5 leading-snug">{KPI_STATUS_HINT[s]}</div>
            </button>
          );
        })}
      </div>

      {view === "cascade" ? (
        <CascadeView
          tree={tree}
          isLoading={cascadeLoading}
          error={cascadeError}
          collapsed={collapsed}
          onToggle={toggleBranch}
          onOpen={setOpenKpi}
          companyName={companyName}
          scopeName={companyName(company)}
        />
      ) : (
        /* Board */
        <div className="rounded-2xl border border-border bg-surface shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-foreground">
                {rows.length} KPI{rows.length === 1 ? "" : "s"}
                {statusFilter && <span className="text-muted font-normal text-sm"> · {KPI_STATUS_LABEL[statusFilter]}</span>}
              </span>
              {statusFilter && (
                <button onClick={() => setStatusFilter("")} className="text-xs text-muted hover:text-accent transition-colors">Clear filter</button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search KPIs, owners, categories..."
                  className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </div>
              <Menu trigger={({ toggle }) => (
                <button onClick={toggle} className={iconBtn(!!statusFilter)} title="Filter by status" aria-label="Filter by status"><Filter size={16} /></button>
              )}>
                {(close) => (
                  <>
                    <MenuItem active={!statusFilter} onClick={() => { setStatusFilter(""); close(); }}>All statuses</MenuItem>
                    {KPI_STATUS_LIST.map((s) => (
                      <MenuItem key={s} active={statusFilter === s} onClick={() => { setStatusFilter(s); close(); }}>{KPI_STATUS_LABEL[s]}</MenuItem>
                    ))}
                  </>
                )}
              </Menu>
              <Menu trigger={({ toggle }) => (
                <button onClick={toggle} className={iconBtn(sort !== "default")} title="Sort" aria-label="Sort"><ArrowUpDown size={16} /></button>
              )}>
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
            <table className="w-full text-sm min-w-[1180px]">
              <thead className="border-b border-border">
                <tr>
                  {COLS.map((h) => (
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
                  <tr><td colSpan={COLS.length} className="px-4 py-10 text-center text-muted">Loading…</td></tr>
                ) : error ? (
                  <tr><td colSpan={COLS.length} className="px-4 py-10 text-center text-red-600">{apiError(error, "Couldn't load KPIs.")}</td></tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length} className="px-4 py-12 text-center">
                      <p className="text-muted">{board.length === 0 ? "No KPIs set up for this company yet." : "No KPIs match this filter."}</p>
                      {canManage && board.length === 0 && (
                        <button onClick={() => setShowDefForm(true)} className="mt-3 text-sm font-medium text-accent hover:underline">Add the first KPI</button>
                      )}
                    </td>
                  </tr>
                ) : groups.map((g) => (
                  <BoardGroup key={g.key} name={g.name} rows={g.rows} colSpan={COLS.length}>
                    {g.rows.map((r) => {
                      const Icon = kpiIcon(r.definition);
                      const owner = r.owner?.name ?? null;
                      return (
                        <tr key={r.definition.id} className="hover:bg-primary/[0.03] transition-colors">
                          <td className="pl-5 pr-4 py-4">
                            <button onClick={() => setOpenKpi(r.definition.id)} className="flex items-center gap-3 text-left group">
                              <span className="h-10 w-10 rounded-full bg-foreground/5 text-foreground/80 grid place-items-center shrink-0">
                                <Icon size={17} />
                              </span>
                              <span className="min-w-0">
                                <span className="font-semibold text-foreground group-hover:text-accent transition-colors flex items-center gap-1.5 flex-wrap">
                                  {r.definition.metric}
                                  {r.definition.source === "AUTO" && <AutoTag />}
                                  {r.definition.state === "DRAFT" && <Tag>Draft</Tag>}
                                  {r.children.count > 0 && <Tag title="KPIs under this one">{r.children.count} under</Tag>}
                                </span>
                                <span className="block text-xs text-muted truncate max-w-[280px]">
                                  {[r.parent ? `↳ ${r.parent.metric} (${companyName(r.parent.company)})` : null, windowLabel(r.window, r.definition.frequency)].filter(Boolean).join(" · ")}
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2.5">
                              {owner ? (
                                <span className={clsx("h-8 w-8 rounded-full grid place-items-center text-[11px] font-semibold text-white shrink-0", avatarColor(owner))}>{initials(owner)}</span>
                              ) : (
                                <span className="h-8 w-8 rounded-full grid place-items-center bg-foreground/5 text-muted shrink-0"><Users size={14} /></span>
                              )}
                              <div className="min-w-0">
                                <div className={clsx("text-[13px] font-medium truncate max-w-[160px]", owner ? "text-foreground" : "text-muted")}>{owner ?? "Unassigned"}</div>
                                <div className="text-xs text-muted truncate max-w-[160px]">{r.category?.name ?? r.definition.department ?? "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-medium text-foreground tabular-nums whitespace-nowrap">{fmtKpiVal(r.current, r.definition.unit)}</td>
                          <td className="px-4 py-4 text-foreground/80 tabular-nums whitespace-nowrap" title={r.targetCarried ? "Carried over from an earlier period" : undefined}>
                            {fmtKpiVal(r.target, r.definition.unit)}{r.targetCarried && <span className="text-muted/60">*</span>}
                          </td>
                          <td className="px-4 py-4 min-w-[150px]">
                            {r.attainment != null ? (
                              <div className="w-36">
                                <div className="text-xs font-medium tabular-nums text-foreground mb-1">{r.attainment}%</div>
                                <div className="flex"><PaceBar attainment={r.attainment} expected={r.expected} status={r.status} /></div>
                              </div>
                            ) : <span className="text-muted/50">—</span>}
                          </td>
                          <td className="px-4 py-4"><WorkChip work={r.work} /></td>
                          <td className="px-4 py-4"><StatusPill status={r.status} className="px-2.5 py-1" /></td>
                          <td className="px-4 py-4 whitespace-nowrap"><TrendCell trend={r.attainment != null ? r.trend : ""} /></td>
                          <td className="px-4 py-4">{r.entry ? <ReviewBadge value={r.entry.reviewStatus as ReviewStatus} /> : <span className="text-muted/50 text-xs">—</span>}</td>
                          <td className="pl-4 pr-5 py-4">
                            <div className="flex items-center gap-0.5 justify-end">
                              {canQuickAdd(r) && (
                                <button onClick={() => quickAdd.mutate(r)} disabled={quickAdd.isPending} title="Log +1"
                                  className="px-1.5 py-0.5 mr-1 rounded-md border border-border text-xs font-medium text-foreground hover:border-accent hover:text-accent transition-colors disabled:opacity-50">+1</button>
                              )}
                              <IconButton title="Open — results, work and the chain" onClick={() => setOpenKpi(r.definition.id)}><Pencil size={15} /></IconButton>
                              {canManage && (
                                <Menu width={210} trigger={({ toggle }) => (
                                  <IconButton title="More actions" onClick={toggle}><MoreHorizontal size={16} /></IconButton>
                                )}>
                                  {(close) => (
                                    <>
                                      {!r.window.windowed && (
                                        <MenuItem icon={<Target size={14} />} onClick={() => { close(); setEditTarget(r); }}>Target for {periodLabelFor(period, r.definition.frequency)}</MenuItem>
                                      )}
                                      <MenuItem icon={<Settings2 size={14} />} onClick={() => { close(); setEditDef(r.definition); }}>Edit KPI</MenuItem>
                                      <MenuItem
                                        icon={<Archive size={14} />}
                                        danger
                                        onClick={() => {
                                          close();
                                          if (window.confirm(`Archive KPI "${r.definition.metric}"? Its history is kept; KPIs under it are unlinked.`)) archiveDef.mutate(r.definition.id);
                                        }}
                                      >
                                        Archive KPI
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
                  </BoardGroup>
                ))}
              </tbody>
            </table>
          </div>
          {view === "list" && rows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
              <span className="text-muted">{(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, rows.length)} of {rows.length}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe <= 1} className="p-1.5 rounded-lg border border-border text-foreground hover:bg-primary/5 disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span className="px-2 text-muted">Page {pageSafe} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe >= totalPages} className="p-1.5 rounded-lg border border-border text-foreground hover:bg-primary/5 disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {openKpi && (
        <KpiDetailSheet
          kpiId={openKpi}
          period={period}
          onClose={() => setOpenKpi(null)}
          onChanged={invalidate}
          onOpen={setOpenKpi}
          companyName={companyName}
          extra={(row) => <ReviewPanel row={row} role={user?.role ?? ""} onChanged={() => { invalidate(); qc.invalidateQueries({ queryKey: ["kpi-detail"] }); }} />}
        />
      )}
      {editTarget && (
        <PeriodTargetSheet row={editTarget} period={period} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); invalidate(); }} />
      )}
      {(showDefForm || editDef) && (
        <DefinitionModal
          editDef={editDef}
          departments={departments}
          categories={categories}
          companyOpts={companyOpts}
          defaultCompany={company}
          period={period}
          onClose={() => { setShowDefForm(false); setEditDef(null); }}
          onSaved={() => { setShowDefForm(false); setEditDef(null); refreshAll(); }}
        />
      )}
      {showCategories && <CategoriesModal company={company} companyName={companyName(company)} onClose={() => setShowCategories(false)} onChanged={refreshAll} />}
    </div>
  );
}

function BoardGroup({ name, rows, colSpan, children }: { name: string; rows: KpiRow[]; colSpan: number; children: ReactNode }) {
  if (!name) return <>{children}</>;
  const c = rows.reduce((m, r) => { m[r.status] = (m[r.status] ?? 0) + 1; return m; }, {} as Record<string, number>);
  return (
    <>
      <tr className="bg-background/70">
        <td colSpan={colSpan} className="px-5 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">{name}</span>
            <span className="text-[11px] text-muted">{rows.length} KPI{rows.length === 1 ? "" : "s"}</span>
            {(["OVERDUE", "OFF_TRACK", "AT_RISK", "ON_TRACK", "ACHIEVED"] as KpiStatus[]).filter((s) => c[s]).map((s) => (
              <span key={s} className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${KPI_STATUS_STYLE[s]}`}>{c[s]} {KPI_STATUS_LABEL[s]}</span>
            ))}
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}

// ─── Cascade: Group → company → person ──────────────────────────────────────
// Each level counts the results in its own scope and window; the note under a parent shows
// how much of its target the KPIs below it have taken.
function CascadeView({ tree, isLoading, error, collapsed, onToggle, onOpen, companyName, scopeName }: {
  tree: CascadeNode[]; isLoading: boolean; error: unknown; collapsed: Set<string>;
  onToggle: (id: string) => void; onOpen: (id: string) => void; companyName: (k: string) => string; scopeName: string;
}) {
  const box = "rounded-2xl border border-border bg-surface shadow-sm px-4 py-12 text-center text-muted";
  if (isLoading) return <div className={box}>Loading the cascade…</div>;
  if (error) return <div className={clsx(box, "text-red-600")}>{apiError(error, "Couldn't load the cascade.")}</div>;
  if (!tree.length) {
    return <div className={box}>No KPIs in {scopeName}&apos;s cascade yet. Add a Group KPI, then company and personal KPIs that are &quot;part of&quot; it.</div>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted px-1">One goal shared down the chain. Deals won and money received move every level at once.</p>
      {tree.map((n) => <Branch key={n.row.definition.id} node={n} depth={0} collapsed={collapsed} onToggle={onToggle} onOpen={onOpen} companyName={companyName} />)}
    </div>
  );
}

function Branch({ node, depth, collapsed, onToggle, onOpen, companyName }: {
  node: CascadeNode; depth: number; collapsed: Set<string>; onToggle: (id: string) => void; onOpen: (id: string) => void; companyName: (k: string) => string;
}) {
  const r = node.row;
  const d = r.definition;
  const id = d.id;
  const isOpen = !collapsed.has(id);
  const level = d.ownerBdoId ? "Person" : d.company === "GROUP" ? "Group" : companyName(d.company);
  const c = r.children;
  const allocPct = c.count && r.target ? Math.min(100, Math.round(((c.allocated ?? 0) / r.target) * 100)) : null;
  const Icon = kpiIcon(d);

  return (
    <div className={clsx(depth === 0 && "rounded-2xl border border-border bg-surface shadow-sm p-3")}>
      <div className={clsx("flex items-start gap-2 rounded-xl px-2 py-2.5 hover:bg-primary/[0.03]", depth > 0 && "border-l-2 border-border/70 ml-5 pl-3")}>
        <button onClick={() => onToggle(id)} className={clsx("mt-2.5 text-muted hover:text-foreground", !node.children.length && "invisible")} aria-label={isOpen ? "Collapse" : "Expand"}>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <span className="h-9 w-9 rounded-full bg-foreground/5 text-foreground/80 grid place-items-center shrink-0"><Icon size={16} /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
              level === "Group" ? "bg-primary text-accent-foreground" : level === "Person" ? "bg-foreground/5 text-foreground/70" : "bg-accent/10 text-accent")}>
              {level === "Person" ? (r.owner?.name ?? "Person") : level}
            </span>
            <button onClick={() => onOpen(id)} className="font-semibold text-foreground hover:text-accent text-left">{d.metric}</button>
            {d.source === "AUTO" && <AutoTag />}
            {d.state === "DRAFT" && <Tag>Draft</Tag>}
            <StatusPill status={r.status} />
            <span className="text-[11px] text-muted">{windowLabel(r.window, d.frequency)}{r.owner && level !== "Person" ? ` · ${r.owner.name}` : ""}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            <span className="text-sm tabular-nums text-foreground font-medium whitespace-nowrap">{fmtKpiVal(r.current, d.unit)} <span className="text-muted font-normal">/ {fmtKpiVal(r.target, d.unit)}</span></span>
            <div className="flex items-center gap-2 w-48">
              <PaceBar attainment={r.attainment} expected={r.expected} status={r.status} />
              <span className="text-xs tabular-nums text-muted w-9 text-right">{r.attainment != null ? `${r.attainment}%` : "—"}</span>
            </div>
            <WorkChip work={r.work} />
            {allocPct != null && (
              <span className={clsx("text-[11px] whitespace-nowrap", c.over ? "text-red-600 font-medium" : "text-muted")} title="Share of the target taken by the KPIs under it">
                {c.over ? `Over-allocated by ${fmtKpiVal(-(c.unallocated ?? 0), d.unit)}` : `${allocPct}% allocated · ${fmtKpiVal(c.unallocated, d.unit)} free`}
              </span>
            )}
          </div>
        </div>
      </div>
      {isOpen && node.children.length > 0 && (
        <div className={clsx(depth === 0 ? "mt-1" : "ml-5")}>
          {node.children.map((k) => <Branch key={k.row.definition.id} node={k} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} onOpen={onOpen} companyName={companyName} />)}
        </div>
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

function IconButton({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} title={title} className={clsx("p-1.5 rounded-lg text-muted transition-colors", danger ? "hover:text-red-600 hover:bg-red-500/10" : "hover:text-accent hover:bg-accent/10")}>
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted block mb-1">{children}</label>;
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-lg">{message}</p>;
}

// ─── Review workflow for the period (submit → verify → lock) ────────────────
function ReviewPanel({ row, role, onChanged }: { row: KpiRow; role: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const entry = row.entry;
  if (!entry) return null;
  const review = (entry.reviewStatus ?? "DRAFT") as ReviewStatus;
  const actions = TRANSITIONS.filter((t) => t.from.includes(review) && (!t.levels || t.levels.includes(accessLevel(role))));
  const transition = async (action: string) => {
    setBusy(true); setError("");
    try { await api.post(`/kpi-framework/entries/${entry.id}/transition`, { action }); onChanged(); }
    catch (err) { setError(apiError(err, "Couldn't update the review status.")); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
      <span className="text-xs text-muted">Review</span>
      <ReviewBadge value={review} />
      <span className="flex-1" />
      {actions.map((t) => (
        <button key={t.action} onClick={() => transition(t.action)} disabled={busy} className="px-2.5 py-1 text-xs rounded-lg border border-border hover:bg-primary/5 disabled:opacity-50">{t.label}</button>
      ))}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Target for one period of a recurring KPI ───────────────────────────────
function PeriodTargetSheet({ row, period, onClose, onSaved }: { row: KpiRow; period: string; onClose: () => void; onSaved: () => void }) {
  const [target, setTarget] = useState(row.target != null && !row.targetCarried ? String(row.target) : row.target != null ? String(row.target) : "");
  const [start, setStart] = useState(row.start != null ? String(row.start) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true); setError("");
    try {
      await api.post("/kpi-framework/quick-update", { definitionId: row.definition.id, period, target, start });
      onSaved();
    } catch (err) { setError(apiError(err, "Failed to save.")); setBusy(false); }
  };
  return (
    <KpiSheet
      title={row.definition.metric}
      subtitle={`Target for ${periodLabelFor(period, row.definition.frequency)}${row.targetCarried ? " · currently carried over from an earlier period" : ""}`}
      onClose={onClose}
      footer={<><button onClick={onClose} className={btnSecondary}>Cancel</button><button onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving…" : "Save target"}</button></>}
    >
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Target *</Label><input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} autoFocus /></div>
        <div><Label>Baseline <span className="text-muted/60">(optional)</span></Label><input type="number" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} placeholder="Progress from" /></div>
      </div>
      <p className="text-[11px] text-muted">The target carries forward to later periods until it is changed.</p>
      <ErrorNote message={error} />
    </KpiSheet>
  );
}

// ─── Categories (per company) ───────────────────────────────────────────────
function CategoriesModal({ company, companyName, onClose, onChanged }: { company: string; companyName: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery<Category[]>({ queryKey: ["kpi-categories", company, "all"], queryFn: () => fetcher(`/kpi-framework/categories?company=${company}&all=1`) });
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["kpi-categories"] }); onChanged(); };
  const add = async () => {
    if (!name.trim()) return;
    setError("");
    try { await api.post("/kpi-framework/categories", { company, name }); setName(""); refresh(); }
    catch (err) { setError(apiError(err, "Couldn't add the category.")); }
  };
  const update = async (c: Category, body: Record<string, unknown>) => {
    try { await api.put(`/kpi-framework/categories/${c.id}`, body); refresh(); }
    catch (err) { setError(apiError(err, "Couldn't update the category.")); }
  };
  return (
    <KpiSheet title="KPI categories" subtitle={`${companyName} · group KPIs by what they're about, e.g. Sales & Business Development, Delivery`} onClose={onClose}>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className={inputClass} placeholder="New category name" />
        <button onClick={add} className={btnPrimary}>Add</button>
      </div>
      <ErrorNote message={error} />
      <ul className="divide-y divide-border/60">
        {cats.map((c) => (
          <li key={c.id} className="py-2 flex items-center gap-2">
            <input defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && update(c, { name: e.target.value })} className={clsx(inputClass, "py-1.5", c.status === "ARCHIVED" && "opacity-50")} />
            <span className="text-[11px] text-muted whitespace-nowrap">{c.kpiCount} KPI{c.kpiCount === 1 ? "" : "s"}</span>
            <button onClick={() => update(c, { status: c.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED" })} className="text-xs text-muted hover:text-accent whitespace-nowrap">
              {c.status === "ARCHIVED" ? "Restore" : "Archive"}
            </button>
          </li>
        ))}
        {cats.length === 0 && <li className="py-3 text-sm text-muted">No categories yet.</li>}
      </ul>
    </KpiSheet>
  );
}

// ─── Add / Edit KPI definition ──────────────────────────────────────────────
function DefinitionModal({ editDef, departments, categories, companyOpts, defaultCompany, period, onClose, onSaved }: {
  editDef?: KpiDef | null; departments: Dept[]; categories: Category[]; companyOpts: { key: string; name: string }[];
  defaultCompany: string; period: string; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!editDef;
  const { data: autoKeys = [] } = useQuery<AutoKey[]>({ queryKey: ["kpi-auto-keys"], queryFn: () => fetcher("/kpi-framework/auto-keys") });
  const { data: people = [] } = useQuery<Bdo[]>({ queryKey: ["bdos"], queryFn: () => fetcher("/bdo") });
  const day = (s: string | null | undefined) => (s ? s.slice(0, 10) : "");
  const [form, setForm] = useState({
    metric: editDef?.metric ?? "",
    company: editDef?.company ?? defaultCompany ?? "GROUP",
    department: editDef?.department ?? "",
    categoryId: editDef?.categoryId ?? "",
    ownerId: editDef?.ownerId ?? "",
    parentId: editDef?.parentId ?? "",
    definition: editDef?.definition ?? "",
    unit: editDef?.unit ?? "COUNT",
    higherIsBetter: editDef?.higherIsBetter ?? true,
    frequency: editDef?.frequency ?? "MONTHLY",
    source: editDef?.source ?? "MANUAL",
    autoKey: editDef?.autoKey ?? "",
    aggregation: editDef?.aggregation ?? "",
    windowed: !!(editDef?.startDate && editDef?.endDate),
    startDate: day(editDef?.startDate),
    endDate: day(editDef?.endDate),
    targetValue: editDef?.targetValue != null ? String(editDef.targetValue) : "",
    startValue: editDef?.startValue != null ? String(editDef.startValue) : "",
    periodTarget: "",
    state: editDef?.state ?? "ACTIVE",
    milestones: (editDef?.milestones ?? []).map((m) => ({ date: day(m.date), target: String(m.target) })),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const { data: parents = [] } = useQuery<ParentOpt[]>({
    queryKey: ["kpi-parents", form.company, editDef?.id ?? "", period],
    queryFn: () => fetcher(`/kpi-framework/parents?company=${form.company}&period=${period}${editDef ? `&excludeId=${editDef.id}` : ""}`),
  });
  const { data: formCats = categories } = useQuery<Category[]>({
    queryKey: ["kpi-categories", form.company],
    queryFn: () => fetcher(`/kpi-framework/categories?company=${form.company}`),
  });
  // Same unit, and tracked as often as this KPI or less often, so results roll up.
  const fits = (p: ParentOpt) => p.unit === form.unit && (form.windowed || fitsUnder(p, form.frequency));
  const parentChoices = parents.filter((p) => fits(p) || p.id === form.parentId);
  const pickFrequency = (frequency: string) => setForm((f) => {
    const p = parents.find((x) => x.id === f.parentId);
    return { ...f, frequency, parentId: p && !fitsUnder(p, frequency) ? "" : f.parentId };
  });
  const owners = people.filter((p) => form.company === "GROUP" || p.company === form.company);
  const parent = parents.find((p) => p.id === form.parentId);

  const pickAutoKey = (key: string) => {
    const ak = autoKeys.find((a) => a.key === key);
    setForm((f) => ({ ...f, autoKey: key, unit: ak?.unit ?? f.unit }));
  };
  const pickParent = (id: string) => set("parentId", id);

  const save = async () => {
    if (!form.metric.trim()) { setError("Metric name is required."); return; }
    if (form.source === "AUTO" && !form.autoKey) { setError("Pick which data feeds this auto KPI."); return; }
    if (form.windowed && (!form.startDate || !form.endDate)) { setError("Give the window a start and an end date."); return; }
    setSaving(true); setError("");
    const body: Record<string, unknown> = {
      metric: form.metric,
      company: form.company,
      department: form.department || null,
      categoryId: form.categoryId || null,
      ownerId: form.ownerId || null,
      parentId: form.parentId || null,
      definition: form.definition || null,
      unit: form.unit,
      higherIsBetter: form.higherIsBetter,
      frequency: form.frequency,
      source: form.source,
      autoKey: form.source === "AUTO" ? (form.autoKey || null) : null,
      state: form.state,
      startDate: form.windowed ? form.startDate : null,
      endDate: form.windowed ? form.endDate : null,
      targetValue: form.windowed ? (form.targetValue === "" ? null : form.targetValue) : null,
      startValue: form.windowed ? (form.startValue === "" ? null : form.startValue) : null,
      milestones: form.windowed ? form.milestones.filter((m) => m.date && m.target !== "") : [],
      period,
    };
    if (form.source !== "AUTO") body.aggregation = form.aggregation || null;
    if (!form.windowed && form.periodTarget !== "") body.target = form.periodTarget;
    try {
      if (isEdit) await api.put(`/kpi-framework/definitions/${editDef!.id}?period=${period}`, body);
      else await api.post(`/kpi-framework/definitions?period=${period}`, body);
      onSaved();
    } catch (err) {
      setError(apiError(err, "Failed to save."));
    } finally { setSaving(false); }
  };

  return (
    <KpiSheet
      wide
      title={isEdit ? "Edit KPI" : "Add KPI"}
      subtitle="What result we want, who owns it, what it rolls up into, and the target."
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={save} disabled={saving || !form.metric.trim()} className={btnPrimary}>{saving ? "Saving…" : isEdit ? "Save changes" : "Add KPI"}</button>
        </>
      }
    >
      <div>
        <Label>Metric name *</Label>
        <input value={form.metric} onChange={(e) => set("metric", e.target.value)} className={inputClass} placeholder="e.g. Revenue Received" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {companyOpts.length > 1 && (
          <div>
            <Label>Company *</Label>
            <select value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value, categoryId: "", ownerId: "", parentId: "" }))} className={selectClass + " w-full py-2"}>
              {companyOpts.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <Label>Category</Label>
          <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={selectClass + " w-full py-2"}>
            <option value="">— None —</option>
            {formCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Owner <span className="text-muted/60">(accountable)</span></Label>
          <select value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)} className={selectClass + " w-full py-2"}>
            <option value="">— Nobody yet —</option>
            {owners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Department <span className="text-muted/60">(label)</span></Label>
          <input value={form.department} onChange={(e) => set("department", e.target.value)} list="dept-list" className={inputClass} />
          <datalist id="dept-list">{departments.map((d) => <option key={d.department} value={d.department} />)}</datalist>
        </div>
      </div>

      <div>
        <Label>Part of <span className="text-muted/60">(the KPI this one takes a share of)</span></Label>
        <select value={form.parentId} onChange={(e) => pickParent(e.target.value)} className={selectClass + " w-full py-2"}>
          <option value="">— Top level —</option>
          {parentChoices.map((p) => (
            <option key={p.id} value={p.id}>{p.company === "GROUP" ? "Group" : p.company} · {p.metric}{p.targetValue != null ? ` (target ${p.targetValue.toLocaleString()}${p.startDate && p.endDate ? "" : ` a ${FREQ_WORD[p.frequency] ?? "period"}`})` : ""}</option>
          ))}
        </select>
        {parents.length > parentChoices.length && <p className="text-[11px] text-muted mt-1">Only KPIs in the same unit, tracked as often as this one or less often, are listed, so results can roll up.</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Unit</Label>
          <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className={selectClass + " w-full py-2"}>
            {UNIT_OPTS.map((u) => <option key={u} value={u}>{u === "CURRENCY" ? "GHS" : u}</option>)}
          </select>
        </div>
        <div>
          <Label>State</Label>
          <select value={form.state} onChange={(e) => set("state", e.target.value)} className={selectClass + " w-full py-2"}>
            <option value="ACTIVE">Active — judged and counted</option>
            <option value="DRAFT">Draft — not judged yet</option>
          </select>
        </div>
      </div>

      {/* Source: manual vs auto-computed */}
      <div>
        <Label>How is the actual measured?</Label>
        <Segmented value={form.source} options={[["MANUAL", "From logged results"], ["AUTO", "Auto from data"]]} onChange={(v) => set("source", v)} />
      </div>
      {form.source === "AUTO" ? (
        <div>
          <Label>Data feed *</Label>
          <select value={form.autoKey} onChange={(e) => pickAutoKey(e.target.value)} className={selectClass + " w-full py-2"}>
            <option value="">— Select a feed —</option>
            {autoKeys.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
          <p className="text-[11px] text-sky-700 mt-1">Counted for this KPI&apos;s company (or the whole group) inside its window — deals, payments, leads and tasks update it automatically.</p>
        </div>
      ) : (
        <div>
          <Label>Actual is the…</Label>
          <select value={form.aggregation || defaultAgg(form.unit)} onChange={(e) => set("aggregation", e.target.value)} className={selectClass + " w-full py-2"} disabled={isEdit && editDef?.state === "ACTIVE"}>
            {["SUM", "LATEST", "AVERAGE"].map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
          </select>
          {isEdit && editDef?.state === "ACTIVE" && <p className="text-[11px] text-muted mt-1">Locked once a KPI is live.</p>}
        </div>
      )}

      {/* Period + target. New KPIs recur weekly, monthly, quarterly or yearly; the date fields
          only show when editing an older KPI that was set up with fixed dates. */}
      <div className="rounded-xl border border-border p-3 space-y-3">
        {form.windowed ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start date *</Label><input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputClass} /></div>
              <div><Label>End date *</Label><input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={inputClass} /></div>
              <div><Label>Target for the window {form.state === "ACTIVE" && "*"}</Label><input type="number" value={form.targetValue} onChange={(e) => set("targetValue", e.target.value)} className={inputClass} placeholder="e.g. 5000000" /></div>
              <div><Label>Baseline <span className="text-muted/60">(optional)</span></Label><input type="number" value={form.startValue} onChange={(e) => set("startValue", e.target.value)} className={inputClass} /></div>
            </div>
            {parent?.startDate && <p className="text-[11px] text-muted">The parent runs {day(parent.startDate)} to {day(parent.endDate)} — this window must sit inside it.</p>}
            <Milestones value={form.milestones} onChange={(m) => set("milestones", m)} />
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Frequency</Label>
              <select value={form.frequency} onChange={(e) => pickFrequency(e.target.value)} className={selectClass + " w-full py-2"}>
                {FREQ_OPTS.map((f) => <option key={f} value={f}>{f.charAt(0) + f.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div>
              <Label>Target for {periodLabelFor(period, form.frequency)} {!isEdit && form.state === "ACTIVE" && "*"}</Label>
              <input type="number" value={form.periodTarget} onChange={(e) => set("periodTarget", e.target.value)} className={inputClass} placeholder={isEdit ? "Leave blank to keep" : ""} />
            </div>
            <div className="col-span-2 -mt-2"><ShareHint parent={parent} frequency={form.frequency} onUse={(v) => set("periodTarget", String(v))} /></div>
            <p className="col-span-2 text-[11px] text-muted">The target carries forward to later {form.frequency === "WEEKLY" ? "weeks" : form.frequency === "ANNUAL" ? "years" : form.frequency === "QUARTERLY" ? "quarters" : "months"} until it is changed.</p>
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" checked={form.higherIsBetter} onChange={(e) => set("higherIsBetter", e.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />
        <span>Higher is better <span className="text-muted text-xs">(uncheck for spend, cycle time or overdue counts)</span></span>
      </label>
      <div>
        <Label>Description</Label>
        <textarea value={form.definition} onChange={(e) => set("definition", e.target.value)} rows={2} className={inputClass + " resize-none"} />
      </div>

      <ErrorNote message={error} />
    </KpiSheet>
  );
}

// Stepping stones inside the window (e.g. 2 deals by week 2): pace follows them instead of a straight line.
function Milestones({ value, onChange }: { value: { date: string; target: string }[]; onChange: (v: { date: string; target: string }[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Milestones <span className="text-muted/60">(optional — for lumpy KPIs)</span></Label>
        <button type="button" onClick={() => onChange([...value, { date: "", target: "" }])} className="text-xs text-accent hover:underline">+ Add</button>
      </div>
      {value.map((m, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input type="date" value={m.date} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className={inputClass} />
          <input type="number" value={m.target} placeholder="Total by then" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} className={inputClass} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="p-1 text-muted hover:text-red-600"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[] | [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden text-sm">
      {options.map(([key, label], i) => (
        <button key={key} type="button" onClick={() => onChange(key)}
          className={clsx("flex-1 px-3 py-2 transition-colors", i > 0 && "border-l border-border", value === key ? "bg-primary text-accent-foreground" : "bg-background text-foreground/70 hover:bg-primary/5")}>
          {label}
        </button>
      ))}
    </div>
  );
}
