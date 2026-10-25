"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Target } from "lucide-react";
import { api } from "@/lib/api";
import { TaskEvidence } from "@/components/TaskEvidence";
import { plural } from "../format";
import { TabPanel } from "../TabPanel";
import type { CompanyMap, PendingApproval } from "../types";
import { SectionHeader } from "../ui";

const fmtDay = (d: string | null) => {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toLocaleDateString("en-GH", { month: "short", day: "numeric" });
};

const money = (t: PendingApproval) => (t.revenueActual ? `${t.currency && t.currency !== "GHS" ? t.currency : "GHS"} ${t.revenueActual.toLocaleString()}` : null);

// Approving moves KPIs, deal payments and alerts, so everything that reads them refreshes.
const AFFECTED = ["tasks", "my-kpis", "kpi-board", "kpi-cascade", "deal-payments", "tradeline", "bapx", "company-deals", "alerts", "executive-dashboard"];

/**
 * Work staff finished, waiting for the Group Owner (or their Business CEO). Approving makes its
 * money and results count; rejecting sends it back to In progress with the reason, or, for a
 * change to already-approved work, keeps the approved version.
 */
export function ApprovalsTab({ approvals, byKey }: { approvals: PendingApproval[]; byKey: CompanyMap }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const review = async (t: PendingApproval, action: "approve" | "reject") => {
    setBusy(t.id);
    setError(null);
    try {
      await api.post(`/tasks/${t.id}/${action}`, action === "reject" ? { reason } : {});
      setRejecting(null);
      setReason("");
      for (const key of AFFECTED) qc.invalidateQueries({ queryKey: [key] });
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? `Couldn't ${action} the task.`;
      setError({ id: t.id, message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <TabPanel className="space-y-4">
      <SectionHeader
        icon={ClipboardCheck}
        label="Waiting for your approval"
        aside={approvals.length ? `${plural(approvals.length, "task")} · oldest first` : undefined}
      />

      {approvals.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">
          Nothing waiting for approval.
        </div>
      ) : (
        <ul className="space-y-3">
          {approvals.map((t) => {
            const m = money(t);
            const done = fmtDay(t.completedAt);
            const due = fmtDay(t.targetDate);
            const isBusy = busy === t.id;
            return (
              <li key={t.id} className="rounded-2xl border border-border bg-surface px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{t.deliverable}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {t.bdo?.name ?? "Unassigned"}
                      {t.company ? ` · ${byKey[t.company]?.name ?? t.company}` : ""}
                      {done ? ` · done ${done}` : ""}
                      {due ? ` · due ${due}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {t.approvedAt && (
                      <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Change to approved work
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setRejecting(rejecting === t.id ? null : t.id); setReason(""); }}
                      disabled={isBusy}
                      className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => review(t, "approve")}
                      disabled={isBusy}
                      className="rounded-full bg-accent px-3.5 py-1 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {isBusy && rejecting !== t.id ? "Saving…" : "Approve"}
                    </button>
                  </div>
                </div>

                {(t.kpi || t.deal || m || t.pendingResults.length > 0 || t.completionCriteria || t.notes) && (
                  <ul className="mt-3 space-y-1 border-t border-border/70 pt-3 text-xs text-muted">
                    {t.kpi && (
                      <li className="flex items-center gap-1.5">
                        <Target size={12} className="text-accent" />
                        <span>KPI: <span className="text-foreground">{t.kpi.metric}</span></span>
                      </li>
                    )}
                    {t.deal && <li>Deal: <span className="text-foreground">{t.deal.name}</span>{m ? ` · brought in ${m}` : ""}</li>}
                    {!t.deal && m && <li>Brought in <span className="text-foreground">{m}</span></li>}
                    {t.pendingResults.map((r, i) => (
                      <li key={i}>Result logged: <span className="text-foreground tabular-nums">{r.value.toLocaleString()}</span>{fmtDay(r.date) ? ` on ${fmtDay(r.date)}` : ""}{r.note ? ` · ${r.note}` : ""}</li>
                    ))}
                    {t.completionCriteria && <li>Done when: {t.completionCriteria}</li>}
                    {t.notes && <li>Notes: {t.notes}</li>}
                  </ul>
                )}

                <div className="mt-3">
                  <TaskEvidence items={t.attachments} />
                </div>

                {rejecting === t.id && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      autoFocus
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && reason.trim()) review(t, "reject"); }}
                      placeholder="Why? They'll see this so they know what to fix."
                      maxLength={500}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <button
                      type="button"
                      onClick={() => review(t, "reject")}
                      disabled={isBusy || !reason.trim()}
                      className="rounded-lg border border-accent/30 bg-accent/[0.08] px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                    >
                      {isBusy ? "Sending…" : "Send back"}
                    </button>
                  </div>
                )}

                {error?.id === t.id && <p className="mt-2 text-xs font-medium text-accent">{error.message}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted">
        Approved work counts toward KPIs, deal payments and revenue. Full task details are on{" "}
        <Link href="/tasks?view=approvals" className="font-medium text-accent hover:underline">the Tasks page</Link>.
      </p>
    </TabPanel>
  );
}
