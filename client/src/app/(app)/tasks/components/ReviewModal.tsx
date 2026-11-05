"use client";

import { Fragment, useState } from "react";
import { Target } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/Toast";
import { KpiSheet } from "@/components/kpi";
import { TaskEvidence } from "@/components/TaskEvidence";
import { apiError, fmtDate, type ApprovalTask, type Task } from "./task-utils";
import { TaskMoneyFields, hasTaskMoney, initialMoney, moneyBody } from "./TaskMoney";

/**
 * Review finished work in one place: what was done, what it moves, the evidence, then approve
 * it or send it back with a reason. Opened from the Review button on a task waiting for approval.
 */
export function ReviewModal({ task, companyName, onClose, onDone }: {
  // From the task list; the approvals feed adds the results logged with it when we have it.
  task: Task & Partial<Pick<ApprovalTask, "pendingResults">>;
  companyName: string;
  onClose: () => void;
  onDone: (action: "approve" | "reject") => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const withMoney = hasTaskMoney(task);
  const [moneyValue, setMoneyValue] = useState(() => initialMoney(task));
  const [error, setError] = useState("");

  const money = task.expectedRevenue ? `${task.currency && task.currency !== "GHS" ? task.currency : "GHS"} ${task.expectedRevenue.toLocaleString()}` : null;
  const results = task.pendingResults ?? [];
  const isChange = !!task.approvedAt;

  const review = async (action: "approve" | "reject") => {
    if (action === "reject" && !reason.trim()) { setError("Say why, so they know what to fix."); return; }
    setBusy(action);
    setError("");
    try {
      await api.post(`/tasks/${task.id}/${action}`, action === "reject" ? { reason: reason.trim() } : withMoney ? { money: moneyBody(moneyValue) } : {});
      toast.success(action === "approve" ? "Task approved" : "Sent back for changes", { description: task.deliverable });
      onDone(action);
    } catch (err) {
      setError(apiError(err, `We couldn't ${action} this task. Please try again.`));
    } finally {
      setBusy(null);
    }
  };

  const footer = rejecting ? (
    <>
      <button type="button" onClick={() => { setRejecting(false); setError(""); }} disabled={!!busy} className="px-4 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-primary/5 disabled:opacity-50">
        Back
      </button>
      <button type="button" onClick={() => review("reject")} disabled={!!busy || !reason.trim()} className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:opacity-90 disabled:opacity-50">
        {busy === "reject" ? "Sending…" : "Send back"}
      </button>
    </>
  ) : (
    <>
      <button type="button" onClick={() => { setRejecting(true); setError(""); }} disabled={!!busy} className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-red-600 hover:bg-red-50 disabled:opacity-50">
        Reject
      </button>
      <button type="button" onClick={() => review("approve")} disabled={!!busy} className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50">
        {busy === "approve" ? "Approving…" : "Approve"}
      </button>
    </>
  );

  return (
    <KpiSheet
      wide
      title={rejecting ? "Send it back" : "Review this task"}
      subtitle={rejecting ? "They'll see your reason on the task and can fix it, then mark it done again." : isChange ? "A change to work you already approved. The approved version counts until you decide." : "Approving makes its money and results count toward the KPIs."}
      onClose={busy ? () => {} : onClose}
      footer={footer}
    >
      <div>
        <p className="text-base font-semibold text-foreground">{task.deliverable}</p>
        <p className="mt-0.5 text-xs text-muted">
          {[task.bdo?.name ?? "Unassigned", companyName, task.completedAt && `done ${fmtDate(task.completedAt)}`, task.targetDate && `due ${fmtDate(task.targetDate)}`]
            .filter(Boolean).join(" · ")}
        </p>
      </div>

      {(task.kpi || task.deal || money || results.length > 0 || task.completionCriteria || task.notes) && (
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 rounded-xl bg-background px-4 py-3 text-sm">
          {task.completionCriteria && <><dt className="text-muted">Done when</dt><dd className="text-foreground">{task.completionCriteria}</dd></>}
          {task.kpi && <><dt className="text-muted">KPI</dt><dd className="flex items-center gap-1 text-foreground"><Target size={13} className="text-accent" />{task.kpi.metric}</dd></>}
          {task.deal && <><dt className="text-muted">Deal</dt><dd className="text-foreground">{task.deal.name}</dd></>}
          {money && <><dt className="text-muted">Expected revenue</dt><dd className="font-medium tabular-nums text-foreground">{money}</dd></>}
          {results.map((r, i) => (
            <Fragment key={i}><dt className="text-muted">Result</dt><dd className="text-foreground"><span className="tabular-nums">{r.value.toLocaleString()}</span> on {fmtDate(r.date)}{r.note ? ` · ${r.note}` : ""}</dd></Fragment>
          ))}
          {task.notes && <><dt className="text-muted">Notes</dt><dd className="whitespace-pre-line text-foreground">{task.notes}</dd></>}
        </dl>
      )}

      <TaskEvidence items={task.attachments} />

      {!rejecting && withMoney && <TaskMoneyFields task={task} value={moneyValue} onChange={setMoneyValue} />}

      {rejecting && (
        <div>
          <label htmlFor="reject-reason" className="mb-1.5 block text-sm font-medium text-foreground">Why are you sending it back?</label>
          <textarea
            id="reject-reason"
            autoFocus
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => { setReason(e.target.value); if (error) setError(""); }}
            placeholder="e.g. The report is missing the Q3 numbers. Add them and resubmit."
            className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      )}

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-500/5 px-3 py-2 text-sm text-red-600">{error}</p>}
    </KpiSheet>
  );
}
