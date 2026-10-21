import { isManager, type AuthUser } from "@/lib/auth";

export const PAGE_SIZE = 100;
// Used to turn a local number like 024… into a WhatsApp link. Change for another market.
const DEFAULT_COUNTRY_CODE = "233";

export type Lead = {
  id: string; bizId: string | null; businessName: string; email: string | null; phone: string | null;
  contactPerson: string | null; roleTitle: string | null; status: string; source: string | null;
  bdoId: string | null; bdo: { id: string; name: string } | null; priority: string | null;
  dateAdded: string | null; followUpDate: string | null; notes: string | null;
  visibility: "PRIVATE" | "PUBLIC" | null; smeId: string | null; convertedAt: string | null; archivedAt: string | null;
};
export type BdoOption = { id: string; name: string; company: string };

export const STATUS_LIST = ["NEW", "CONTACTED", "QUALIFIED", "IN_PROGRESS", "CONVERTED", "LOST"] as const;
// A lead only reaches CONVERTED through "Convert to customer", never by picking the stage.
export const EDITABLE_STATUSES = STATUS_LIST.filter((s) => s !== "CONVERTED");
export const STATUS_LABEL: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", IN_PROGRESS: "In progress", CONVERTED: "Converted", LOST: "Lost",
};
// Tinted pills, so 100+ rows don't read as a colour chart.
export const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-foreground/5 text-foreground",
  CONTACTED: "bg-sky-500/10 text-sky-700",
  QUALIFIED: "bg-accent/10 text-accent",
  IN_PROGRESS: "bg-amber-500/10 text-amber-700",
  CONVERTED: "bg-emerald-500/10 text-emerald-700",
  LOST: "bg-red-500/10 text-red-700",
};
export const STATUS_BAR: Record<string, string> = {
  NEW: "bg-foreground/30", CONTACTED: "bg-sky-500", QUALIFIED: "bg-accent", IN_PROGRESS: "bg-amber-500", CONVERTED: "bg-emerald-500", LOST: "bg-red-400",
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

// ─── Dates ──────────────────────────────────────────────────────────────────
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

// "Today", "In 3 days", "2 days overdue". Today is not overdue.
export function followUpInfo(value: string | null): { text: string; tone: "late" | "soon" | "ok" } | null {
  if (!value) return null;
  const d = new Date(value);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { text: `${-days} day${days === -1 ? "" : "s"} overdue`, tone: "late" };
  if (days === 0) return { text: "Today", tone: "soon" };
  if (days === 1) return { text: "Tomorrow", tone: "soon" };
  if (days <= 7) return { text: `In ${days} days`, tone: "ok" };
  return { text: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }), tone: "ok" };
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
    dateAdded: f.dateAdded || null, followUpDate: f.followUpDate || null, notes: f.notes || null,
  };
  // Staff always own their leads — the server assigns them, so don't send a pick.
  if (!canAssign) delete body.bdoId;
  return body;
}
