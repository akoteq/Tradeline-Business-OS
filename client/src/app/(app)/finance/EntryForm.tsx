"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { KpiSheet } from "@/components/kpi";
import { useAuth } from "@/components/AuthProvider";
import { isStaff } from "@/lib/auth";
import { toast } from "@/components/Toast";
import { inputClass, selectClass, btnPrimary, btnSecondary, Label, ErrorNote } from "../kpi-framework/components/fields";
import { CATEGORIES, CURRENCIES, apiError, addDays, showDate, todayStr, type Entry, type EntryStatus, type EntryType, type WaitingEntry } from "./lib";

// The one form for all four kinds of entry. Type and status are fixed by the button that opened it:
// expected and actual are always separate entries, so neither can be changed later.

const TITLE: Record<string, { title: string; sub: string }> = {
  EXPENSE_ACTUAL: { title: "Record an expense", sub: "Money that has already been spent" },
  EXPENSE_EXPECTED: { title: "Add an expected expense", sub: "Money you plan to spend" },
  REVENUE_ACTUAL: { title: "Record revenue", sub: "Money that has actually come in" },
  REVENUE_EXPECTED: { title: "Add expected revenue", sub: "Money you expect to come in" },
};

type DealOption = { id: string; source: "BAPX" | "TRADELINE" | "COMPANY"; name: string };
type TaskOption = { id: string; deliverable: string };

export function EntryForm({ type, status, company, entry, fromExpected, onClose, onSaved }: {
  type: EntryType; status: EntryStatus; company: string | null; entry?: Entry | null;
  /** Recording money against this expected entry: its details are filled in. */
  fromExpected?: WaitingEntry | null;
  onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const staff = isStaff(user);
  const copy = TITLE[`${type}_${status}`];
  const isEdit = !!entry;
  const [form, setForm] = useState({
    amount: entry ? String(entry.amount) : fromExpected ? String(fromExpected.remaining) : "",
    currency: entry?.currency ?? fromExpected?.currency ?? "GHS",
    category: entry?.category ?? fromExpected?.category ?? "",
    description: entry?.description ?? fromExpected?.description ?? "",
    date: entry?.date?.slice(0, 10) ?? todayStr(),
    taskId: entry?.taskId ?? fromExpected?.taskId ?? "",
    deal: entry?.dealId ? `${entry.dealSource}:${entry.dealId}` : "",
    exchangeRate: entry?.exchangeRate && entry.exchangeRate !== 1 ? String(entry.exchangeRate) : "",
    fixed: !!entry?.isFixed,
    repeat: entry && entry.repeat !== "NONE" ? entry.repeat : "MONTHLY",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const isExpense = type === "EXPENSE";
  const actualRevenue = type === "REVENUE" && status === "ACTUAL";
  const canRepeat = isExpense && status === "EXPECTED" && !isEdit;
  const companyForOptions = company ?? user?.bdoCompany ?? "";

  const { data: deals = [] } = useQuery<DealOption[]>({
    queryKey: ["task-deal-options", companyForOptions],
    queryFn: () => fetcher(`/tasks/deal-options?company=${encodeURIComponent(companyForOptions)}`),
    enabled: !!companyForOptions && status === "ACTUAL",
  });
  const { data: tasks = [] } = useQuery<TaskOption[]>({
    queryKey: ["tasks", "finance-picker", companyForOptions],
    queryFn: () => fetcher(`/tasks${staff ? "" : `?company=${encodeURIComponent(companyForOptions)}`}`),
    enabled: isExpense && !!companyForOptions,
  });

  const save = async () => {
    setSaving(true); setError("");
    const [dealSource, dealId] = form.deal ? form.deal.split(":") : [null, null];
    const body = {
      type, status, company, amount: form.amount, currency: form.currency, category: form.category || null,
      description: form.description.trim() || null, date: form.date, taskId: form.taskId || null, dealId, dealSource,
      exchangeRate: actualRevenue ? (form.currency === "GHS" ? 1 : form.exchangeRate || null) : null,
      ...(fromExpected ? { expectedEntryId: fromExpected.id } : {}),
      ...(canRepeat && form.fixed ? { isFixed: true, repeat: form.repeat } : {}),
    };
    try {
      if (entry) await api.put(`/finance/entries/${entry.id}`, body);
      else await api.post("/finance/entries", body);
      toast.success(isEdit ? "Entry updated" : "Entry saved", { description: `${form.currency} ${Number(form.amount).toLocaleString()}` });
      onSaved();
    } catch (err) {
      setError(apiError(err, "We couldn't save this. Please try again."));
    } finally { setSaving(false); }
  };

  const nextDate = form.repeat === "WEEKLY" ? addDays(form.date, 7) : (() => {
    const d = new Date(`${form.date}T00:00:00.000Z`);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0)).getUTCDate();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, Math.min(d.getUTCDate(), last))).toISOString().slice(0, 10);
  })();

  return (
    <KpiSheet
      title={isEdit ? `Edit: ${copy.title.toLowerCase()}` : copy.title}
      subtitle={copy.sub}
      onClose={onClose}
      footer={
        <div className="flex w-full justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="button" onClick={save} disabled={saving || !form.amount} className={btnPrimary}>{saving ? "Saving…" : "Save"}</button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Amount</Label>
          <input type="number" min="0" inputMode="decimal" autoFocus value={form.amount} onChange={(e) => set("amount", e.target.value)} className={inputClass} />
        </div>
        <div>
          <Label>Currency</Label>
          <select value={form.currency} onChange={(e) => set("currency", e.target.value)} className={selectClass}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {isExpense && (
          <div>
            <Label>Category</Label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className={selectClass}>
              <option value="">Choose…</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div className={isExpense ? "" : "col-span-2"}>
          <Label>{canRepeat && form.fixed ? "First date" : "Date"}</Label>
          <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <Label>{status === "ACTUAL" ? "What was it for?" : "What is it for?"}</Label>
        <input value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={300} className={inputClass} />
      </div>

      {status === "ACTUAL" && deals.length > 0 && (
        <div>
          <Label hint="(optional)">{actualRevenue ? "Which deal is this money for?" : "Which deal is this cost for?"}</Label>
          <select value={form.deal} onChange={(e) => set("deal", e.target.value)} className={selectClass}>
            <option value="">No deal</option>
            {deals.map((d) => <option key={d.id} value={`${d.source}:${d.id}`}>{d.name}</option>)}
          </select>
          {actualRevenue && form.deal && <p className="mt-1 text-xs text-muted">This updates the deal&apos;s balance and revenue KPIs.</p>}
        </div>
      )}
      {actualRevenue && form.currency !== "GHS" && (
        <div>
          <Label hint="(for KPIs only)">Rate (1 {form.currency} = ? GHS)</Label>
          <input type="number" min="0" value={form.exchangeRate} onChange={(e) => set("exchangeRate", e.target.value)} className={inputClass} />
          {!form.deal && <p className="mt-1 text-xs text-muted">Without a rate, this shows in Finance but won't count on revenue KPIs.</p>}
        </div>
      )}

      {isExpense && tasks.length > 0 && (
        <div>
          <Label hint="(optional)">Linked task</Label>
          <select value={form.taskId} onChange={(e) => set("taskId", e.target.value)} className={selectClass}>
            <option value="">No task</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.deliverable}</option>)}
          </select>
        </div>
      )}

      {canRepeat && (
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.fixed} onChange={(e) => set("fixed", e.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />
            <span>This comes back every period<span className="block text-xs text-muted">Salaries, rent and subscriptions.</span></span>
          </label>
          {form.fixed && (
            <>
              <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
                {(["WEEKLY", "MONTHLY"] as const).map((r) => (
                  <button key={r} type="button" onClick={() => set("repeat", r)} className={`rounded-md px-3 py-1 ${form.repeat === r ? "bg-foreground text-background font-medium" : "text-muted"}`}>
                    {r === "WEEKLY" ? "Weekly" : "Monthly"}
                  </button>
                ))}
              </div>
              <p className="rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-700">
                Next expected entry: <b>{showDate(nextDate, true)}</b>. The system adds one each {form.repeat === "WEEKLY" ? "week" : "month"} until you choose Stop repeating.
              </p>
            </>
          )}
        </div>
      )}

      {status === "ACTUAL" && isExpense && (
        <div>
          <Label>Issued by</Label>
          <div className={`${inputClass} flex items-center justify-between bg-subtle text-muted`}>
            {entry?.createdByName ?? user?.bdoName ?? user?.email ?? "You"} <Lock size={14} />
          </div>
          <p className="mt-1 text-xs text-muted">Filled in from the login. It can&apos;t be changed.</p>
        </div>
      )}

      <ErrorNote message={error} />
    </KpiSheet>
  );
}
