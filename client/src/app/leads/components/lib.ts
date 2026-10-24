import { AlertCircle, CalendarDays, CalendarX, CheckCircle2, Clock, type LucideIcon } from "lucide-react";
import { isManager, type AuthUser } from "@/lib/auth";

export const PAGE_SIZE = 100;
// Used to turn a local number like 024… into a WhatsApp link. Change for another market.
const DEFAULT_COUNTRY_CODE = "233";

export type Lead = {
  id: string; bizId: string | null; businessName: string; email: string | null; phone: string | null;
  contactPerson: string | null; roleTitle: string | null; status: string; source: string | null;
  bdoId: string | null; bdo: { id: string; name: string } | null; priority: string | null;
  dateAdded: string | null; followUpDate: string | null; notes: string | null;
  /** When the record was created; stands in for dateAdded on older leads without one. */
  createdAt?: string;
  visibility: "PRIVATE" | "PUBLIC" | null; smeId: string | null; convertedAt: string | null; archivedAt: string | null;
};
export type BdoOption = { id: string; name: string; company: string };
export type Filters = { status: string; bdo: string; priority: string; source: string };
export type Scope = "all" | "mine" | "overdue" | "week" | "shared";

// ─── Stages ─────────────────────────────────────────────────────────────────
export const STATUS_LIST = ["NEW", "CONTACTED", "QUALIFIED", "IN_PROGRESS", "CONVERTED", "LOST"] as const;
// A lead only reaches CONVERTED through "Convert to customer", never by picking the stage.
export const EDITABLE_STATUSES = STATUS_LIST.filter((s) => s !== "CONVERTED");
export const STATUS_LABEL: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", IN_PROGRESS: "In progress", CONVERTED: "Converted", LOST: "Lost",
};
export const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-foreground/5 text-foreground/70",
  CONTACTED: "bg-sky-500/10 text-sky-700",
  QUALIFIED: "bg-violet-500/10 text-violet-700",
  IN_PROGRESS: "bg-amber-500/10 text-amber-700",
  CONVERTED: "bg-emerald-500/10 text-emerald-700",
  LOST: "bg-red-500/10 text-red-700",
};
// Ring colour and label colour for the stage cards (literal classes so Tailwind keeps them).
export const STAGE_RING: Record<string, string> = {
  NEW: "text-zinc-400", CONTACTED: "text-sky-500", QUALIFIED: "text-violet-500", IN_PROGRESS: "text-amber-500", CONVERTED: "text-emerald-500", LOST: "text-red-500",
};
export const STAGE_LABEL: Record<string, string> = {
  NEW: "text-foreground/70", CONTACTED: "text-sky-700", QUALIFIED: "text-violet-700", IN_PROGRESS: "text-amber-700", CONVERTED: "text-emerald-700", LOST: "text-red-700",
};

export const SOURCES = ["Database", "Referral", "Cold Call", "Event", "Social Media", "Website"];
export const PRIORITIES: [string, string][] = [["HIGH", "High"], ["MEDIUM", "Medium"], ["LOW", "Low"]];

export const SCOPE_NOTE = {
  GROUP_OWNER: "Every lead across all your businesses.",
  BUSINESS_CEO: "Every lead in your business. Private ones stay hidden from your team until you share them.",
  STAFF: "Your leads, plus any your Business CEO has shared with the team.",
};

// Mirrors the server (routes/leads.ts): staff edit only their own leads — a teammate's shared
// lead is read-only. Converted leads are archived and read-only for everyone.
export function canEditLead(user: AuthUser | null, lead: Lead) {
  if (!user || lead.archivedAt) return false;
  return isManager(user) || (!!user.bdoId && lead.bdoId === user.bdoId);
}

export function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

// ─── Dates ──────────────────────────────────────────────────────────────────
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

// Whole days from today: -2 is two days overdue, 0 is today.
export function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const d = new Date(value);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today.getTime()) / 86_400_000);
}

// "Today", "In 3 days", "2 days overdue". Today is not overdue.
export function followUpInfo(value: string | null): { text: string; tone: "late" | "soon" | "ok" } | null {
  const days = daysUntil(value);
  if (days === null) return null;
  if (days < 0) return { text: `${-days} day${days === -1 ? "" : "s"} overdue`, tone: "late" };
  if (days === 0) return { text: "Today", tone: "soon" };
  if (days === 1) return { text: "Tomorrow", tone: "soon" };
  if (days <= 7) return { text: `In ${days} days`, tone: "ok" };
  return { text: new Date(value!).toLocaleDateString(undefined, { day: "numeric", month: "short" }), tone: "ok" };
}

// ─── Grouping: what needs you first ─────────────────────────────────────────
export type GroupKey = "overdue" | "soon" | "later" | "none" | "closed";

export function groupOf(l: Lead): GroupKey {
  if (l.status === "CONVERTED" || l.status === "LOST" || l.archivedAt) return "closed";
  const d = daysUntil(l.followUpDate);
  if (d === null) return "none";
  if (d < 0) return "overdue";
  return d <= 7 ? "soon" : "later";
}

export const GROUPS: { key: GroupKey; title: string; Icon: LucideIcon; head: string; icon: string; text: string }[] = [
  { key: "overdue", title: "Overdue", Icon: AlertCircle, head: "bg-red-500/5", icon: "bg-red-500/10 text-red-600", text: "text-red-600" },
  { key: "soon", title: "Due this week", Icon: Clock, head: "", icon: "bg-amber-500/10 text-amber-600", text: "text-foreground" },
  { key: "later", title: "Coming up", Icon: CalendarDays, head: "", icon: "bg-foreground/5 text-foreground/70", text: "text-foreground" },
  { key: "none", title: "No follow-up yet", Icon: CalendarX, head: "", icon: "bg-foreground/5 text-foreground/70", text: "text-foreground" },
  { key: "closed", title: "Closed", Icon: CheckCircle2, head: "", icon: "bg-emerald-500/10 text-emerald-600", text: "text-foreground" },
];

// ─── Sorting ────────────────────────────────────────────────────────────────
export type SortKey = "soonest" | "newest" | "priority" | "name";
export const SORT_LABEL: Record<SortKey, string> = {
  soonest: "Soonest follow-up", newest: "Newest first", priority: "Highest priority", name: "Name A–Z",
};
const RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function sortLeads(rows: Lead[], key: SortKey) {
  const t = (v: string | null, empty: number) => (v ? new Date(v).getTime() : empty);
  return [...rows].sort((a, b) => {
    if (key === "name") return a.businessName.localeCompare(b.businessName);
    if (key === "priority") return (RANK[a.priority ?? ""] ?? 9) - (RANK[b.priority ?? ""] ?? 9);
    if (key === "newest") return t(b.dateAdded, 0) - t(a.dateAdded, 0);
    return t(a.followUpDate, Infinity) === t(b.followUpDate, Infinity) ? 0 : t(a.followUpDate, Infinity) < t(b.followUpDate, Infinity) ? -1 : 1;
  });
}

// ─── Contact links ──────────────────────────────────────────────────────────
export function whatsappLink(phone: string | null) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

// ─── Form ↔ API ─────────────────────────────────────────────────────────────
export type LeadForm = {
  businessName: string; contactPerson: string; roleTitle: string; email: string; phone: string;
  status: string; priority: string; source: string; followUpDate: string; notes: string; bdoId: string; dateAdded: string;
};
export const EMPTY_FORM: LeadForm = {
  businessName: "", contactPerson: "", roleTitle: "", email: "", phone: "",
  status: "NEW", priority: "MEDIUM", source: "", followUpDate: "", notes: "", bdoId: "", dateAdded: "",
};

export function leadToForm(l: Lead): LeadForm {
  return {
    businessName: l.businessName, contactPerson: l.contactPerson ?? "", roleTitle: l.roleTitle ?? "",
    email: l.email ?? "", phone: l.phone ?? "", status: l.status, priority: l.priority ?? "MEDIUM", source: l.source ?? "",
    followUpDate: l.followUpDate ? l.followUpDate.slice(0, 10) : "", notes: l.notes ?? "",
    bdoId: l.bdoId ?? "", dateAdded: l.dateAdded ? l.dateAdded.slice(0, 10) : "",
  };
}

export function formToBody(f: LeadForm, canAssign: boolean) {
  const body: Record<string, unknown> = {
    ...f,
    bdoId: f.bdoId || null, email: f.email || null, phone: f.phone || null, contactPerson: f.contactPerson || null,
    roleTitle: f.roleTitle || null, source: f.source || null, priority: f.priority || null,
    followUpDate: f.followUpDate || null, notes: f.notes || null,
  };
  // Staff always own their leads — the server assigns them, so don't send a pick.
  if (!canAssign) delete body.bdoId;
  // The server stamps the date a lead was added.
  delete body.dateAdded;
  return body;
}

// ─── Export ─────────────────────────────────────────────────────────────────
export function exportLeads(rows: Lead[]) {
  const head = ["Business", "Biz ID", "Contact", "Role", "Email", "Phone", "Stage", "Priority", "Follow up", "Owner", "Visibility", "Source", "Notes"];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [
    r.businessName, r.bizId, r.contactPerson, r.roleTitle, r.email, r.phone, STATUS_LABEL[r.status] ?? r.status, r.priority,
    r.followUpDate ? new Date(r.followUpDate).toLocaleDateString() : "", r.bdo?.name, r.visibility === "PUBLIC" ? "Shared" : "Private", r.source, r.notes,
  ].map(cell).join(","));
  const url = URL.createObjectURL(new Blob([[head.map(cell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
  Object.assign(document.createElement("a"), { href: url, download: `leads-${iso(new Date())}.csv` }).click();
  URL.revokeObjectURL(url);
}
