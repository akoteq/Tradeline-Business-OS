"use client";

import { useState } from "react";
import { ClipboardCheck, Target } from "lucide-react";
import { api } from "@/lib/api";
import { apiError, fmtDate, type ApprovalTask } from "./task-utils";
import { TaskEvidence } from "@/components/TaskEvidence";

/**
 * Work staff finished, waiting for a manager. Approving makes its money, its "on time" count and
 * the results logged from it count; rejecting sends it back with the reason (or, for a change to
 * already-approved work, keeps the approved version).
 */
export function ApprovalsList({ tasks, oneCompany, companyName, onChanged }: {
  tasks: ApprovalTask[];
  oneCompany: boolean;
  companyName: (key: string) => string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const review = async (t: ApprovalTask, action: "approve" | "reject") => {
    setBusy(t.id);
    setError(null);
    try {
      await api.post(`/tasks/${t.id}/${action}`, action === "reject" ? { reason } : {});
      setRejecting(null);
      setReason("");
      onChanged();
    } catch (err) {
      setError({ id: t.id, message: apiError(err, `Couldn't ${action} the task.`) });
    } finally {
      setBusy(null);
    }
  };

  if (!tasks.length) {
    return (
      <div className="bg-surface border border-border rounded-xl shadow-card px-5 py-12 flex flex-col items-center text-center gap-1.5">
        <div className="w-10 h-10 rounded-full bg-subtle text-muted flex items-center justify-center mb-1">
          <ClipboardCheck size={18} strokeWidth={1.75} />
        </div>
        <p className="text-sm font-medium text-foreground">Nothing waiting for approval</p>
        <p className="text-sm text-muted max-w-sm">When your team marks work done, it shows up here for you to approve.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((t) => {
        const money = t.revenueActual ? `${t.currency && t.currency !== "GHS" ? t.currency : "GHS"} ${t.revenueActual.toLocaleString()}` : null;
        const isBusy = busy === t.id;
        return (
          <section key={t.id} className="bg-surface border border-border rounded-xl shadow-card p-4 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{t.deliverable}</p>
                <p className="text-xs text-muted">
                  {t.bdo?.name ?? "Unassigned"}{!oneCompany && t.company ? ` · ${companyName(t.company)}` : ""}
                  {t.completedAt ? ` · done ${fmtDate(t.completedAt)}` : ""}
                  {t.targetDate ? ` · due ${fmtDate(t.targetDate)}` : ""}
                  {t.approvedAt ? " · change to approved work" : ""}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { setRejecting(rejecting === t.id ? null : t.id); setReason(""); }}
                  disabled={isBusy}
                  className="h-8 px-3 text-xs font-medium rounded-lg border border-border text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => review(t, "approve")}
                  disabled={isBusy}
                  className="h-8 px-3.5 text-xs font-semibold rounded-lg bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isBusy && rejecting !== t.id ? "Saving…" : "Approve"}
                </button>
              </div>
            </div>
            <ul className="text-xs text-muted space-y-0.5">
              {t.kpi && <li className="flex items-center gap-1"><Target size={11} className="text-accent" />KPI: <span className="text-foreground/80">{t.kpi.metric}</span></li>}
              {t.deal && <li>Deal: <span className="text-foreground/80">{t.deal.name}</span>{money ? ` · brought in ${money}` : ""}</li>}
              {!t.deal && money && <li>Brought in {money}</li>}
              {t.pendingResults.map((r, i) => (
                <li key={i}>Result logged: {r.value.toLocaleString()} on {fmtDate(r.date)}{r.note ? ` · ${r.note}` : ""}</li>
              ))}
              {t.completionCriteria && <li>Done when: {t.completionCriteria}</li>}
              {t.notes && <li>Notes: {t.notes}</li>}
            </ul>
            <TaskEvidence items={t.attachments} />
            {rejecting === t.id && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && reason.trim()) review(t, "reject"); }}
                  placeholder="Why? They'll see this so they know what to fix."
                  maxLength={500}
                  className="flex-1 h-9 bg-surface border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
                <button
                  onClick={() => review(t, "reject")}
                  disabled={isBusy || !reason.trim()}
                  className="h-9 px-3 text-xs font-semibold rounded-lg bg-red-600 text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isBusy ? "Sending…" : "Send back"}
                </button>
              </div>
            )}
            {error?.id === t.id && <p className="text-xs text-red-600">{error.message}</p>}
          </section>
        );
      })}
    </div>
  );
}
