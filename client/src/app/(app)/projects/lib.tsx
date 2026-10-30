"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

// What the projects API returns (server/src/routes/projects.ts). Managers also get each member's
// contact details and whether they've signed in; everyone else just who's on it.
export type ProjectMember = {
  bdoId: string;
  role: "LEAD" | "MEMBER";
  name: string;
  title: string | null;
  company: string | null;
  external: boolean;
  email?: string | null;
  phone?: string | null;
  login?: "ACTIVE" | "PENDING" | "NONE";
};

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  company: string;
  description: string | null;
  notes?: string | null;
  startDate: string | null;
  endDate: string | null;
  leader?: string | null;
  members: ProjectMember[];
  lead: { bdoId: string; name: string | null } | null;
  myRole: "LEAD" | "MEMBER" | null;
  canManage: boolean;
  canDelete: boolean;
  tasks: { total: number; open: number; overdue: number; done: number; awaitingApproval: number };
};

export type Person = { id: string; name: string; title: string | null; company: string; external: boolean };

export const PROJECT_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const STATUS_LABEL: Record<ProjectStatus, string> = { ACTIVE: "Active", ON_HOLD: "On hold", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const STATUS_STYLE: Record<ProjectStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-700",
  ON_HOLD: "bg-amber-500/10 text-amber-700",
  COMPLETED: "bg-sky-500/10 text-sky-700",
  CANCELLED: "bg-foreground/[0.06] text-muted",
};
export const isClosed = (p: Pick<Project, "status">) => p.status === "COMPLETED" || p.status === "CANCELLED";

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return <span className={clsx("inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

export function OutsiderTag() {
  return <span className="inline-block rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700 whitespace-nowrap" title="Not staff of any company. Sees only the projects they're on.">Outside collaborator</span>;
}

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

export function Avatar({ name, external, size = "h-8 w-8 text-xs" }: { name: string; external?: boolean; size?: string }) {
  return (
    <span className={clsx("grid shrink-0 place-items-center rounded-full font-semibold", size, external ? "bg-violet-500/15 text-violet-700" : "bg-foreground/[0.07] text-foreground/80")} title={name}>
      {initials(name)}
    </span>
  );
}

export const fmtDay = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" }) : null;

export const dateRange = (p: Pick<Project, "startDate" | "endDate">) => {
  const a = fmtDay(p.startDate), b = fmtDay(p.endDate);
  return a && b ? `${a} to ${b}` : a ? `From ${a}` : b ? `Until ${b}` : null;
};

// Form controls, matching the task and KPI sheets.
export const inputClass =
  "w-full bg-background border border-transparent rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors";
export const primaryBtn =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity";
export const secondaryBtn =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-foreground hover:bg-primary/5 transition-colors";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}
        {hint && <span className="font-normal text-muted"> {hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <p role="alert" className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-xl">{message}</p>;
}

export function apiError(err: unknown, fallback: string) {
  const m = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof m === "string" && m.trim() ? m : fallback;
}
