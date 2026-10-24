"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardCheck,
  Clock,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { DataTable, type Column } from "@/components/DataTable";
import { PriorityBadge, TaskStatusBadge } from "@/components/Badges";
import { ClientSelect, type ClientOption } from "@/components/ClientSelect";
import { useAuth } from "@/components/AuthProvider";
import { isStaff, isGroupOwner } from "@/lib/auth";
import { useCompanies } from "@/lib/companies";
import { KpiSheet, LogResult, type KpiRow } from "@/components/kpi";

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

type TaskKpi = { id: string; metric: string; source: string; unit: string; aggregation: "SUM" | "LATEST" | "AVERAGE" | null };
type Task = {
  id: string;
  year: number | null;
  priority: string;
  deliverable: string;
  targetDate: string | null;
  startDate: string | null;
  bdoId: string | null;
  bdo: { name: string } | null;
  status: string;
  company: string | null;
  notes: string | null;
  type: "TASK" | "PROPOSAL";
  smeId: string | null;
  clientName: string | null;
  proposalValueGhs: number | null;
  outcome: string | null;
  // Optional — if your API ever returns a category it is used, otherwise it is inferred from the title.
  category?: string | null;
  // The KPI this work moves, and what the server works out from it.
  kpiId: string | null;
  kpi: TaskKpi | null;
  weight: number | null;
  progress: number | null;
  completionCriteria: string | null;
  completedAt: string | null;
  dependsOn: string[];
  blocked: boolean;
  blockedBy: { id: string; deliverable: string }[];
  overdue: boolean;
  needsResult: boolean;
  expenseActual: number | null;
  revenueActual: number | null;
  currency: string | null;
  exchangeRate: number | null;
  // The deal this work is for; money brought in is recorded as a payment on it.
  dealId: string | null;
  deal: { id: string; source: string; name: string } | null;
  // Approval: work staff finish counts toward KPIs only once their Business CEO or the Group
  // Owner approves it. approvedAt set + PENDING = a change to approved work is waiting.
  approval: "PENDING" | "APPROVED" | "REJECTED" | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByEmail: string | null;
  rejectedReason: string | null;
  rejectedByEmail: string | null;
};

// A task waiting for approval, with the results its owner logged from it.
type ApprovalTask = Task & { pendingResults: { value: number; date: string; note: string | null }[] };

// Whether a completed task's money and results count yet.
const counts = (t: Task) => t.status === "COMPLETED" && (t.approval !== "PENDING" || !!t.approvedAt) && t.approval !== "REJECTED";

type DealOption = { id: string; source: string; name: string; stage: string; receivedGhs: number };

type Bdo = { id: string; name: string; company: string };
type Linkable = { id: string; metric: string; company: string; source: string; unit: string; kind: "PERSONAL" | "SCORECARD" | "COMPANY" };

type TabKey = "all" | "mine" | "overdue" | "week" | "proposals" | "approvals";
type SortKey = "soonest" | "latest" | "priority";
type GroupKey = "overdue" | "blocked" | "progress" | "todo" | "done";

const OUTCOME_OPTS = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "NO_RESPONSE"] as const;
const OUTCOME_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  NO_RESPONSE: "bg-amber-100 text-amber-700",
};

const PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW"];
const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const CURRENCIES = ["GHS", "USD", "EUR", "NGN", "RWF"];
const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PRIORITY_STYLES: Record<string, string> = {
  URGENT: "bg-red-600 text-white",
  HIGH: "bg-red-50 text-red-600",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-sky-50 text-sky-600",
};
const STATUS_STYLES: Record<string, string> = {
  IN_PROGRESS: "bg-blue-50 text-blue-600",
  PENDING: "bg-amber-50 text-amber-600",
  COMPLETED: "bg-green-50 text-green-700",
  OVERDUE: "bg-red-50 text-red-600",
  BLOCKED: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const COLLAPSED_ROWS = 4;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const fmt = (n: number) => `GHS ${n.toLocaleString()}`;
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const startOfToday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
const isClosed = (t: Task) => ["COMPLETED", "CANCELLED"].includes(t.status);
const dueTime = (t: Task) => {
  if (!t.targetDate) return null;
  const d = new Date(t.targetDate);
  return isNaN(d.getTime()) ? null : d;
};
function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

// The server works out Overdue from the due date; the date check is a fallback.
const isOverdue = (t: Task) => {
  if (isClosed(t)) return false;
  if (t.overdue || t.status === "OVERDUE") return true;
  const d = dueTime(t);
  return !!d && d < startOfToday();
};
const isUpcoming = (t: Task, days: number) => {
  const d = dueTime(t);
  if (!d || isClosed(t)) return false;
  const s = startOfToday();
  const e = new Date(s);
  e.setDate(e.getDate() + days + 1);
  return d >= s && d < e;
};
const isDueThisWeek = (t: Task) => {
  const d = dueTime(t);
  if (!d || isClosed(t)) return false;
  const s = startOfToday();
  const e = new Date(s);
  e.setDate(e.getDate() + ((7 - s.getDay()) % 7) + 1); // end of this Sunday
  return d >= s && d < e;
};

const groupOf = (t: Task): GroupKey =>
  isClosed(t) ? "done" : isOverdue(t) ? "overdue" : t.blocked ? "blocked" : t.status === "IN_PROGRESS" ? "progress" : "todo";
const shownStatus = (t: Task) => (isClosed(t) ? t.status : t.blocked ? "BLOCKED" : isOverdue(t) ? "OVERDUE" : t.status);
const progressOf = (t: Task) => (t.status === "COMPLETED" ? 100 : t.progress ?? 0);

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Deliverable: FileText,
  Meeting: Users,
  Submission: FileText,
  Hiring: User,
  Review: FileText,
  Testing: ClipboardCheck,
};
const categoryOf = (t: Task): string => {
  if (t.category && CATEGORY_ICONS[t.category]) return t.category;
  const s = t.deliverable.toLowerCase();
  if (/\bmeet|call with|catch ?up/.test(s)) return "Meeting";
  if (/recruit|hire|hiring|interview/.test(s)) return "Hiring";
  if (/submit|submission|proposal|expression of interest|\beoi\b|tender/.test(s)) return "Submission";
  if (/review|revisit|audit/.test(s)) return "Review";
  if (/\btest/.test(s)) return "Testing";
  return "Deliverable";
};

const GROUPS: {
  key: GroupKey;
  title: string;
  Icon: LucideIcon;
  header: string;
  iconWrap: string;
  titleCls: string;
  rowIcon: string;
}[] = [
  { key: "overdue",  title: "Overdue",     Icon: AlertCircle,  header: "bg-gradient-to-r from-red-50 to-transparent",   iconWrap: "bg-red-500 text-white",     titleCls: "text-red-600",     rowIcon: "bg-red-50 text-red-500" },
  { key: "blocked",  title: "Blocked",     Icon: Ban,          header: "bg-gradient-to-r from-amber-50 to-transparent", iconWrap: "bg-amber-500 text-white",   titleCls: "text-amber-700",   rowIcon: "bg-amber-50 text-amber-600" },
  { key: "progress", title: "In Progress", Icon: Clock,        header: "bg-gradient-to-r from-green-50 to-transparent", iconWrap: "bg-green-600 text-white",   titleCls: "text-green-700",   rowIcon: "bg-green-50 text-green-600" },
  { key: "todo",     title: "To Do",       Icon: Circle,       header: "bg-gradient-to-r from-gray-100/80 to-transparent", iconWrap: "bg-gray-500 text-white", titleCls: "text-gray-700",    rowIcon: "bg-gray-100 text-gray-500" },
  { key: "done",     title: "Completed",   Icon: CheckCircle2, header: "bg-gradient-to-r from-emerald-50 to-transparent", iconWrap: "bg-emerald-600 text-white", titleCls: "text-emerald-700", rowIcon: "bg-emerald-50 text-emerald-600" },
];

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

const OutcomeBadge = ({ value }: { value: string }) => (
  <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-medium", OUTCOME_COLORS[value] ?? "bg-gray-100 text-gray-500")}>
    {value.replace(/_/g, " ")}
  </span>
);

function PriorityPill({ value }: { value: string }) {
  return (
    <span className={clsx("inline-block px-2.5 py-1 rounded-full text-[10.5px] font-semibold uppercase tracking-wide", PRIORITY_STYLES[value] ?? "bg-gray-100 text-gray-500")}>
      {value}
    </span>
  );
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold uppercase tracking-wide whitespace-nowrap", STATUS_STYLES[value] ?? "bg-gray-100 text-gray-500")}>
      {value === "COMPLETED" && <CheckCircle2 size={12} />}
      {value.replace(/_/g, " ")}
    </span>
  );
}

function Ring({ pct, ringClass, trackClass }: { pct: number; ringClass: string; trackClass: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className={trackClass} />
      {pct > 0 && (
        <circle
          cx="28" cy="28" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(pct, 100) / 100)}
          className={ringClass}
        />
      )}
    </svg>
  );
}

function RingStat({ value, label, pct, ringClass, trackClass, labelClass }: {
  value: string; label: string; pct: number; ringClass: string; trackClass: string; labelClass: string;
}) {
  return (
    <div className="bg-white/90 border border-gray-200/80 rounded-2xl shadow-sm px-4 py-4 flex items-center gap-4">
      <Ring pct={pct} ringClass={ringClass} trackClass={trackClass} />
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className={clsx("text-sm font-medium", labelClass)}>{label}</div>
      </div>
      <div className="ml-auto self-end text-xs text-gray-400">{pct}%</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "blue" }) {
  const styles: Record<string, string> = {
    green: "bg-green-50 border-green-200 text-green-700 text-green-600",
    red: "bg-red-50 border-red-200 text-red-700 text-red-600",
    blue: "bg-blue-50 border-blue-200 text-blue-700 text-blue-600",
  };
  const [bg, border, valueColor, labelColor] = styles[tone].split(" ");
  return (
    <div className={clsx("border rounded-xl px-4 py-2.5 text-center", bg, border)}>
      <div className={clsx("text-xs font-medium", labelColor)}>{label}</div>
      <div className={clsx("font-bold", valueColor)}>{value}</div>
    </div>
  );
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-9 py-2 text-[13px] text-gray-700 min-w-[150px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
    </div>
  );
}

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div ref={ref} className="relative justify-self-end">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
        aria-label="Task actions"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-30">
          <button onClick={() => { setOpen(false); onEdit(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Pencil size={14} /> Edit
          </button>
          <button onClick={() => { setOpen(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, group, gridCols, showCompany, showBdo, companyName, onToggle, onEdit, onDelete, onLogResult }: {
  task: Task;
  group: (typeof GROUPS)[number];
  gridCols: string;
  showCompany: boolean;
  showBdo: boolean;
  companyName: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLogResult: () => void;
}) {
  const category = categoryOf(task);
  const Icon = CATEGORY_ICONS[category] ?? FileText;
  const overdue = isOverdue(task);
  const pct = progressOf(task);
  return (
    <div
      className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 lg:grid hover:bg-gray-50/60 transition-colors"
      style={{ gridTemplateColumns: gridCols }}
    >
      <input
        type="checkbox"
        checked={task.status === "COMPLETED"}
        onChange={onToggle}
        className="h-4 w-4 rounded border-gray-300 accent-accent cursor-pointer"
        aria-label={`Mark "${task.deliverable}" as ${task.status === "COMPLETED" ? "not completed" : "completed"}`}
      />

      <div className="flex items-center gap-3 min-w-0 flex-1 basis-[60%] lg:basis-auto">
        <span className={clsx("h-10 w-10 rounded-full grid place-items-center shrink-0", group.rowIcon)}>
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-gray-900 truncate" title={task.deliverable}>{task.deliverable}</div>
          <div className="text-[11px] text-gray-400 truncate">
            {task.kpi ? (
              <span className="inline-flex items-center gap-1 text-gray-600" title="The KPI this task moves"><Target size={11} className="text-accent" />{task.kpi.metric}</span>
            ) : (
              <>{category} • {task.type === "PROPOSAL" ? "Proposal" : "Task"}</>
            )}
            {task.deal && (
              <span className="text-gray-500" title="The deal this task is for">
                {" "}• {task.deal.name}{task.revenueActual ? ` · ${task.currency && task.currency !== "GHS" ? task.currency : "GHS"} ${task.revenueActual.toLocaleString()} ${counts(task) ? "in" : task.status === "COMPLETED" ? "awaiting approval" : "expected"}` : ""}
              </span>
            )}
          </div>
          {task.blocked && task.blockedBy.length > 0 && (
            <div className="text-[11px] text-amber-700 truncate" title={task.blockedBy.map((b) => b.deliverable).join(", ")}>
              Waiting on {task.blockedBy.map((b) => `“${b.deliverable}”`).join(", ")}
            </div>
          )}
          {task.completionCriteria && <div className="text-[11px] text-gray-400 truncate" title={task.completionCriteria}>Done when: {task.completionCriteria}</div>}
          {task.rejectedReason && task.approval !== "PENDING" && (
            <div className="text-[11px] text-red-600 truncate" title={task.rejectedReason}>
              {task.approval === "APPROVED" ? "Change rejected" : "Rejected"}{task.rejectedByEmail ? ` by ${task.rejectedByEmail}` : ""}: {task.rejectedReason}
            </div>
          )}
        </div>
      </div>

      <div><PriorityPill value={task.priority} /></div>

      <div className="flex items-center gap-1.5" title={`Weight ${task.weight ?? 1} of 5`}>
        <div className="h-1.5 flex-1 rounded-full bg-gray-100 min-w-[40px]"><div className="h-full rounded-full bg-accent/70" style={{ width: `${pct}%` }} /></div>
        <span className="text-[11px] tabular-nums text-gray-500 w-8 text-right">{pct}%</span>
      </div>

      {showCompany && <div className="text-[12.5px] text-gray-700 truncate">{companyName || "—"}</div>}
      {showBdo && <div className="text-[12.5px] text-gray-700 truncate">{task.bdo?.name ?? "—"}</div>}

      <div className={clsx("flex items-center gap-1.5 text-[12.5px] whitespace-nowrap", overdue ? "text-red-600" : "text-gray-600")}>
        <Calendar size={14} className={overdue ? "text-red-500" : "text-gray-400"} />
        {fmtDate(task.targetDate)}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <StatusPill value={shownStatus(task)} />
        {task.approval === "PENDING" && (
          <span
            className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-sky-50 text-sky-700 whitespace-nowrap"
            title={task.approvedAt ? "A change to this approved task is waiting for approval; the approved version counts until then." : "Doesn't count toward KPIs until it's approved."}
          >
            {task.approvedAt ? "Change awaiting approval" : "Awaiting approval"}
          </span>
        )}
        {task.needsResult && (
          <button
            onClick={onLogResult}
            className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 whitespace-nowrap"
            title="This finished task is linked to a KPI with no result logged"
          >
            Log result
          </button>
        )}
      </div>

      <RowMenu onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TasksPage() {
  const { user } = useAuth();
  const isBdo = isStaff(user);
  // Staff and Business CEOs only ever work inside one company, so company pickers and
  // the company column are for the Group Owner alone.
  const oneCompany = !isGroupOwner(user);
  const myBdoId = user?.bdoId ?? null;

  const { companies, byKey } = useCompanies();
  const scopeName = oneCompany && user?.bdoCompany ? (byKey[user.bdoCompany]?.name ?? user.bdoCompany) : "the group";

  const [tab, setTab] = useState<TabKey>("all");
  const [filters, setFilters] = useState({ priority: "", status: "", company: "", bdoId: "" });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("soonest");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [prompt, setPrompt] = useState<Task | null>(null);
  const qc = useQueryClient();

  // Managers approve the work staff finish; the alerts link here with ?view=approvals.
  const { data: approvals = [] } = useQuery<ApprovalTask[]>({
    queryKey: ["tasks", "approvals"],
    queryFn: () => fetcher("/tasks/approvals"),
    enabled: !!user && !isBdo,
  });
  useEffect(() => {
    if (!isBdo && new URLSearchParams(window.location.search).get("view") === "approvals") setTab("approvals");
  }, [isBdo]);

  const isProposalView = tab === "proposals";
  const isApprovalView = tab === "approvals";

  // BDO users are always scoped to their own tasks; admins/CEO use the filter bar.
  // Blocked isn't a stored status: the server works it out from "Waits on".
  const { status: statusFilter, ...rest } = filters;
  const effective = {
    ...rest,
    ...(statusFilter === "BLOCKED" ? { blocked: "1" } : { status: statusFilter }),
    type: isProposalView ? "PROPOSAL" : "TASK",
    ...(isBdo ? { bdoId: myBdoId ?? "" } : {}),
  };
  const params = new URLSearchParams(Object.fromEntries(Object.entries(effective).filter(([, v]) => v)));

  const { data = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks", effective],
    queryFn: () => fetcher(`/tasks?${params}`),
    enabled: !!user && (!isBdo || !!myBdoId),
  });

  const { data: bdos = [] } = useQuery<Bdo[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
    enabled: !isBdo,
  });

  const { data: smeRes } = useQuery<{ data: ClientOption[]; total: number }>({
    queryKey: ["sme-options"],
    queryFn: () => fetcher("/sme?limit=500"),
  });
  const clients = smeRes?.data ?? [];

  // Tasks feed KPI work and results, so the KPI screens refresh with them.
  // Money brought in on a linked task is a payment on its deal, so the deal screens refresh too.
  const refresh = () => {
    for (const key of ["tasks", "my-kpis", "kpi-board", "kpi-cascade", "deal-payments", "tradeline", "bapx", "company-deals", "task-deal-options", "alerts"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: refresh,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: string }) => api.put(`/tasks/${task.id}`, { status }),
    onSuccess: (res, { status }) => {
      refresh();
      // Finishing work that is linked to a manual KPI: ask whether it produced a result.
      const saved = res.data as Task;
      if (status === "COMPLETED" && saved.kpi && saved.kpi.source !== "AUTO") setPrompt(saved);
    },
    onError: (err) => window.alert(apiError(err, "Couldn't update the task.")),
  });

  /* ---- derived numbers ---- */
  const total = data.length;
  const completedN = data.filter((t) => t.status === "COMPLETED").length;
  const overdueN = data.filter(isOverdue).length;
  const upcomingN = data.filter((t) => isUpcoming(t, 7)).length;
  const notStartedN = data.filter((t) => t.status === "PENDING").length;
  const blockedN = data.filter((t) => t.blocked).length;
  const mineN = myBdoId ? data.filter((t) => t.bdoId === myBdoId).length : 0;
  const weekN = data.filter(isDueThisWeek).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  // Proposal reporting
  const proposalValue = data.reduce((s, t) => s + (t.proposalValueGhs ?? 0), 0);
  const accepted = data.filter((t) => t.outcome === "ACCEPTED").length;
  const decided = data.filter((t) => ["ACCEPTED", "REJECTED", "NO_RESPONSE"].includes(t.outcome ?? "")).length;
  const winRate = decided > 0 ? Math.round((accepted / decided) * 100) : null;

  /* ---- search + tab + sort ---- */
  const q = search.trim().toLowerCase();
  const matchesSearch = (t: Task) =>
    !q ||
    [t.deliverable, t.notes, t.clientName, t.bdo?.name, t.company ? (byKey[t.company]?.name ?? t.company) : ""].some((v) =>
      (v ?? "").toLowerCase().includes(q),
    );
  const matchesTab = (t: Task) =>
    tab === "mine" ? !!myBdoId && t.bdoId === myBdoId
    : tab === "overdue" ? isOverdue(t)
    : tab === "week" ? isDueThisWeek(t)
    : true;
  const sorter = (a: Task, b: Task) => {
    if (sort === "priority") {
      const d = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (d) return d;
    }
    const ta = dueTime(a)?.getTime() ?? Infinity;
    const tb = dueTime(b)?.getTime() ?? Infinity;
    if (ta === tb) return 0;
    if (ta === Infinity) return 1;
    if (tb === Infinity) return -1;
    return sort === "latest" ? tb - ta : ta - tb;
  };
  const visible = data.filter((t) => matchesSearch(t) && matchesTab(t)).sort(sorter);
  const groups = GROUPS.map((g) => ({ ...g, tasks: visible.filter((t) => groupOf(t) === g.key) })).filter((g) => g.tasks.length > 0);

  const gridCols = [
    "24px",
    "minmax(0,2.4fr)",
    "84px",
    "104px",
    ...(oneCompany ? [] : ["minmax(0,1.3fr)"]),
    ...(isBdo ? [] : ["minmax(0,1.2fr)"]),
    "132px",
    "150px",
    "28px",
  ].join(" ");

  const askDelete = (row: Task) => { if (confirm(`Delete "${row.deliverable}"?`)) deleteMutation.mutate(row.id); };
  const openEdit = (row: Task) => { setEditing(row); setShowForm(true); };
  const openAdd = () => { setEditing(null); setShowForm(true); };

  const proposalColumns: Column<Task>[] = [
    { key: "year", label: "Year", sortable: true, width: "60px" },
    { key: "priority", label: "Priority", render: (r) => <PriorityBadge value={r.priority} />, sortable: true },
    { key: "deliverable", label: "Proposal", sortable: true },
    { key: "clientName", label: "Client", render: (r: Task) => r.clientName ?? "—" },
    { key: "proposalValueGhs", label: "Value", sortable: true, render: (r: Task) => (r.proposalValueGhs ? fmt(r.proposalValueGhs) : "—") },
    { key: "outcome", label: "Outcome", render: (r: Task) => (r.outcome ? <OutcomeBadge value={r.outcome} /> : "—") },
    {
      key: "targetDate", label: "Due / Sent", sortable: true,
      render: (r: Task) => <span className={isOverdue(r) ? "text-red-600 font-medium" : ""}>{fmtDate(r.targetDate)}</span>,
      exportValue: (r: Task) => r.targetDate ?? "",
    },
    ...(isBdo ? [] : [{ key: "bdo", label: "BDO", render: (r: Task) => r.bdo?.name ?? "—" }]),
    ...(oneCompany ? [] : [{ key: "company", label: "Company", render: (r: Task) => (r.company ? (byKey[r.company]?.name ?? r.company) : "—") }]),
    { key: "status", label: "Status", render: (r: Task) => <TaskStatusBadge value={r.status} />, sortable: true },
    { key: "notes", label: "Notes" },
  ];

  if (isBdo && !myBdoId) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Scheme of Work</h1>
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3">
          Your account isn’t linked to a BDO profile yet, so there are no items to show. Ask an admin to link your account.
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; count: number | null; badge: string }[] = [
    { key: "all", label: "All Tasks", count: isProposalView ? null : total, badge: "" },
    { key: "mine", label: "My Tasks", count: isProposalView ? null : mineN, badge: "" },
    { key: "overdue", label: "Overdue", count: isProposalView ? null : overdueN, badge: "bg-red-50 text-red-600" },
    { key: "week", label: "Due This Week", count: isProposalView ? null : weekN, badge: "" },
    { key: "proposals", label: "Proposals", count: isProposalView ? total : null, badge: "" },
    ...(isBdo ? [] : [{ key: "approvals" as TabKey, label: "Awaiting approval", count: approvals.length, badge: approvals.length ? "bg-sky-50 text-sky-700" : "" }]),
  ];

  return (
    <div className="relative p-4 md:p-6 space-y-5">
      {/* Soft warm backdrop behind the header */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-orange-50/80 via-orange-50/30 to-transparent" />

      {/* Header */}
      <div className="relative">
        
        <h1 className="mt-1 text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">
          {isBdo ? "My Scheme of Work" : "Scheme of Work"}
        </h1>
        <p className="mt-2 text-sm md:text-[15px] text-gray-600">
          {isProposalView
            ? (isBdo ? "Track your client proposals and their outcomes." : `Track client proposals and their outcomes across ${scopeName}.`)
            : (isBdo ? "Track, manage and deliver your tasks and deliverables." : `Track, manage and deliver all tasks and deliverables across ${scopeName}.`)}
        </p>

        <div aria-hidden className="hidden lg:block absolute right-2 top-0 text-right select-none">
          <p
            className="text-accent text-xl leading-6 -rotate-6"
            style={{ fontFamily: "'Caveat','Segoe Script','Bradley Hand','Brush Script MT',cursive" }}
          >
            Good work<br />builds great<br />outcomes.
          </p>
          <svg width="110" height="14" viewBox="0 0 110 14" className="ml-auto mt-1 text-accent">
            <path d="M2 10 C 30 2, 70 2, 108 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Stat cards */}
      {isProposalView ? (
        <div className="relative flex flex-wrap gap-3">
          <Stat label="Proposals" value={String(total)} tone="blue" />
          <Stat label="Total Value" value={fmt(proposalValue)} tone="blue" />
          <Stat label="Win Rate" value={winRate === null ? "—" : `${winRate}%`} tone="green" />
        </div>
      ) : (
        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <RingStat value={`${completedN} / ${total}`} label="Completed" pct={pct(completedN)} ringClass="stroke-green-600" trackClass="stroke-green-100" labelClass="text-green-600" />
          <RingStat value={String(overdueN)} label="Overdue" pct={pct(overdueN)} ringClass="stroke-red-500" trackClass="stroke-red-100" labelClass="text-red-500" />
          <RingStat value={String(blockedN)} label="Blocked" pct={pct(blockedN)} ringClass="stroke-amber-500" trackClass="stroke-amber-100" labelClass="text-amber-600" />
          <RingStat value={String(upcomingN)} label="Upcoming (7 days)" pct={pct(upcomingN)} ringClass="stroke-blue-500" trackClass="stroke-blue-100" labelClass="text-gray-500" />
          <RingStat value={String(notStartedN)} label="Not started" pct={pct(notStartedN)} ringClass="stroke-gray-400" trackClass="stroke-gray-200" labelClass="text-gray-500" />
        </div>
      )}

      {/* Tabs + sort + add */}
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-x-6 gap-y-2 overflow-x-auto">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={clsx(
                  "flex items-center gap-2 pb-2.5 -mb-px text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                  active ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-800",
                )}
              >
                {t.label}
                {t.count !== null && (
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded-full text-[11px] font-semibold",
                      t.badge || (active ? "bg-accent/10 text-accent" : "bg-gray-100 text-gray-500"),
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {!isProposalView && (
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="appearance-none bg-white border border-gray-200 rounded-xl pl-3.5 pr-9 py-2.5 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                <option value="soonest">Sort by: Deadline (Soonest)</option>
                <option value="latest">Sort by: Deadline (Latest)</option>
                <option value="priority">Sort by: Priority</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          )}
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-accent text-accent-foreground rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> {isProposalView ? "Add Proposal" : "Add Task"}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="relative bg-white/90 border border-gray-200/80 rounded-2xl shadow-sm p-3 flex flex-wrap items-center gap-3">
        <FilterSelect value={filters.priority} onChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
          <option value="">All Priorities</option>
          {PRIORITIES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
        </FilterSelect>
        <FilterSelect value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
          <option value="">All Statuses</option>
          {["PENDING", "IN_PROGRESS", "BLOCKED", "OVERDUE", "COMPLETED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </FilterSelect>
        {!oneCompany && (
          <FilterSelect value={filters.company} onChange={(v) => setFilters((f) => ({ ...f, company: v }))}>
            <option value="">All Companies</option>
            {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </FilterSelect>
        )}
        {!isBdo && (
          <FilterSelect value={filters.bdoId} onChange={(v) => setFilters((f) => ({ ...f, bdoId: v }))}>
            <option value="">All BDOs</option>
            {bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}
          </FilterSelect>
        )}
        <div className="relative w-full sm:w-72 sm:ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isProposalView ? "Search proposals..." : "Search tasks..."}
            className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>
      </div>

      {/* Body */}
      {isApprovalView ? (
        <ApprovalsList tasks={approvals} oneCompany={oneCompany} companyName={(k) => byKey[k]?.name ?? k} onChanged={refresh} />
      ) : isProposalView ? (
        <DataTable
          columns={proposalColumns}
          data={visible}
          isLoading={isLoading}
          title={`${visible.length} proposals`}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={askDelete}
          filterBar={null}
        />
      ) : isLoading ? (
        <div className="relative space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-gray-100/80 animate-pulse" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="relative bg-white/90 border border-gray-200/80 rounded-2xl shadow-sm py-14 text-center text-sm text-gray-500">
          No tasks match your filters.
        </div>
      ) : (
        <div className="relative space-y-4">
          {groups.map((g) => {
            const isOpen = !!expanded[g.key];
            const shown = isOpen ? g.tasks : g.tasks.slice(0, COLLAPSED_ROWS);
            return (
              <section key={g.key} className="bg-white/90 border border-gray-200/80 rounded-2xl shadow-sm">
                <div className={clsx("px-4 py-3 flex items-center gap-3 rounded-t-2xl", g.header)}>
                  <span className={clsx("h-7 w-7 rounded-full grid place-items-center", g.iconWrap)}>
                    <g.Icon size={15} />
                  </span>
                  <h2 className={clsx("text-sm font-semibold", g.titleCls)}>{g.title}</h2>
                  <span className="text-xs text-gray-400">{g.tasks.length} {g.tasks.length === 1 ? "task" : "tasks"}</span>
                  {g.tasks.length > COLLAPSED_ROWS && (
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [g.key]: !isOpen }))}
                      className={clsx("ml-auto flex items-center gap-1 text-xs font-medium hover:underline", g.titleCls)}
                    >
                      {isOpen ? "Show less" : "View all"} <ArrowRight size={13} className={isOpen ? "-rotate-90" : ""} />
                    </button>
                  )}
                </div>
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {shown.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      group={g}
                      gridCols={gridCols}
                      showCompany={!oneCompany}
                      showBdo={!isBdo}
                      companyName={t.company ? (byKey[t.company]?.name ?? t.company) : ""}
                      onToggle={() => toggleMutation.mutate({ task: t, status: t.status === "COMPLETED" ? "PENDING" : "COMPLETED" })}
                      onEdit={() => openEdit(t)}
                      onDelete={() => askDelete(t)}
                      onLogResult={() => setPrompt(t)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {showForm && (
        <TaskFormModal
          task={editing}
          bdos={bdos}
          clients={clients}
          allTasks={data}
          isBdo={!!isBdo}
          oneCompany={oneCompany}
          myBdoId={myBdoId}
          defaultType={isProposalView ? "PROPOSAL" : "TASK"}
          onClose={() => setShowForm(false)}
          onSaved={(saved, justCompleted) => {
            setShowForm(false);
            refresh();
            // Finishing work that is linked to a manual KPI: ask whether it produced a result.
            if (justCompleted && saved.kpi && saved.kpi.source !== "AUTO") setPrompt(saved);
          }}
        />
      )}
      {prompt && <ResultPrompt task={prompt} onClose={() => setPrompt(null)} onDone={() => { setPrompt(null); refresh(); }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Result prompt and add / edit popup                                  */
/* ------------------------------------------------------------------ */

// "Add a KPI result?" when linked work is finished. A prompt, not automatic: finished work is
// not always a result (a proposal sent is not a deal closed).
function ResultPrompt({ task, onClose, onDone }: { task: Task; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const k = task.kpi!;
  const row = { definition: { id: k.id, metric: k.metric, unit: k.unit, source: k.source }, aggregation: k.aggregation ?? "SUM", bdoId: task.bdoId } as unknown as KpiRow;
  const dismiss = async () => {
    setBusy(true);
    try { await api.post(`/tasks/${task.id}/dismiss-result`); onDone(); } catch { setBusy(false); }
  };
  return (
    <KpiSheet
      title={`Add a result for ${k.metric}?`}
      subtitle={<>“{task.deliverable}” is done. If it produced a result, log it — it will be linked to this task{task.approval === "PENDING" ? " and counts once the task is approved" : ""}.</>}
      onClose={onClose}
      footer={<button onClick={dismiss} disabled={busy} className="px-4 py-2 text-sm text-foreground rounded-lg border border-border hover:bg-primary/5 disabled:opacity-50">No result to log</button>}
    >
      <LogResult row={row} bdoId={task.bdoId} tasks={[{ id: task.id, deliverable: task.deliverable }]} defaultTaskId={task.id} onSaved={onDone} />
    </KpiSheet>
  );
}

// Work staff finished, waiting for a manager. Approving makes its money, its "on time" count and
// the results logged from it count; rejecting sends it back with the reason (or, for a change to
// already-approved work, keeps the approved version).
function ApprovalsList({ tasks, oneCompany, companyName, onChanged }: {
  tasks: ApprovalTask[]; oneCompany: boolean; companyName: (key: string) => string; onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const review = async (t: ApprovalTask, action: "approve" | "reject") => {
    setBusy(t.id);
    try {
      await api.post(`/tasks/${t.id}/${action}`, action === "reject" ? { reason } : {});
      setRejecting(null); setReason("");
      onChanged();
    } catch (err) {
      window.alert(apiError(err, `Couldn't ${action} the task.`));
    } finally { setBusy(null); }
  };

  if (!tasks.length) {
    return (
      <div className="relative bg-white/90 border border-gray-200/80 rounded-2xl shadow-sm py-14 text-center text-sm text-gray-500">
        Nothing waiting for approval.
      </div>
    );
  }
  return (
    <div className="relative space-y-3">
      {tasks.map((t) => {
        const money = t.revenueActual ? `${t.currency && t.currency !== "GHS" ? t.currency : "GHS"} ${t.revenueActual.toLocaleString()}` : null;
        return (
          <section key={t.id} className="bg-white/90 border border-gray-200/80 rounded-2xl shadow-sm p-4 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{t.deliverable}</p>
                <p className="text-xs text-gray-500">
                  {t.bdo?.name ?? "Unassigned"}{!oneCompany && t.company ? ` · ${companyName(t.company)}` : ""}
                  {t.completedAt ? ` · done ${fmtDate(t.completedAt)}` : ""}
                  {t.targetDate ? ` · due ${fmtDate(t.targetDate)}` : ""}
                  {t.approvedAt ? " · change to approved work" : ""}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { setRejecting(rejecting === t.id ? null : t.id); setReason(""); }}
                  disabled={busy === t.id}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => review(t, "approve")}
                  disabled={busy === t.id}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {busy === t.id ? "Saving…" : "Approve"}
                </button>
              </div>
            </div>
            <ul className="text-xs text-gray-600 space-y-0.5">
              {t.kpi && <li><Target size={11} className="inline text-accent mr-1" />KPI: {t.kpi.metric}</li>}
              {t.deal && <li>Deal: {t.deal.name}{money ? ` · brought in ${money}` : ""}</li>}
              {!t.deal && money && <li>Brought in {money}</li>}
              {t.pendingResults.map((r, i) => (
                <li key={i}>Result logged: {r.value.toLocaleString()} on {fmtDate(r.date)}{r.note ? ` — ${r.note}` : ""}</li>
              ))}
              {t.completionCriteria && <li>Done when: {t.completionCriteria}</li>}
              {t.notes && <li className="text-gray-500">Notes: {t.notes}</li>}
            </ul>
            {rejecting === t.id && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why? They'll see this so they know what to fix."
                  maxLength={500}
                  className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
                <button
                  onClick={() => review(t, "reject")}
                  disabled={busy === t.id || !reason.trim()}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:opacity-90 disabled:opacity-50"
                >
                  Send back
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Trunqo design tokens for the task popup — same as the KPI and Team & Access popups.
const inputClass = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent";
const labelClass = "text-xs font-medium text-muted block mb-1";

function TaskFormModal({ task, bdos, clients, allTasks, isBdo, oneCompany, myBdoId, defaultType, onClose, onSaved }: {
  task: Task | null;
  bdos: Bdo[];
  clients: ClientOption[];
  allTasks: Task[];
  isBdo: boolean;
  oneCompany: boolean;
  myBdoId: string | null;
  defaultType: "TASK" | "PROPOSAL";
  onClose: () => void;
  onSaved: (saved: Task, justCompleted: boolean) => void;
}) {
  const { companies } = useCompanies();
  const { user } = useAuth();
  const ownCompany = oneCompany ? (user?.bdoCompany ?? null) : null;
  const [form, setForm] = useState({
    year: task?.year ?? new Date().getFullYear(),
    priority: task?.priority ?? "MEDIUM",
    deliverable: task?.deliverable ?? "",
    targetDate: task?.targetDate ? task.targetDate.slice(0, 10) : "",
    startDate: task?.startDate ? task.startDate.slice(0, 10) : "",
    status: task?.status === "OVERDUE" ? "PENDING" : task?.status ?? "PENDING",
    company: task?.company ?? ownCompany ?? "TRADELINE",
    bdoId: task?.bdoId ?? "",
    notes: task?.notes ?? "",
    type: task?.type ?? defaultType,
    smeId: task?.smeId ?? "",
    clientName: task?.clientName ?? "",
    proposalValueGhs: task?.proposalValueGhs != null ? String(task.proposalValueGhs) : "",
    outcome: task?.outcome ?? "DRAFT",
    kpiId: task?.kpiId ?? "",
    completionCriteria: task?.completionCriteria ?? "",
    dependsOn: task?.dependsOn ?? [] as string[],
    expenseActual: task?.expenseActual != null ? String(task.expenseActual) : "",
    revenueActual: task?.revenueActual != null ? String(task.revenueActual) : "",
    currency: task?.currency ?? "GHS",
    exchangeRate: task?.exchangeRate && task.exchangeRate !== 1 ? String(task.exchangeRate) : "",
    dealId: task?.dealId ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showMoney, setShowMoney] = useState(!!(task?.expenseActual || task?.revenueActual));
  const set = (k: string, v: string | number | string[]) => setForm((f) => ({ ...f, [k]: v }));
  const isProposal = form.type === "PROPOSAL";
  const assignee = isBdo ? myBdoId : (form.bdoId || null);

  // KPIs this work can serve: the assignee's own, their scorecard, and their company's.
  const { data: linkable = [] } = useQuery<Linkable[]>({
    queryKey: ["kpi-linkable", assignee ?? "", form.company],
    queryFn: () => fetcher(`/kpi-framework/linkable?${new URLSearchParams({ ...(assignee ? { bdoId: assignee } : {}), company: form.company })}`),
  });
  const groups: [string, Linkable[]][] = [
    ["Their KPIs", linkable.filter((k) => k.kind === "PERSONAL")],
    ["Scorecard", linkable.filter((k) => k.kind === "SCORECARD")],
    ["Company KPIs", linkable.filter((k) => k.kind === "COMPANY")],
  ];
  // Deals in the task's company this work can be for (the ones the person can see).
  const { data: dealOpts = [] } = useQuery<DealOption[]>({
    queryKey: ["task-deal-options", form.company],
    queryFn: () => fetcher(`/tasks/deal-options?company=${encodeURIComponent(form.company)}`),
    enabled: !!form.company,
  });
  const linkedDeal = dealOpts.find((d) => d.id === form.dealId) ?? (task?.deal && task.deal.id === form.dealId ? task.deal : null);
  const depChoices = allTasks.filter((t) => t.id !== task?.id && t.type === "TASK" && t.status !== "CANCELLED");

  const save = async () => {
    if (!form.deliverable.trim()) { setError(`A ${isProposal ? "proposal title" : "task / deliverable"} is required.`); return; }
    if (!isProposal) {
      if (!form.startDate || !form.targetDate) { setError("Enter a start date and an end date."); return; }
      if (form.targetDate < form.startDate) { setError("The end date cannot be before the start date."); return; }
    }
    setSaving(true); setError("");
    const body = {
      year: form.year,
      priority: form.priority,
      deliverable: form.deliverable,
      status: form.status,
      company: form.company,
      notes: form.notes || null,
      targetDate: form.targetDate || null,
      startDate: form.startDate || null,
      bdoId: assignee,
      type: form.type,
      smeId: isProposal ? (form.smeId || null) : null,
      clientName: isProposal ? (form.clientName || null) : null,
      proposalValueGhs: isProposal && form.proposalValueGhs ? Number(form.proposalValueGhs) : null,
      outcome: isProposal ? form.outcome : null,
      kpiId: form.kpiId || null,
      completionCriteria: form.completionCriteria || null,
      dependsOn: form.dependsOn,
      expenseActual: form.expenseActual === "" ? null : Number(form.expenseActual),
      revenueActual: form.revenueActual === "" ? null : Number(form.revenueActual),
      currency: form.currency,
      exchangeRate: form.currency === "GHS" ? 1 : Number(form.exchangeRate) || null,
      dealId: form.dealId || null,
    };
    try {
      const res = task ? await api.put(`/tasks/${task.id}`, body) : await api.post("/tasks", body);
      const saved = res.data as Task;
      const kpi = saved.kpi ?? (linkable.find((k) => k.id === saved.kpiId) ? { ...linkable.find((k) => k.id === saved.kpiId)!, aggregation: null } as TaskKpi : null);
      onSaved({ ...saved, kpi, bdoId: saved.bdoId ?? assignee }, form.status === "COMPLETED" && task?.status !== "COMPLETED");
    } catch (err) {
      setError(apiError(err, "Failed to save."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <h2 className="font-serif text-lg text-foreground">{task ? "Edit" : "Add"} {isProposal ? "proposal" : "task"}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          <div>
            <label className={labelClass}>Type</label>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              {(["TASK", "PROPOSAL"] as const).map((t, i) => (
                <button key={t} type="button" onClick={() => set("type", t)}
                  className={clsx("flex-1 px-3 py-2 transition-colors", i > 0 && "border-l border-border", form.type === t ? "bg-primary text-accent-foreground" : "bg-background text-foreground/70 hover:bg-primary/5")}>
                  {t === "TASK" ? "Task" : "Proposal"}
                </button>
              ))}
            </div>
          </div>

          <div><label className={labelClass}>{isProposal ? "Proposal title" : "Task / deliverable"} *</label><textarea value={form.deliverable} onChange={(e) => set("deliverable", e.target.value)} rows={2} className={inputClass + " resize-none"} /></div>

          {isProposal && (
            <>
              <ClientSelect
                label="Client"
                value={form.smeId}
                options={clients}
                fallbackLabel={form.clientName || undefined}
                onChange={(id) => {
                  const c = clients.find((o) => o.id === id);
                  setForm((f) => ({ ...f, smeId: id, clientName: c?.companyName ?? f.clientName }));
                }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={labelClass}>Proposal value (GHS)</label><input type="number" min="0" value={form.proposalValueGhs} onChange={(e) => set("proposalValueGhs", e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Outcome</label><select value={form.outcome} onChange={(e) => set("outcome", e.target.value)} className={inputClass}>{OUTCOME_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!oneCompany && (
              <div><label className={labelClass}>Company</label><select value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value, kpiId: "", dealId: "" }))} className={inputClass}>{companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></div>
            )}
            {!isBdo && (
              <div><label className={labelClass}>Owner</label><select value={form.bdoId} onChange={(e) => setForm((f) => ({ ...f, bdoId: e.target.value, kpiId: "" }))} className={inputClass}><option value="">— Unassigned —</option>{bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}</select></div>
            )}
          </div>

          {/* The result this work moves */}
          <div>
            <label className={labelClass}>KPI it moves</label>
            <select value={form.kpiId} onChange={(e) => set("kpiId", e.target.value)} className={inputClass}>
              <option value="">— Not linked to a KPI —</option>
              {groups.filter(([, ks]) => ks.length).map(([label, ks]) => (
                <optgroup key={label} label={label}>
                  {ks.map((k) => <option key={k.id} value={k.id}>{k.metric}{k.source === "AUTO" ? " (auto)" : ""}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* The deal this work is for — money brought in lands on it as a payment */}
          <div>
            <label className={labelClass}>Deal it&apos;s for</label>
            <select value={form.dealId} onChange={(e) => set("dealId", e.target.value)} className={inputClass}>
              <option value="">— Not linked to a deal —</option>
              {linkedDeal && !dealOpts.some((d) => d.id === linkedDeal.id) && <option value={linkedDeal.id}>{linkedDeal.name}</option>}
              {dealOpts.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.stage.replace(/_/g, " ").toLowerCase()}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Priority</label><select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={inputClass}>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className={labelClass}>Status</label><select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputClass}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelClass}>Start date{isProposal ? "" : " *"}</label><input type="date" required={!isProposal} value={form.startDate} max={form.targetDate || undefined} onChange={(e) => set("startDate", e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>{isProposal ? "Due / sent date" : "End date *"}</label><input type="date" required={!isProposal} value={form.targetDate} min={isProposal ? undefined : form.startDate || undefined} onChange={(e) => set("targetDate", e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Year</label><input type="number" value={form.year} onChange={(e) => set("year", parseInt(e.target.value))} className={inputClass} /></div>
          </div>

          <div><label className={labelClass}>Done when <span className="text-muted/60">(completion criteria)</span></label><input value={form.completionCriteria} onChange={(e) => set("completionCriteria", e.target.value)} className={inputClass} placeholder="e.g. Proposal sent and receipt confirmed by the client" /></div>

          {depChoices.length > 0 && (
            <div>
              <label className={labelClass}>Waits on <span className="text-muted/60">(shows as Blocked until these are done)</span></label>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
                {depChoices.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-primary/[0.03]">
                    <input type="checkbox" checked={form.dependsOn.includes(t.id)} className="accent-[var(--color-accent)]"
                      onChange={(e) => set("dependsOn", e.target.checked ? [...form.dependsOn, t.id] : form.dependsOn.filter((x) => x !== t.id))} />
                    <span className="flex-1 truncate text-foreground">{t.deliverable}</span>
                    <span className="text-[11px] text-muted">{t.status === "COMPLETED" ? "done" : t.bdo?.name ?? ""}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <button type="button" onClick={() => setShowMoney((s) => !s)} className="text-xs text-accent hover:underline">{showMoney ? "Hide" : "Add"} money spent / brought in</button>
            {showMoney && (
              <div className="mt-2 space-y-1.5">
                <div className={clsx("grid gap-3", form.currency === "GHS" ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
                  <div><label className={labelClass}>Spent</label><input type="number" min="0" value={form.expenseActual} onChange={(e) => set("expenseActual", e.target.value)} className={inputClass} /></div>
                  <div>
                    <label className={labelClass}>Brought in</label>
                    <input type="number" min="0" value={form.revenueActual} onChange={(e) => set("revenueActual", e.target.value)} disabled={!form.dealId && !form.revenueActual} className={inputClass + " disabled:opacity-50"} />
                  </div>
                  <div><label className={labelClass}>Currency</label><select value={form.currency} onChange={(e) => set("currency", e.target.value)} className={inputClass}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
                  {form.currency !== "GHS" && (
                    <div><label className={labelClass}>Rate to GHS</label><input type="number" min="0" step="any" value={form.exchangeRate} onChange={(e) => set("exchangeRate", e.target.value)} className={inputClass} placeholder="e.g. 15.2" /></div>
                  )}
                </div>
                <p className="text-[11px] text-muted">
                  {form.dealId
                    ? `When the task is marked Completed${isBdo ? " and your Business CEO approves it" : ""}, the money brought in is recorded as a payment on ${linkedDeal?.name ?? "the deal"} and counts toward revenue received for the deal, the people on it, the company and the Group. Reopening the task takes it back off.`
                    : "Link the deal this money came from (above) to record money brought in. It then counts as revenue received."}
                </p>
              </div>
            )}
          </div>

          <div><label className={labelClass}>Notes</label><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={inputClass + " resize-none"} /></div>
          {error && <p className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-foreground rounded-lg border border-border hover:bg-primary/5 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
