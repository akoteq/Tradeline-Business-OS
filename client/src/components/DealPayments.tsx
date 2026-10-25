"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Undo2 } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { toast } from "./Toast";
import { promptAction } from "./Confirm";

// Payments on a deal: one dated line per receipt. The deal's "received" figure is the sum of
// these lines, and revenue KPIs count them inside each KPI's window — so record money here
// when it arrives instead of overwriting the total.

type Payment = {
  id: string; amountGhs: number; currency: string; exchangeRate: number; receivedAt: string;
  note: string | null; recordedByEmail: string | null; origin: string;
};

type LinkedTask = {
  id: string; deliverable: string; status: string; revenueActual: number | null; currency: string | null; bdo?: { name: string } | null;
};

const CURRENCIES =["GHS", "USD", "EUR", "NGN", "RWF"];
const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent";
const fmt = (n: number) => `GHS ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const ORIGIN: Record<string, string> = { DEAL_EDIT: "from deal form", MIGRATED: "before payments were logged", ASSISTANT: "via assistant", TASK: "from a task", FORM: "" };

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function DealPayments({ source, dealId, onChanged }: {
  source: "BAPX" | "TRADELINE" | "COMPANY"; dealId: string; onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const key = ["deal-payments", source, dealId];
  const { data: lines = [], isLoading } = useQuery<Payment[]>({
    queryKey: key,
    queryFn: () => fetcher(`/deal-payments?source=${source}&dealId=${dealId}`),
  });
  // Tasks linked to this deal (the work behind the money).
  const { data: tasks = [] } = useQuery<LinkedTask[]>({
    queryKey: ["tasks", "deal", dealId],
    queryFn: () => fetcher(`/tasks?dealId=${dealId}`),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", currency: "GHS", exchangeRate: "", receivedAt: new Date().toISOString().slice(0, 10), note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const total = lines.reduce((s, l) => s + l.amountGhs, 0);
  const reversed = new Set(lines.map((l) => l.note?.match(/^Reversal of ([a-f0-9]{24})/)?.[1]).filter(Boolean));

  // The deal lists show the received total, so refresh them too.
  const LIST_KEY: Record<string, string> = { TRADELINE: "tradeline", BAPX: "bapx", COMPANY: "company-deals" };
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: [LIST_KEY[source]] });
    onChanged?.();
  };

  const save = async () => {
    setBusy(true); setError("");
    try {
      await api.post("/deal-payments", { source, dealId, ...form, exchangeRate: form.currency === "GHS" ? 1 : form.exchangeRate });
      toast.success("Payment recorded", { description: `${form.currency} ${Number(form.amount).toLocaleString()}` });
      setForm((f) => ({ ...f, amount: "", note: "" }));
      setOpen(false);
      refresh();
    } catch (err) {
      setError(apiError(err, "Couldn't record the payment."));
    } finally { setBusy(false); }
  };

  const reverse = async (p: Payment) => {
    const note = await promptAction({
      title: `Reverse the payment of ${fmt(p.amountGhs)}?`,
      body: "It comes off the deal's revenue. The original stays on record.",
      inputLabel: "Reason (optional)",
      placeholder: "e.g. Entered twice",
      confirmLabel: "Reverse payment",
      danger: true,
    });
    if (note === null) return;
    try {
      await api.post(`/deal-payments/${p.id}/reverse`, { note: note || undefined });
      toast.success("Payment reversed", { description: fmt(p.amountGhs) });
      refresh();
    } catch (err) {
      toast.failed("Couldn't reverse the payment", err);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Payments</p>
          <p className="text-sm text-foreground tabular-nums">{fmt(total)} received</p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-accent text-accent-foreground hover:opacity-90">
          <Plus size={13} /> Record payment
        </button>
      </div>

      {open && (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="0" inputMode="decimal" placeholder="Amount" value={form.amount} onChange={(e) => set("amount", e.target.value)} className={inputCls} autoFocus />
            <select value={form.currency} onChange={(e) => set("currency", e.target.value)} className={inputCls}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            {form.currency !== "GHS" && (
              <input type="number" min="0" placeholder={`1 ${form.currency} = ? GHS`} value={form.exchangeRate} onChange={(e) => set("exchangeRate", e.target.value)} className={inputCls + " col-span-2"} />
            )}
            <input type="date" value={form.receivedAt} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set("receivedAt", e.target.value)} className={inputCls} />
            <input placeholder="Note (optional)" value={form.note} onChange={(e) => set("note", e.target.value)} className={inputCls} maxLength={200} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs rounded-lg border border-border text-foreground hover:bg-primary/5">Cancel</button>
            <button onClick={save} disabled={busy || !form.amount} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-accent-foreground disabled:opacity-50">{busy ? "Saving…" : "Save payment"}</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : lines.length === 0 ? (
        <p className="text-xs text-muted">No payments yet.</p>
      ) : (
        <ul className="divide-y divide-border/60 max-h-56 overflow-y-auto">
          {lines.map((p) => (
            <li key={p.id} className="py-1.5 flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className={p.amountGhs < 0 ? "text-red-600 font-medium tabular-nums" : "text-foreground font-medium tabular-nums"}>{fmt(p.amountGhs)}</span>
                {p.currency !== "GHS" && <span className="text-muted"> ({p.currency} @ {p.exchangeRate})</span>}
                <span className="text-muted"> · {new Date(p.receivedAt).toLocaleDateString()}</span>
                {(p.note || ORIGIN[p.origin]) && <div className="text-muted truncate">{p.note ?? ORIGIN[p.origin]}</div>}
                {p.recordedByEmail && <div className="text-muted/70 truncate">{p.recordedByEmail}</div>}
              </div>
              {p.amountGhs > 0 && !reversed.has(p.id) && p.origin !== "TASK" && (
                <button onClick={() => reverse(p)} title="Reverse this payment" className="shrink-0 p-1 rounded text-muted hover:text-red-600 hover:bg-red-500/10"><Undo2 size={13} /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      {tasks.length > 0 && (
        <div className="border-t border-border/60 pt-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Tasks for this deal</p>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                <span className={t.status === "COMPLETED" ? "text-muted line-through truncate" : "text-foreground truncate"}>{t.deliverable}</span>
                <span className="text-muted shrink-0">
                  {t.revenueActual ? `${t.currency && t.currency !== "GHS" ? t.currency : "GHS"} ${t.revenueActual.toLocaleString()} ${t.status === "COMPLETED" ? "in" : "expected"} · ` : ""}
                  {t.bdo?.name ?? "Unassigned"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted/80 mt-1">Money on these tasks shows above as payments once each task is completed. Change it on the task.</p>
        </div>
      )}
    </div>
  );
}
