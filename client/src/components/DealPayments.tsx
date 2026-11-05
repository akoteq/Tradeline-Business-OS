"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, FolderKanban, Trash2, Undo2 } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { isManager } from "@/lib/auth";
import { toast } from "./Toast";
import { confirmAction, promptAction } from "./Confirm";
import { useAuth } from "./AuthProvider";
import { FINANCE_CURRENCIES } from "./deals/dealMoney";

// Money received on a deal. Only the Business CEO (or Group Owner) adds it, by hand, as actual
// revenue in Finance. Each line here comes from that, and the deal's received total and balance
// are the sum of the lines. Revenue KPIs count them inside each KPI's window.

type Payment = {
  id: string; amountGhs: number; currency: string; exchangeRate: number; receivedAt: string;
  note: string | null; recordedByEmail: string | null; origin: string; financeEntryId?: string | null;
};
type LinkedTask = { id: string; deliverable: string; status: string; expectedExpense?: number | null; currency: string | null; bdo?: { name: string } | null };
type DealProject = { id: string; name: string; status: string };
type CostEntry = { id: string; type: string; status: string; amount: number; currency: string };

const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent";
const money = (n: number, c = "GHS") => `${c} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const ORIGIN: Record<string, string> = { DEAL_EDIT: "from the deal form", MIGRATED: "before payments were logged", ASSISTANT: "via assistant", TASK: "from a task", FORM: "", FINANCE: "" };

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function DealPayments({ source, dealId, company, dealName, cancelled, endpoint, onChanged }: {
  source: "BAPX" | "TRADELINE" | "COMPANY"; dealId: string; company: string; dealName: string;
  /** The deal is cancelled, so it stops counting as owed. It can be restored. */
  cancelled?: boolean;
  /** Where the deal is saved, e.g. /tradeline/:id, used to cancel or restore it. */
  endpoint: string;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const manager = isManager(user);
  const qc = useQueryClient();
  const key = ["deal-payments", source, dealId];
  const { data: lines = [], isLoading } = useQuery<Payment[]>({
    queryKey: key,
    queryFn: () => fetcher(`/deal-payments?source=${source}&dealId=${dealId}`),
  });
  const { data: tasks = [] } = useQuery<LinkedTask[]>({ queryKey: ["tasks", "deal", dealId], queryFn: () => fetcher(`/tasks?dealId=${dealId}`) });
  const { data: projects = [] } = useQuery<DealProject[]>({ queryKey: ["projects", "deal", dealId], queryFn: () => fetcher(`/projects?dealId=${dealId}`) });
  const { data: costRes } = useQuery<{ data: CostEntry[] }>({
    queryKey: ["finance", "deal-costs", dealId],
    queryFn: () => fetcher(`/finance/entries?dealId=${dealId}&type=EXPENSE&status=ACTUAL`),
    enabled: manager,
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", currency: "GHS", exchangeRate: "", date: new Date().toISOString().slice(0, 10), description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const total = lines.reduce((s, l) => s + l.amountGhs, 0);
  const reversed = new Set(lines.map((l) => l.note?.match(/^Reversal of ([a-f0-9]{24})/)?.[1]).filter(Boolean));

  // A revenue entry can have several lines (corrections). Offer delete once, on its newest line,
  // and not at all once its lines net to zero, because the entry has already been deleted.
  const liveEntries = new Map<string, string>();
  const entryIds = new Set(lines.map((l) => l.financeEntryId).filter(Boolean) as string[]);
  entryIds.forEach((entryId) => {
    const own = lines.filter((l) => l.financeEntryId === entryId);
    const newest = own.find((l) => l.amountGhs > 0);
    if (newest && own.reduce((s, l) => s + l.amountGhs, 0) > 0.005) liveEntries.set(entryId, newest.id);
  });

  const costs = new Map<string, number>();
  (costRes?.data ?? []).forEach((e) => costs.set(e.currency, (costs.get(e.currency) ?? 0) + e.amount));

  const LIST_KEY: Record<string, string> = { TRADELINE: "tradeline", BAPX: "bapx", COMPANY: "company-deals" };
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: [LIST_KEY[source]] });
    qc.invalidateQueries({ queryKey: ["finance"] });
    onChanged?.();
  };

  const save = async () => {
    setBusy(true); setError("");
    try {
      await api.post("/finance/entries", {
        type: "REVENUE", status: "ACTUAL", company, dealId, dealSource: source, amount: form.amount, currency: form.currency,
        exchangeRate: form.currency === "GHS" ? 1 : form.exchangeRate, date: form.date, description: form.description || `Payment from ${dealName}`,
      });
      toast.success("Revenue added", { description: money(Number(form.amount), form.currency) });
      setForm((f) => ({ ...f, amount: "", description: "" }));
      setOpen(false);
      refresh();
    } catch (err) {
      setError(apiError(err, "Couldn't add this revenue."));
    } finally { setBusy(false); }
  };

  const removeEntry = async (p: Payment) => {
    if (!(await confirmAction({ title: `Delete this revenue of ${money(p.amountGhs)}?`, body: "It comes off the deal's balance, Finance and revenue KPIs.", confirmLabel: "Delete revenue", danger: true }))) return;
    try {
      await api.delete(`/finance/entries/${p.financeEntryId}`);
      toast.success("Revenue deleted");
      refresh();
    } catch (err) { toast.failed("Couldn't delete this revenue", err); }
  };

  const reverse = async (p: Payment) => {
    const note = await promptAction({
      title: `Reverse the payment of ${money(p.amountGhs)}?`,
      body: "It comes off the deal's revenue. The original stays on record.",
      inputLabel: "Reason (optional)", placeholder: "e.g. Entered twice", confirmLabel: "Reverse payment", danger: true,
    });
    if (note === null) return;
    try {
      await api.post(`/deal-payments/${p.id}/reverse`, { note: note || undefined });
      toast.success("Payment reversed", { description: money(p.amountGhs) });
      refresh();
    } catch (err) { toast.failed("Couldn't reverse the payment", err); }
  };

  const toggleCancelled = async () => {
    const restoring = !!cancelled;
    if (!restoring && !(await confirmAction({ title: `Cancel the deal for ${dealName}?`, body: "Its balance stops counting as owed, and its expected revenue leaves Finance. Money already received stays. You can restore it later.", confirmLabel: "Cancel deal", cancelLabel: "Keep deal", danger: true }))) return;
    try {
      await api.put(endpoint, { cancelled: !restoring });
      toast.success(restoring ? "Deal restored" : "Deal cancelled", { description: dealName });
      refresh();
    } catch (err) { toast.failed("Couldn't change this deal", err); }
  };

  const project = projects[0];
  const projectLink = `/projects?new=1&dealId=${dealId}&dealSource=${source}&company=${encodeURIComponent(company)}&name=${encodeURIComponent(dealName)}`;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Money received</p>
            <p className="text-sm text-foreground tabular-nums">{money(total)} received</p>
          </div>
          {manager && (
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-accent text-accent-foreground hover:opacity-90">
              <Banknote size={13} /> Record revenue
            </button>
          )}
        </div>
        {!manager && <p className="text-[11px] text-muted">Only your Business CEO can add money received.</p>}

        {open && (
          <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" inputMode="decimal" placeholder="Amount" value={form.amount} onChange={(e) => set("amount", e.target.value)} className={inputCls} autoFocus />
              <select value={form.currency} onChange={(e) => set("currency", e.target.value)} className={inputCls}>
                {FINANCE_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              {form.currency !== "GHS" && (
                <input type="number" min="0" placeholder={`1 ${form.currency} = ? GHS (for KPIs only)`} value={form.exchangeRate} onChange={(e) => set("exchangeRate", e.target.value)} className={inputCls + " col-span-2"} />
              )}
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={inputCls} />
              <input placeholder="Note (optional)" value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls} maxLength={200} />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs rounded-lg border border-border text-foreground hover:bg-primary/5">Cancel</button>
              <button onClick={save} disabled={busy || !form.amount} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-accent-foreground disabled:opacity-50">{busy ? "Saving…" : "Save revenue"}</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : lines.length === 0 ? (
          <p className="text-xs text-muted">No money received yet.</p>
        ) : (
          <ul className="divide-y divide-border/60 max-h-56 overflow-y-auto">
            {lines.map((p) => (
              <li key={p.id} className="py-1.5 flex items-start justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className={p.amountGhs < 0 ? "text-red-600 font-medium tabular-nums" : "text-foreground font-medium tabular-nums"}>{money(p.amountGhs)}</span>
                  {p.currency !== "GHS" && <span className="text-muted"> ({p.currency} @ {p.exchangeRate})</span>}
                  <span className="text-muted"> · {new Date(p.receivedAt).toLocaleDateString()}</span>
                  {(p.note || ORIGIN[p.origin]) && <div className="text-muted truncate">{p.note ?? ORIGIN[p.origin]}</div>}
                  {p.recordedByEmail && <div className="text-muted/70 truncate">{p.recordedByEmail}</div>}
                </div>
                {manager && p.amountGhs > 0 && p.financeEntryId && liveEntries.get(p.financeEntryId) === p.id && (
                  <button onClick={() => removeEntry(p)} title="Delete this revenue" className="shrink-0 p-1 rounded text-muted hover:text-red-600 hover:bg-red-500/10"><Trash2 size={13} /></button>
                )}
                {manager && p.amountGhs > 0 && !p.financeEntryId && !reversed.has(p.id) && (
                  <button onClick={() => reverse(p)} title="Reverse this payment" className="shrink-0 p-1 rounded text-muted hover:text-red-600 hover:bg-red-500/10"><Undo2 size={13} /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {manager && costs.size > 0 && (
        <div className="rounded-xl border border-border bg-background/60 p-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Costs on this deal</p>
          <p className="text-sm text-foreground tabular-nums">{[...costs.entries()].map(([c, v]) => money(v, c)).join(" · ")}</p>
          <p className="text-[11px] text-muted">Expenses linked to this deal, or to its tasks.</p>
        </div>
      )}

      {project ? (
        <div className="rounded-xl border border-border bg-background/60 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Project</p>
            <p className="truncate text-sm text-foreground">{project.name}</p>
          </div>
          <Link href={`/projects/${project.id}`} className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-primary/5">Open project</Link>
        </div>
      ) : manager && (
        <Link href={projectLink} className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
          <FolderKanban size={13} /> This deal needs a project? Add one
        </Link>
      )}

      {tasks.length > 0 && (
        <div className="rounded-xl border border-border bg-background/60 p-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Tasks for this deal</p>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                <span className={t.status === "COMPLETED" ? "text-muted line-through truncate" : "text-foreground truncate"}>{t.deliverable}</span>
                <span className="text-muted shrink-0">{t.bdo?.name ?? "Unassigned"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={toggleCancelled} className="text-xs text-muted hover:text-foreground hover:underline">
        {cancelled ? "Restore this deal" : "Cancel this deal"}
      </button>
    </div>
  );
}
