import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock,
  FileText,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type TaskKpi = { id: string; metric: string; source: string; unit: string; aggregation: "SUM" | "LATEST" | "AVERAGE" | null };

export type Task = {
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
  // Optional: if your API ever returns a category it is used, otherwise it is inferred from the title.
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
  // The project this work belongs to (its members can all see it).
  projectId?: string | null;
  project?: { id: string; name: string; status: string; company: string } | null;
  // Approval: work staff finish counts toward KPIs only once their Business CEO or the Group
  // Owner approves it. approvedAt set + PENDING = a change to approved work is waiting.
  approval: "PENDING" | "APPROVED" | "REJECTED" | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByEmail: string | null;
  rejectedReason: string | null;
  rejectedByEmail: string | null;
  // Links and files that go with the work. Files are stored in Cloudinary.
  attachments?: TaskAttachment[];
};

export type TaskAttachment = {
  kind: "LINK" | "FILE";
  name: string;
  url: string;
  publicId?: string | null;
  resourceType?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  addedAt?: string;
};

export const fmtFileSize = (n?: number | null) =>
  !n ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;

// A task waiting for approval, with the results its owner logged from it.
export type ApprovalTask = Task & { pendingResults: { value: number; date: string; note: string | null }[] };

// Whether a completed task's money and results count yet.
export const counts = (t: Task) => t.status === "COMPLETED" && (t.approval !== "PENDING" || !!t.approvedAt) && t.approval !== "REJECTED";

export type DealOption = { id: string; source: string; name: string; stage: string; receivedGhs: number };
export type Bdo = { id: string; name: string; company: string };
export type Linkable = { id: string; metric: string; company: string; source: string; unit: string; kind: "PERSONAL" | "SCORECARD" | "COMPANY" | "PROJECT" };

// The project a task is being added to or edited in: who can own it and who runs it.
export type TaskProject = {
  id: string;
  name: string;
  company: string;
  members: { bdoId: string; name: string; external: boolean }[];
  canManage: boolean;
};

export type TabKey = "all" | "mine" | "overdue" | "week" | "proposals" | "approvals";
export type SortKey = "soonest" | "latest" | "priority";
export type GroupKey = "overdue" | "blocked" | "progress" | "todo" | "done";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const OUTCOME_OPTS = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "NO_RESPONSE"] as const;
export const OUTCOME_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  NO_RESPONSE: "No response",
};
export const OUTCOME_COLORS: Record<string, string> = {
  DRAFT: "bg-subtle text-muted",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  NO_RESPONSE: "bg-amber-100 text-amber-700",
};

// Lowest to highest, so the picker reads naturally.
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const PRIORITY_LABEL: Record<string, string> = { URGENT: "Urgent", HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
export const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
export const PRIORITY_STYLES: Record<string, string> = {
  URGENT: "bg-red-600 text-white",
  HIGH: "bg-red-50 text-red-600",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-sky-50 text-sky-600",
};

export const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const FILTER_STATUSES = ["PENDING", "IN_PROGRESS", "BLOCKED", "OVERDUE", "COMPLETED", "CANCELLED"] as const;
export const STATUS_LABEL: Record<string, string> = {
  PENDING: "To do",
  IN_PROGRESS: "In progress",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
  OVERDUE: "Overdue",
  BLOCKED: "Blocked",
};
export const STATUS_STYLES: Record<string, string> = {
  IN_PROGRESS: "bg-blue-50 text-blue-600",
  PENDING: "bg-amber-50 text-amber-600",
  COMPLETED: "bg-green-50 text-green-700",
  OVERDUE: "bg-red-50 text-red-600",
  BLOCKED: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-subtle text-muted",
};

export const CURRENCIES = ["GHS", "USD", "EUR", "NGN", "RWF"];
export const COLLAPSED_ROWS = 4;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const fmt = (n: number) => `GHS ${n.toLocaleString()}`;
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export const startOfToday = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

// yyyy-mm-dd in the person's own timezone (toISOString would shift the day for some people).
export const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const inDays = (n: number) => {
  const d = startOfToday();
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
};

export const isClosed = (t: Task) => ["COMPLETED", "CANCELLED"].includes(t.status);

export const dueTime = (t: Task) => {
  if (!t.targetDate) return null;
  const d = new Date(t.targetDate);
  return isNaN(d.getTime()) ? null : d;
};

export function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

// The server works out Overdue from the due date; the date check is a fallback.
export const isOverdue = (t: Task) => {
  if (isClosed(t)) return false;
  if (t.overdue || t.status === "OVERDUE") return true;
  const d = dueTime(t);
  return !!d && d < startOfToday();
};

export const isUpcoming = (t: Task, days: number) => {
  const d = dueTime(t);
  if (!d || isClosed(t)) return false;
  const s = startOfToday();
  const e = new Date(s);
  e.setDate(e.getDate() + days + 1);
  return d >= s && d < e;
};

export const isDueThisWeek = (t: Task) => {
  const d = dueTime(t);
  if (!d || isClosed(t)) return false;
  const s = startOfToday();
  const e = new Date(s);
  e.setDate(e.getDate() + ((7 - s.getDay()) % 7) + 1); // end of this Sunday
  return d >= s && d < e;
};

export const groupOf = (t: Task): GroupKey =>
  isClosed(t) ? "done" : isOverdue(t) ? "overdue" : t.blocked ? "blocked" : t.status === "IN_PROGRESS" ? "progress" : "todo";

export const shownStatus = (t: Task) => (isClosed(t) ? t.status : t.blocked ? "BLOCKED" : isOverdue(t) ? "OVERDUE" : t.status);

/* ------------------------------------------------------------------ */
/* Categories and groups                                               */
/* ------------------------------------------------------------------ */

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Deliverable: FileText,
  Meeting: Users,
  Submission: FileText,
  Hiring: User,
  Review: FileText,
  Testing: ClipboardCheck,
};

export const categoryOf = (t: Task): string => {
  if (t.category && CATEGORY_ICONS[t.category]) return t.category;
  const s = t.deliverable.toLowerCase();
  if (/\bmeet|call with|catch ?up/.test(s)) return "Meeting";
  if (/recruit|hire|hiring|interview/.test(s)) return "Hiring";
  if (/submit|submission|proposal|expression of interest|\beoi\b|tender/.test(s)) return "Submission";
  if (/review|revisit|audit/.test(s)) return "Review";
  if (/\btest/.test(s)) return "Testing";
  return "Deliverable";
};

export const GROUPS: {
  key: GroupKey;
  title: string;
  Icon: LucideIcon;
  header: string;
  iconWrap: string;
  titleCls: string;
  rowIcon: string;
}[] = [
  { key: "overdue",  title: "Overdue",     Icon: AlertCircle,  header: "bg-gradient-to-r from-red-50 to-transparent",     iconWrap: "bg-red-500 text-white",     titleCls: "text-red-600",     rowIcon: "bg-red-50 text-red-500" },
  { key: "blocked",  title: "Blocked",     Icon: Ban,          header: "bg-gradient-to-r from-amber-50 to-transparent",   iconWrap: "bg-amber-500 text-white",   titleCls: "text-amber-700",   rowIcon: "bg-amber-50 text-amber-600" },
  { key: "progress", title: "In progress", Icon: Clock,        header: "bg-gradient-to-r from-green-50 to-transparent",   iconWrap: "bg-green-600 text-white",   titleCls: "text-green-700",   rowIcon: "bg-green-50 text-green-600" },
  { key: "todo",     title: "To do",       Icon: Circle,       header: "bg-gradient-to-r from-subtle to-transparent",     iconWrap: "bg-muted text-white",       titleCls: "text-foreground",  rowIcon: "bg-subtle text-muted" },
  { key: "done",     title: "Done",        Icon: CheckCircle2, header: "bg-gradient-to-r from-emerald-50 to-transparent", iconWrap: "bg-emerald-600 text-white", titleCls: "text-emerald-700", rowIcon: "bg-emerald-50 text-emerald-600" },
];

export type TaskGroup = (typeof GROUPS)[number];