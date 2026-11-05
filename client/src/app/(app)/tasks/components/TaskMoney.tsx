"use client";

import { useState } from "react";
import { KpiSheet } from "@/components/kpi";

// What was really received and spent on a finished task. The CEO says this when approving the work,
// or when finishing it themselves. It becomes actual entries in Finance, and the expected entries
// stay beside them. Used everywhere a task can be approved or finished, so it can't be skipped.

export type MoneyTask = {
  deliverable: string;
  currency?: string | null;
  expectedRevenue?: number | null;
  expectedExpense?: number | null;
  receivedSoFar?: number;
  spentSoFar?: number;
  dealId?: string | null;
};

export type TaskMoneyValue = { received: string; spent: string; exchangeRate: string };

export const hasTaskMoney = (t: MoneyTask) => !!(t.expectedRevenue || t.expectedExpense || t.dealId);

const left = (expected: number | null | undefined, soFar: number | undefined) => {
  if (!expected) return "";
  const rest = Math.round((expected - (soFar ?? 0)) * 100) / 100;
  return rest > 0 ? String(rest) : "0";
};

// Starts on what was expected and hasn't been recorded yet.
export const initialMoney = (t: MoneyTask): TaskMoneyValue => ({
  received: left(t.expectedRevenue, t.receivedSoFar),
  spent: left(t.expectedExpense, t.spentSoFar),
  exchangeRate: "",
});

export const moneyBody = (m: TaskMoneyValue) => ({
  received: m.received === "" ? 0 : Number(m.received),
  spent: m.spent === "" ? 0 : Number(m.spent),
  exchangeRate: m.exchangeRate === "" ? null : Number(m.exchangeRate),
});

const show = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40";

export function TaskMoneyFields({ task, value, onChange }: { task: MoneyTask; value: TaskMoneyValue; onChange: (v: TaskMoneyValue) => void }) {
  const currency = task.currency ?? "GHS";
  const set = (k: keyof TaskMoneyValue, v: string) => onChange({ ...value, [k]: v });
  const needsRate = currency !== "GHS" && Number(value.received) > 0;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">What really happened? ({currency})</p>
        <p className="text-xs text-muted">These go to Finance as actual money. Enter 0 if nothing has come in or gone out yet.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Money received</label>
          <input type="number" min="0" inputMode="decimal" value={value.received} onChange={(e) => set("received", e.target.value)} placeholder="0" className={inputCls} />
          <p className="mt-1 text-xs text-muted">
            {task.expectedRevenue ? `Expected ${show(task.expectedRevenue)}` : task.dealId ? "Goes to the deal's balance" : "None expected"}
            {task.receivedSoFar ? ` · ${show(task.receivedSoFar)} already recorded` : ""}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Money spent</label>
          <input type="number" min="0" inputMode="decimal" value={value.spent} onChange={(e) => set("spent", e.target.value)} placeholder="0" className={inputCls} />
          <p className="mt-1 text-xs text-muted">
            {task.expectedExpense ? `Expected ${show(task.expectedExpense)}` : "None expected"}
            {task.spentSoFar ? ` · ${show(task.spentSoFar)} already recorded` : ""}
          </p>
        </div>
      </div>
      {needsRate && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Rate (1 {currency} = ? GHS)</label>
          <input type="number" min="0" value={value.exchangeRate} onChange={(e) => set("exchangeRate", e.target.value)} className={inputCls} />
          <p className="mt-1 text-xs text-muted">Used for KPIs only. Finance keeps the amount in {currency}.</p>
        </div>
      )}
      {Number(value.received) === 0 && !!task.expectedRevenue && (
        <p className="text-xs text-muted">The expected revenue will wait on the Finance page until you record it.</p>
      )}
    </div>
  );
}

// The same fields on their own, for the places that approve or finish a task with one click.
export function TaskMoneySheet({ task, title, confirmLabel, error, busy, onConfirm, onClose }: {
  task: MoneyTask; title: string; confirmLabel: string; error?: string; busy?: boolean;
  onConfirm: (money: ReturnType<typeof moneyBody>) => void; onClose: () => void;
}) {
  const [value, setValue] = useState(() => initialMoney(task));
  return (
    <KpiSheet
      title={title}
      subtitle={task.deliverable}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-subtle disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => onConfirm(moneyBody(value))} disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50">{busy ? "Saving…" : confirmLabel}</button>
        </>
      }
    >
      <TaskMoneyFields task={task} value={value} onChange={setValue} />
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-500/5 px-3 py-2 text-sm text-red-600">{error}</p>}
    </KpiSheet>
  );
}
