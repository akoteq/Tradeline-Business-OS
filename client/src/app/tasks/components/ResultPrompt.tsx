"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { KpiSheet, LogResult, type KpiRow } from "@/components/kpi";
import type { Task } from "./task-utils";

/**
 * "Add a result?" when linked work is finished. A prompt, not automatic: finished work is
 * not always a result (a proposal sent is not a deal closed).
 */
export function ResultPrompt({ task, onClose, onDone }: { task: Task; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const k = task.kpi!;
  const row = {
    definition: { id: k.id, metric: k.metric, unit: k.unit, source: k.source },
    aggregation: k.aggregation ?? "SUM",
    bdoId: task.bdoId,
  } as unknown as KpiRow;

  const dismiss = async () => {
    setBusy(true);
    try {
      await api.post(`/tasks/${task.id}/dismiss-result`);
      onDone();
    } catch {
      setBusy(false);
    }
  };

  return (
    <KpiSheet
      title={`Did this move ${k.metric}?`}
      subtitle={<>“{task.deliverable}” is done. If it produced a result, add it here and we'll link it to this task.</>}
      onClose={onClose}
      footer={
        <button
          onClick={dismiss}
          disabled={busy}
          className="px-4 py-2.5 text-sm rounded-xl border border-border bg-surface text-foreground hover:bg-primary/5 disabled:opacity-50 transition-colors"
        >
          {busy ? "One moment…" : "No result to log"}
        </button>
      }
    >
      <LogResult row={row} bdoId={task.bdoId} tasks={[{ id: task.id, deliverable: task.deliverable }]} defaultTaskId={task.id} onSaved={onDone} />
    </KpiSheet>
  );
}
