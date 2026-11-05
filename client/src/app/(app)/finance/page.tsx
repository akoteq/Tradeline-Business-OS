"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Banknote, CircleSlash, Pencil, Plus, Receipt, Trash2, X } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useCompanies, companyHref } from "@/lib/companies";
import { isGroupOwner, isStaff } from "@/lib/auth";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { EntryForm } from "./EntryForm";
import {
  CURRENCIES, ENTRY_LABEL, RANGE_LABEL, num, rangeFor, showDate, signed, todayStr,
  type Entry, type EntryStatus, type EntryType, type RangeKey, type Report, type Totals, type WaitingEntry,
} from "./lib";

// A company's money, one currency at a time: Finance never converts, so currencies are not added
// together. The CEO sees expected and actual side by side, with the weekly report underneath. Every number opens the entries behind it. Staff see only what they entered,
// and the forms to add more. The Group Owner picks one company at a time: there is no combined
// group view yet.

const card = "rounded-2xl border border-border bg-surface shadow-card";
const btn = "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-subtle";
const btnAccent = "inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90";

type Filter = { type?: EntryType; status?: EntryStatus; currency?: string; category?: string; dealId?: string };
type FormState = { type: EntryType; status: EntryStatus; entry?: Entry | null; fromExpected?: WaitingEntry | null } | null;

export default function FinancePage() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const staff = isStaff(user);
  const owner = isGroupOwner(user);
  const qc = useQueryClient();

  const [picked, setPicked] = useState("");
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("company");
    if (fromLink) setPicked(fromLink);
  }, []);
  const company = owner ? (picked || companies[0]?.key || "") : (user?.bdoCompany ?? "");
  const companyInfo = companies.find((c) => c.key === company);

  const [rangeKey, setRangeKey] = useState<RangeKey>("week");
  const [custom, setCustom] = useState({ from: todayStr(), to: todayStr() });
  const range = useMemo(() => rangeFor(rangeKey, custom), [rangeKey, custom]);
  const [filter, setFilter] = useState<Filter>({});
  const [pickedCurrency, setPickedCurrency] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [limit, setLimit] = useState(50);

  const refresh = () => qc.invalidateQueries({ queryKey: ["finance"] });

  const reportQs = new URLSearchParams({ from: range.from, to: range.to, ...(owner ? { company } : {}) });
  const { data: report, isLoading: loadingReport } = useQuery<Report>({
    queryKey: ["finance", "report", company, range.from, range.to],
    queryFn: () => fetcher(`/finance/report?${reportQs}`),
    enabled: !staff && !!company && !!range.from && !!range.to,
  });

  // Starts on the first currency with money in this period, then stays on what was picked.
  const hasMoney = (t?: Totals) => !!t && !!(t.expectedRevenue || t.actualRevenue || t.expectedExpense || t.actualExpense);
  const withMoney = CURRENCIES.filter((c) => hasMoney(report?.currencies.find((x) => x.currency === c)));
  const currency = pickedCurrency ?? withMoney[0] ?? "GHS";

  // Managers see the page in one currency. Staff have only their list, with its own filter.
  const entryQs = new URLSearchParams({
    from: range.from, to: range.to, limit: String(limit),
    ...(owner ? { company } : {}),
    ...Object.fromEntries(Object.entries(filter).filter(([, v]) => v)),
    ...(staff ? {} : { currency }),
  });
  const { data: entryRes, isLoading: loadingEntries } = useQuery<{ data: Entry[]; total: number }>({
    queryKey: ["finance", "entries", company, range.from, range.to, filter, limit, staff ? "" : currency],
    queryFn: () => fetcher(`/finance/entries?${entryQs}`),
    enabled: !!range.from && !!range.to && (!owner || !!company),
  });
  const entries = entryRes?.data ?? [];

  const waitingQs = new URLSearchParams({ to: range.to, currency, ...(owner ? { company } : {}) });
  const { data: waiting = [] } = useQuery<WaitingEntry[]>({
    queryKey: ["finance", "waiting", company, range.to, currency],
    queryFn: () => fetcher(`/finance/waiting?${waitingQs}`),
    enabled: !staff && !!company && !!range.to,
  });

  const closeWaiting = async (e: WaitingEntry) => {
    if (!(await confirmAction({ title: "Nothing more is coming?", body: `${e.currency} ${num(e.remaining)} of "${e.description ?? "this entry"}" leaves this list. The report still shows the difference.`, confirmLabel: "Yes, close it" }))) return;
    try { await api.post(`/finance/entries/${e.id}/close`); toast.success("Closed", { description: e.description ?? undefined }); refresh(); }
    catch (err) { toast.failed("Couldn't close this", err); }
  };

  const openEntries = (f: Filter) => {
    setFilter(f);
    document.getElementById("finance-entries")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const remove = async (e: Entry) => {
    const label = `${e.currency} ${num(e.amount)}`;
    if (!(await confirmAction({ title: `Delete this entry of ${label}?`, body: e.seriesId === e.id ? "This is the first entry of a repeating expense, so the repeating stops too." : "This can't be undone.", confirmLabel: "Delete entry", danger: true }))) return;
    try { await api.delete(`/finance/entries/${e.id}`); toast.success("Entry deleted", { description: label }); refresh(); }
    catch (err) { toast.failed("Couldn't delete this entry", err); }
  };

  const stop = async (e: Entry) => {
    if (!(await confirmAction({ title: "Stop this expense repeating?", body: "Future expected entries are removed. Past entries stay.", confirmLabel: "Stop repeating" }))) return;
    try { await api.post(`/finance/entries/${e.id}/stop-repeating`); toast.success("It will not repeat again"); refresh(); }
    catch (err) { toast.failed("Couldn't stop this expense repeating", err); }
  };

  const activeFilter = Object.entries(filter).filter(([k, v]) => v && (staff || k !== "currency"));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl text-foreground md:text-4xl">{staff ? "My expenses" : "Finance"}</h1>
          <p className="mt-1 max-w-2xl text-base text-muted">
            {staff ? "Record what you spend, and plan what you expect to spend or bring in." : `${companyInfo?.name ?? "Your company"}. Money expected, and money actually in and out.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setForm({ type: "EXPENSE", status: "EXPECTED" })} className={btn}><Plus size={15} /> Expected expense</button>
          <button onClick={() => setForm({ type: "REVENUE", status: "EXPECTED" })} className={btn}><Plus size={15} /> Expected revenue</button>
          <button onClick={() => setForm({ type: "EXPENSE", status: "ACTUAL" })} className={staff ? btnAccent : btn}><Receipt size={15} /> Record expense</button>
          {!staff && <button onClick={() => setForm({ type: "REVENUE", status: "ACTUAL" })} className={btnAccent}><Banknote size={15} /> Record revenue</button>}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {owner && (
          <select aria-label="Company" value={company} onChange={(e) => { setPicked(e.target.value); setFilter({}); }} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
            {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        )}
        <div role="tablist" aria-label="Period" className="inline-flex flex-wrap rounded-xl border border-border bg-surface p-1 text-sm">
          {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
            <button key={k} role="tab" aria-selected={rangeKey === k} onClick={() => { setRangeKey(k); setFilter({}); setLimit(50); }} className={clsx("rounded-lg px-3 py-1.5", rangeKey === k ? "bg-foreground font-medium text-background" : "text-muted hover:text-foreground")}>
              {RANGE_LABEL[k]}
            </button>
          ))}
        </div>
        {rangeKey === "custom" && (
          <div className="flex items-center gap-2 text-sm">
            <input aria-label="From" type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="rounded-lg border border-border bg-surface px-2 py-1.5" />
            <span className="text-muted">to</span>
            <input aria-label="To" type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="rounded-lg border border-border bg-surface px-2 py-1.5" />
          </div>
        )}
        {!staff && (
          <div role="tablist" aria-label="Currency" className="inline-flex rounded-xl border border-border bg-surface p-1 text-sm">
            {CURRENCIES.map((c) => (
              <button key={c} role="tab" aria-selected={currency === c} onClick={() => { setPickedCurrency(c); setFilter({}); setLimit(50); }} className={clsx("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5", currency === c ? "bg-foreground font-medium text-background" : "text-muted hover:text-foreground")}>
                {c}
                {withMoney.includes(c) && currency !== c && <span className="h-1.5 w-1.5 rounded-full bg-accent" title={`${c} has money in this period`} />}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto text-sm text-muted">{showDate(range.from)} to {showDate(range.to, true)}</span>
      </div>

      {!staff && (
        loadingReport || !report ? (
          <div className={clsx(card, "p-8 text-center text-sm text-muted")}>Loading the numbers…</div>
        ) : (
          <>
            <Summary t={report.currencies.find((x) => x.currency === currency)} p={report.previous.find((x) => x.currency === currency)} onOpen={openEntries} />
            {waiting.length > 0 && (
              <NotYetReceived
                rows={waiting} currency={currency}
                onRecord={(e) => setForm({ type: e.type, status: "ACTUAL", fromExpected: e })}
                onClose={closeWaiting}
              />
            )}
            <WeeklyReport report={report} currency={currency} companyHrefFor={companyInfo ? companyHref(companyInfo) : "/"} onOpen={openEntries} />
          </>
        )
      )}

      <section id="finance-entries" className={clsx(card, "scroll-mt-4")}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4">
          <div>
            <h2 className="text-lg text-foreground">{staff ? "What you've entered" : `Entries in ${currency}`}</h2>
            <p className="text-xs text-muted">{entryRes ? `${entryRes.total} in this period` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeFilter.length > 0 && (
              <button onClick={() => setFilter({})} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                Showing some entries <X size={12} />
              </button>
            )}
            <FilterSelect label="Type" value={filter.type ?? ""} onChange={(v) => setFilter((f) => ({ ...f, type: (v || undefined) as EntryType | undefined }))} options={[["", "All types"], ["REVENUE", "Revenue"], ["EXPENSE", "Expense"]]} />
            <FilterSelect label="Status" value={filter.status ?? ""} onChange={(v) => setFilter((f) => ({ ...f, status: (v || undefined) as EntryStatus | undefined }))} options={[["", "Expected and actual"], ["EXPECTED", "Expected"], ["ACTUAL", "Actual"]]} />
            {staff && <FilterSelect label="Currency" value={filter.currency ?? ""} onChange={(v) => setFilter((f) => ({ ...f, currency: v || undefined }))} options={[["", "All currencies"], ...CURRENCIES.map((c) => [c, c] as [string, string])]} />}
          </div>
        </div>
        <div className="overflow-x-auto px-2 pb-3">
          {loadingEntries ? (
            <p className="px-3 py-8 text-center text-sm text-muted">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">Nothing in this period yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Date", "Type", "Description", "Category", "From", "By", "Amount", ""].map((h, i) => (
                    <th key={i} className={clsx("type-colhead whitespace-nowrap px-3 py-2", h === "Amount" ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e) => <EntryRow key={e.id} e={e} onEdit={() => setForm({ type: e.type, status: e.status, entry: e })} onDelete={() => remove(e)} onStop={() => stop(e)} />)}
              </tbody>
            </table>
          )}
          {entryRes && entries.length < entryRes.total && (
            <button onClick={() => setLimit((n) => n + 50)} className="mt-2 w-full rounded-lg py-2 text-sm text-accent hover:bg-subtle">Show more</button>
          )}
        </div>
      </section>

      {form && (
        <EntryForm
          type={form.type} status={form.status} entry={form.entry} fromExpected={form.fromExpected} company={owner ? company : null}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); refresh(); }}
        />
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

// ── Expected and actual, side by side, never added together ──
function Summary({ t, p, onOpen }: { t?: Totals; p?: Totals; onOpen: (f: Filter) => void }) {
  if (!t) return null;
  const tile = (label: string, expected: number, actual: number, before: number | undefined, type?: EntryType, lowerIsGood = false) => {
    const diff = actual - expected;
    const change = before == null ? null : actual - before;
    const tone = (d: number) => (d === 0 ? "text-muted" : (lowerIsGood ? d < 0 : d > 0) ? "text-emerald-700" : "text-red-700");
    const value = (v: number, status: EntryStatus, big: boolean) => {
      const text = <span className={clsx("tabular-nums text-foreground", big ? "text-2xl font-semibold" : "text-lg")}>{num(v)}</span>;
      return type ? <button onClick={() => onOpen({ type, status })} className="hover:underline" title="See these entries">{text}</button> : text;
    };
    return (
      <div className={clsx(card, "p-4")}>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <div className="mt-2 grid grid-cols-2 items-end gap-2">
          <div><p className="type-colhead">Actual</p>{value(actual, "ACTUAL", true)}</div>
          <div><p className="type-colhead">Expected</p>{value(expected, "EXPECTED", false)}</div>
        </div>
        <div className="mt-2 space-y-0.5 border-t border-border pt-2 text-xs text-muted">
          <p><span className={clsx("tabular-nums", tone(diff))}>{signed(diff)}</span> against expected</p>
          {change != null && <p><span className={clsx("tabular-nums", tone(change))}>{signed(change)}</span> from the period before</p>}
        </div>
      </div>
    );
  };
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {tile("Revenue", t.expectedRevenue, t.actualRevenue, p?.actualRevenue, "REVENUE")}
      {tile("Expenses", t.expectedExpense, t.actualExpense, p?.actualExpense, "EXPENSE", true)}
      {tile("Net", t.expectedNet, t.actualNet, p?.actualNet)}
    </div>
  );
}

// ── Expected money that hasn't fully arrived ──
function NotYetReceived({ rows, currency, onRecord, onClose }: { rows: WaitingEntry[]; currency: string; onRecord: (e: WaitingEntry) => void; onClose: (e: WaitingEntry) => void }) {
  const today = todayStr();
  return (
    <section className={clsx(card, "p-4")}>
      <h2 className="text-base font-semibold text-foreground">Expected, not yet received or spent ({currency})</h2>
      <p className="mb-2 mt-0.5 text-xs text-muted">Record the money when it comes in. Each one you record shows above as actual.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Expected on", "For", "Expected", "So far", "Left", ""].map((h, i) => <th key={i} className={clsx("type-colhead whitespace-nowrap py-1.5 pr-3", ["Expected", "So far", "Left"].includes(h) ? "text-right" : "text-left")}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap py-2 pr-3 text-foreground">
                  {showDate(e.date)}
                  {e.date.slice(0, 10) < today && <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>}
                </td>
                <td className="max-w-[260px] truncate py-2 pr-3 text-foreground">
                  {e.description ?? "—"}
                  {e.type === "EXPENSE" && <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Expense</span>}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-foreground">{num(e.amount)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-foreground">{num(e.received)}</td>
                <td className="py-2 pr-3 text-right font-medium tabular-nums text-foreground">{num(e.remaining)}</td>
                <td className="whitespace-nowrap py-1 text-right">
                  <button onClick={() => onRecord(e)} className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:opacity-90">{e.type === "EXPENSE" ? "Record spent" : "Record received"}</button>
                  <button onClick={() => onClose(e)} className="ml-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:bg-subtle hover:text-foreground">Close</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── The weekly report ──
function WeeklyReport({ report, currency: active, companyHrefFor, onOpen }: { report: Report; currency: string; companyHrefFor: string; onOpen: (f: Filter) => void }) {
  const categories = report.expensesByCategory.filter((c) => c.currency === active);
  const fixed = report.fixedVsOneOff.find((c) => c.currency === active);
  const revenue = report.revenue.filter((r) => r.currency === active);
  const owed = report.owed.filter((o) => o.currency === active);
  const maxCat = Math.max(...categories.map((c) => c.amount), 1);
  const weeks = report.trend.map((w) => ({ week: w.weekStart, ...(w.currencies.find((x) => x.currency === active) as Totals) }));
  const maxWeek = Math.max(...weeks.flatMap((w) => [w.actualRevenue, w.actualExpense]), 1);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={clsx(card, "p-4")}>
          <h3 className="text-base font-semibold text-foreground">Last four weeks ({active})</h3>
          <div className="mb-3 mt-1 flex gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-foreground" /> Revenue</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-accent" /> Expenses</span>
          </div>
          <div className="flex" role="img" aria-label={`Actual revenue and expenses for the last four weeks in ${active}`}>
            {weeks.map((w) => (
              <div key={w.week} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-32 items-end gap-1">
                  <div title={`Revenue ${num(w.actualRevenue)}`} className="w-6 rounded-t bg-foreground" style={{ height: `${(w.actualRevenue / maxWeek) * 100}%`, minHeight: w.actualRevenue ? 2 : 0 }} />
                  <div title={`Expenses ${num(w.actualExpense)}`} className="w-6 rounded-t bg-accent" style={{ height: `${(w.actualExpense / maxWeek) * 100}%`, minHeight: w.actualExpense ? 2 : 0 }} />
                </div>
                <span className="text-xs text-muted">{showDate(w.week)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={clsx(card, "p-4")}>
          <h3 className="text-base font-semibold text-foreground">Where the money went ({active})</h3>
          <p className="mb-2 mt-0.5 text-xs text-muted">{fixed ? `Fixed costs ${num(fixed.fixed)} · One-off costs ${num(fixed.oneOff)}` : "Rent or salaries can make one week look higher."}</p>
          {categories.length === 0 ? <p className="py-6 text-center text-sm text-muted">No expenses in this period.</p> : (
            <ul className="space-y-1.5">
              {categories.map((c) => (
                <li key={c.category}>
                  <button onClick={() => onOpen({ type: "EXPENSE", status: "ACTUAL", category: c.category })} className="grid w-full grid-cols-[110px_1fr_auto] items-center gap-2 text-left text-sm hover:text-accent">
                    <span className="truncate text-foreground">{c.category}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-foreground/[0.06]"><span className="block h-full rounded-full bg-foreground/70" style={{ width: `${(c.amount / maxCat) * 100}%` }} /></span>
                    <span className="tabular-nums text-foreground">{num(c.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={clsx(card, "p-4")}>
          <h3 className="mb-2 text-base font-semibold text-foreground">Where the money came from ({active})</h3>
          {revenue.length === 0 ? <p className="py-6 text-center text-sm text-muted">No revenue in this period.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">{["Client", "Deal or task", "Received"].map((h) => <th key={h} className={clsx("type-colhead py-1.5", h === "Received" ? "text-right" : "text-left")}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {revenue.map((r, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-2 text-foreground">{r.client ?? "—"}</td>
                    <td className="py-2 pr-2 text-muted">{r.deal}</td>
                    <td className="py-2 text-right tabular-nums">
                      <button onClick={() => onOpen({ type: "REVENUE", status: "ACTUAL", ...(r.dealId ? { dealId: r.dealId } : {}) })} className="hover:text-accent hover:underline">{num(r.amount)}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={clsx(card, "p-4")}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-foreground">Money still owed ({active})</h3>
            <Link href={companyHrefFor} className="text-xs font-medium text-accent hover:underline">See deals</Link>
          </div>
          {owed.length === 0 ? <p className="py-6 text-center text-sm text-muted">Nothing owed in {active} right now.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">{["Client", "Due", "Status", "Balance"].map((h) => <th key={h} className={clsx("type-colhead py-1.5", h === "Balance" ? "text-right" : "text-left")}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {owed.slice(0, 10).map((o) => (
                  <tr key={o.dealId}>
                    <td className="py-2 pr-2 text-foreground">{o.client}</td>
                    <td className="whitespace-nowrap py-2 pr-2 text-muted">{showDate(o.due)}</td>
                    <td className="py-2 pr-2"><OwedBadge status={o.status} /></td>
                    <td className="whitespace-nowrap py-2 text-right tabular-nums text-foreground">{num(o.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {owed.length > 10 && <p className="pt-2 text-xs text-muted">And {owed.length - 10} more.</p>}
        </div>
      </div>
    </div>
  );
}

function OwedBadge({ status }: { status: "OVERDUE" | "PARTIAL" | "UNPAID" }) {
  const map = { OVERDUE: ["Overdue", "bg-red-500/10 text-red-700"], PARTIAL: ["Part paid", "bg-amber-500/10 text-amber-700"], UNPAID: ["Unpaid", "bg-subtle text-foreground/70"] } as const;
  return <span className={clsx("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", map[status][1])}>{map[status][0]}</span>;
}

// ── One entry ──
function EntryRow({ e, onEdit, onDelete, onStop }: { e: Entry; onEdit: () => void; onDelete: () => void; onStop: () => void }) {
  const kind = ENTRY_LABEL[`${e.type}_${e.status}`];
  const locked = e.origin === "TASK" || e.origin === "DEAL";
  const from = e.origin === "TASK" ? "Task" : e.origin === "DEAL" ? "Deal" : e.dealId ? "Linked to a deal" : e.taskId ? "Linked to a task" : e.isFixed ? `Fixed · ${e.repeat === "WEEKLY" ? "weekly" : "monthly"}` : e.origin === "MIGRATED" ? "Moved from a deal" : "—";
  return (
    <tr>
      <td className="whitespace-nowrap px-3 py-2 text-foreground">{showDate(e.date)}</td>
      <td className="px-3 py-2"><span className={clsx("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", kind.style)}>{kind.label}</span></td>
      <td className="max-w-[240px] truncate px-3 py-2 text-foreground">{e.description ?? "—"}</td>
      <td className="px-3 py-2 text-muted">{e.category ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-muted">
        {from}
        {e.status === "EXPECTED" && !!e.received && <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">{e.received >= e.amount ? (e.type === "EXPENSE" ? "Spent" : "Received") : `${num(e.received)} ${e.type === "EXPENSE" ? "spent" : "received"}`}</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-foreground">{e.createdByName ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-foreground">{e.currency} {num(e.amount)}</td>
      <td className="whitespace-nowrap px-2 py-1 text-right">
        {locked ? (
          <span className="text-xs text-muted">Change on the {e.origin === "TASK" ? "task" : "deal"}</span>
        ) : (
          <span className="inline-flex gap-0.5">
            {e.seriesId && !e.repeatStopped && <button onClick={onStop} title="Stop repeating" aria-label="Stop repeating" className="rounded p-1.5 text-muted hover:bg-subtle hover:text-foreground"><CircleSlash size={14} /></button>}
            <button onClick={onEdit} title="Edit" aria-label="Edit entry" className="rounded p-1.5 text-muted hover:bg-subtle hover:text-foreground"><Pencil size={14} /></button>
            <button onClick={onDelete} title="Delete" aria-label="Delete entry" className="rounded p-1.5 text-muted hover:bg-red-500/10 hover:text-red-600"><Trash2 size={14} /></button>
          </span>
        )}
      </td>
    </tr>
  );
}
