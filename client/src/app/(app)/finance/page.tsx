"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowDownLeft, ArrowUpRight, Banknote, ChevronDown, CircleSlash, Pencil, Plus, Receipt, Trash2, X } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useCompanies, companyHref } from "@/lib/companies";
import { isGroupOwner, isStaff } from "@/lib/auth";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { EntryForm } from "./EntryForm";
import {
  CURRENCIES, ENTRY_LABEL, RANGE_LABEL, num, rangeFor, showDate, todayStr,
  type Entry, type EntryStatus, type EntryType, type RangeKey, type Report, type Totals, type WaitingEntry,
} from "./lib";

// A company's money, one currency at a time: Finance never converts, so currencies are not added
// together.
//
// The page follows the order a CEO thinks in:
//   1. Which company?            -> company tabs (Group Owner only), always visible while scrolling
//   2. For when, in what money?  -> period and currency, in the same sticky bar
//   3. How are we doing?         -> one scoreboard: revenue - expenses = net, against what was expected
//   4. What needs me?            -> expected money that hasn't moved yet, overdue first, one click to record
//   5. Why? / What exactly?      -> weekly report, then every entry
// Staff see only what they entered, and the forms to add more. There is no combined group view yet,
// so the Group Owner looks at one company at a time.

const card = "rounded-2xl border border-border bg-surface shadow-card";
const btn = "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground hover:bg-subtle";
const btnAccent = "inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90";

type Filter = { type?: EntryType; status?: EntryStatus; currency?: string; category?: string; dealId?: string };
type FormState = { type: EntryType; status: EntryStatus; entry?: Entry | null; fromExpected?: WaitingEntry | null } | null;

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86400000);

function describeFilter(f: Filter, staff: boolean) {
  const parts: string[] = [];
  if (f.type) parts.push(f.type === "REVENUE" ? "Revenue" : "Expenses");
  if (f.status) parts.push(f.status === "ACTUAL" ? "actual" : "expected");
  if (f.category) parts.push(f.category);
  if (f.dealId) parts.push("one deal");
  if (staff && f.currency) parts.push(f.currency);
  return parts.join(", ");
}

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

  const switchCompany = (key: string) => {
    setPicked(key);
    setFilter({});
    setPickedCurrency(null); // land on a currency that actually has money in the new company
    setLimit(50);
  };

  const activeFilter = Object.entries(filter).filter(([k, v]) => v && (staff || k !== "currency"));

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl text-foreground md:text-4xl">{staff ? "My expenses" : "Revenue & Expenses"}</h1>
          <p className="mt-1 max-w-2xl text-base text-muted">
            {staff
              ? "Record what you spend, and add what you expect to spend or bring in."
              : owner
                ? "Choose a company, then see what has come in, what has gone out and what is still expected."
                : `${companyInfo?.name ?? "Your company"}. What has come in, what has gone out and what is still expected.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExpectedMenu onPick={(type) => setForm({ type, status: "EXPECTED" })} />
          <button onClick={() => setForm({ type: "EXPENSE", status: "ACTUAL" })} className={staff ? btnAccent : btn}>
            <Receipt size={15} /> Record expense
          </button>
          {!staff && (
            <button onClick={() => setForm({ type: "REVENUE", status: "ACTUAL" })} className={btnAccent}>
              <Banknote size={15} /> Record revenue
            </button>
          )}
        </div>
      </header>

      {/* Context bar: always visible, so you never lose which company, period or currency you're on */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 backdrop-blur md:-mx-6 md:px-6">
        {owner && companies.length > 0 && (
          <div role="tablist" aria-label="Company" className="-mx-1 flex gap-1 overflow-x-auto px-1">
            {companies.map((c) => {
              const on = c.key === company;
              return (
                <button
                  key={c.key} role="tab" aria-selected={on} onClick={() => switchCompany(c.key)}
                  className={clsx("relative shrink-0 whitespace-nowrap px-4 py-3 text-sm transition-colors", on ? "font-semibold text-foreground" : "font-medium text-muted hover:text-foreground")}
                >
                  {c.name}
                  {on && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
                </button>
              );
            })}
          </div>
        )}
        <div className={clsx("flex flex-wrap items-center gap-3 py-2.5", owner && "border-t border-border/60")}>
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
      </div>

      {!staff && (
        loadingReport || !report ? (
          <div className={clsx(card, "h-48 animate-pulse bg-subtle")} aria-busy="true" aria-label="Loading the numbers" />
        ) : (
          <>
            <Summary currency={currency} t={report.currencies.find((x) => x.currency === currency)} p={report.previous.find((x) => x.currency === currency)} onOpen={openEntries} />
            {waiting.length > 0 && (
              <WaitingToRecord
                rows={waiting} currency={currency}
                onRecord={(e) => setForm({ type: e.type, status: "ACTUAL", fromExpected: e })}
                onClose={closeWaiting}
              />
            )}
            <WeeklyReport report={report} currency={currency} companyHrefFor={companyInfo ? companyHref(companyInfo) : "/"} onOpen={openEntries} />
          </>
        )
      )}

      <section id="finance-entries" className={clsx(card, "scroll-mt-40")}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
          <div>
            <h2 className="text-lg text-foreground">{staff ? "What you've entered" : "All entries"}</h2>
            <p className="text-sm text-muted">
              {entryRes ? `${entryRes.total} ${entryRes.total === 1 ? "entry" : "entries"} in this period${staff ? "" : `, in ${currency}`}` : "\u00A0"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeFilter.length > 0 && (
              <button onClick={() => setFilter({})} aria-label="Clear filter" className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/15">
                {describeFilter(filter, staff)} <X size={12} />
              </button>
            )}
            <FilterSelect label="Type" value={filter.type ?? ""} onChange={(v) => setFilter((f) => ({ ...f, type: (v || undefined) as EntryType | undefined }))} options={[["", "All types"], ["REVENUE", "Revenue"], ["EXPENSE", "Expense"]]} />
            <FilterSelect label="Status" value={filter.status ?? ""} onChange={(v) => setFilter((f) => ({ ...f, status: (v || undefined) as EntryStatus | undefined }))} options={[["", "Expected and actual"], ["EXPECTED", "Expected"], ["ACTUAL", "Actual"]]} />
            {staff && <FilterSelect label="Currency" value={filter.currency ?? ""} onChange={(v) => setFilter((f) => ({ ...f, currency: v || undefined }))} options={[["", "All currencies"], ...CURRENCIES.map((c) => [c, c] as [string, string])]} />}
          </div>
        </div>
        <div className="overflow-x-auto px-2 pb-3">
          {loadingEntries ? (
            <p className="px-3 py-10 text-center text-sm text-muted">Loading…</p>
          ) : entries.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-medium text-foreground">{activeFilter.length > 0 ? "No entries match this filter." : "Nothing recorded in this period yet."}</p>
              <p className="mt-1 text-sm text-muted">{activeFilter.length > 0 ? "Clear the filter to see everything in this period." : "Record money as it comes in or goes out and it will show up here."}</p>
              {activeFilter.length > 0 ? (
                <button onClick={() => setFilter({})} className={clsx(btn, "mt-3")}>Clear filter</button>
              ) : (
                <button onClick={() => setForm(staff ? { type: "EXPENSE", status: "ACTUAL" } : { type: "REVENUE", status: "ACTUAL" })} className={clsx(btnAccent, "mt-3")}>
                  {staff ? <><Receipt size={15} /> Record expense</> : <><Banknote size={15} /> Record revenue</>}
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Date", "Description", "Type", "Source", "By", "Amount", ""].map((h, i) => (
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
            <button onClick={() => setLimit((n) => n + 50)} className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-accent hover:bg-subtle">Show more</button>
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

// ── Expected money is added less often than actual money, so it lives in a menu ──
function ExpectedMenu({ onPick }: { onPick: (type: EntryType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const item = "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-subtle";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className={btn}>
        <Plus size={15} /> Add expected <ChevronDown size={14} className={clsx("text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-border bg-surface p-1.5 shadow-pop">
          <button role="menuitem" onClick={() => { setOpen(false); onPick("REVENUE"); }} className={item}>
            <ArrowDownLeft size={16} className="mt-0.5 shrink-0 text-emerald-700" />
            <span><span className="block font-medium text-foreground">Expected revenue</span><span className="block text-xs text-muted">Money you are counting on receiving</span></span>
          </button>
          <button role="menuitem" onClick={() => { setOpen(false); onPick("EXPENSE"); }} className={item}>
            <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-accent" />
            <span><span className="block font-medium text-foreground">Expected expense</span><span className="block text-xs text-muted">Money you know you will spend</span></span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── How are we doing: revenue minus expenses equals net, each against what was expected ──
function Summary({ t, p, currency, onOpen }: { t?: Totals; p?: Totals; currency: string; onOpen: (f: Filter) => void }) {
  if (!t) return null;
  const nothingIn = t.actualRevenue === 0 && t.actualExpense === 0;
  const op = "pointer-events-none absolute top-1/2 hidden h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-sm text-muted lg:flex";
  return (
    <section className={clsx(card, "overflow-hidden")}>
      <div className="relative grid grid-cols-1 divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <Column label="Revenue" currency={currency} actual={t.actualRevenue} expected={t.expectedRevenue} before={p?.actualRevenue} empty={t.actualRevenue === 0} type="REVENUE" onOpen={onOpen} />
        <Column label="Expenses" currency={currency} actual={t.actualExpense} expected={t.expectedExpense} before={p?.actualExpense} empty={t.actualExpense === 0} type="EXPENSE" lowerIsGood onOpen={onOpen} />
        <Column label="Net" currency={currency} actual={t.actualNet} expected={t.expectedNet} before={p?.actualNet} empty={nothingIn} highlight onOpen={onOpen} />
        <span aria-hidden className={clsx(op, "left-1/3")}>{"\u2212"}</span>
        <span aria-hidden className={clsx(op, "left-2/3")}>=</span>
      </div>
      {nothingIn && (
        <p className="border-t border-border bg-subtle/40 px-5 py-2.5 text-sm text-muted">
          Nothing recorded in this period yet. These figures fill in as you record money, measured against what you expected.
        </p>
      )}
    </section>
  );
}

function Column({ label, currency, actual, expected, before, empty, type, lowerIsGood = false, highlight = false, onOpen }: {
  label: string; currency: string; actual: number; expected: number; before?: number; empty: boolean;
  type?: EntryType; lowerIsGood?: boolean; highlight?: boolean; onOpen: (f: Filter) => void;
}) {
  const tone = (d: number) => (d === 0 ? "text-muted" : (lowerIsGood ? d < 0 : d > 0) ? "text-emerald-700" : "text-red-700");
  const diff = actual - expected;
  const change = before == null ? null : actual - before;
  const pct = type && expected > 0 ? Math.min(actual / expected, 1) : 0;

  let status: React.ReactNode;
  if (diff === 0) status = <span className="text-muted">Right on expected</span>;
  else {
    const word = lowerIsGood ? (diff < 0 ? "under" : "over") : (diff > 0 ? "above" : "short of");
    status = <span className={clsx("font-medium", tone(diff))}>{num(Math.abs(diff))} {word} expected</span>;
  }

  const big = (
    <span className={clsx("text-3xl font-semibold tabular-nums", !type && actual < 0 ? "text-red-700" : "text-foreground")}>
      <span className="mr-1.5 text-sm font-medium text-muted">{currency}</span>{num(actual)}
    </span>
  );
  const exp = <span className="tabular-nums">{num(expected)}</span>;

  return (
    <div className={clsx("p-5", highlight && "bg-accent/[0.04]")}>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="mt-2">
        {type ? <button onClick={() => onOpen({ type, status: "ACTUAL" })} className="text-left hover:underline" title="See these entries">{big}</button> : big}
      </div>
      <p className="mt-1 text-sm text-muted">
        {type ? <>of <button onClick={() => onOpen({ type, status: "EXPECTED" })} className="hover:underline" title="See these entries">{exp}</button> expected</> : <>{exp} expected</>}
      </p>
      {type ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]" role="img" aria-label={`${Math.round(pct * 100)}% of expected`}>
          <div className={clsx("h-full rounded-full", type === "REVENUE" ? "bg-emerald-600" : "bg-accent")} style={{ width: `${pct * 100}%` }} />
        </div>
      ) : <div className="mt-3 h-1.5" />}
      {!empty && (
        <div className="mt-3 space-y-0.5 border-t border-border pt-3 text-xs">
          <p>{status}</p>
          {change != null && (
            <p className="text-muted">
              {change === 0 ? "Same as the period before" : <><span className={clsx("font-medium", tone(change))}>{change > 0 ? "Up" : "Down"} {num(Math.abs(change))}</span> on the period before</>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── What needs you: expected money that hasn't moved yet. Overdue is loud, upcoming is calm ──
function WaitingToRecord({ rows, currency, onRecord, onClose }: { rows: WaitingEntry[]; currency: string; onRecord: (e: WaitingEntry) => void; onClose: (e: WaitingEntry) => void }) {
  const today = todayStr();
  const [all, setAll] = useState(false);
  const overdue = rows.filter((e) => e.date.slice(0, 10) < today).length;
  const toReceive = rows.filter((e) => e.type === "REVENUE").reduce((s, e) => s + e.remaining, 0);
  const toSpend = rows.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + e.remaining, 0);
  const shown = all ? rows : rows.slice(0, 5);

  return (
    <section className={clsx(card, "overflow-hidden", overdue > 0 && "ring-1 ring-red-500/25")}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <h2 className="text-lg text-foreground">Waiting to be recorded <span className="ml-1 text-muted">{rows.length}</span></h2>
          <p className="mt-0.5 text-sm text-muted">Expected money that hasn&apos;t moved yet. Record each one when it does, and it counts as actual above.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {overdue > 0 && <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-red-700">{overdue} overdue</span>}
          {toReceive > 0 && <span className="rounded-full bg-subtle px-2.5 py-1 text-foreground">To receive {currency} {num(toReceive)}</span>}
          {toSpend > 0 && <span className="rounded-full bg-subtle px-2.5 py-1 text-foreground">To spend {currency} {num(toSpend)}</span>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border">
              {["For", "Expected", "So far", "Left", ""].map((h, i) => (
                <th key={i} className={clsx("type-colhead whitespace-nowrap py-2 pr-4", i === 0 && "pl-4", ["Expected", "So far", "Left"].includes(h) ? "text-right" : "text-left")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((e) => {
              const late = e.date.slice(0, 10) < today;
              const days = daysBetween(e.date, today);
              const out = e.type === "EXPENSE";
              return (
                <tr key={e.id}>
                  <td className={clsx("border-l-[3px] py-3 pl-3.5 pr-4", late ? "border-red-500" : "border-transparent")}>
                    <div className="flex items-start gap-3">
                      <span title={out ? "Money out" : "Money in"} className={clsx("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", out ? "bg-accent/10 text-accent" : "bg-emerald-500/10 text-emerald-700")}>
                        {out ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                      </span>
                      <div className="min-w-0">
                        <p className="max-w-[340px] truncate font-medium text-foreground">{e.description ?? "—"}</p>
                        <p className={clsx("text-xs", late ? "text-red-700" : "text-muted")}>
                          {late ? `${days} ${days === 1 ? "day" : "days"} overdue, was due ${showDate(e.date)}` : `Due ${showDate(e.date)}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-muted">{num(e.amount)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums text-muted">{num(e.received)}</td>
                  <td className="py-3 pr-4 text-right font-semibold tabular-nums text-foreground">{num(e.remaining)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">
                    <button
                      onClick={() => onRecord(e)}
                      className={clsx("rounded-lg px-3 py-1.5 text-xs font-semibold", late ? "bg-accent text-accent-foreground hover:opacity-90" : "border border-accent/40 text-accent hover:bg-accent hover:text-accent-foreground")}
                    >
                      {out ? "Record spent" : "Record received"}
                    </button>
                    <button onClick={() => onClose(e)} className="ml-1 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-subtle hover:text-foreground">Close</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 5 && (
        <button onClick={() => setAll((a) => !a)} className="w-full border-t border-border py-2.5 text-sm font-medium text-accent hover:bg-subtle">
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}

// ── The weekly report: the picture behind the numbers ──
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
      <div className="pt-1">
        <h2 className="text-xl text-foreground">Weekly report</h2>
        <p className="text-sm text-muted">The picture behind the numbers, in {active}.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={clsx(card, "p-5")}>
          <h3 className="text-base font-semibold text-foreground">Last four weeks</h3>
          <div className="mb-4 mt-1 flex gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-foreground" /> Revenue</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-accent" /> Expenses</span>
          </div>
          <div className="flex" role="img" aria-label={`Actual revenue and expenses for the last four weeks in ${active}`}>
            {weeks.map((w) => (
              <div key={w.week} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-32 items-end gap-1 border-b border-border">
                  <div title={`Revenue ${num(w.actualRevenue)}`} className="w-6 rounded-t bg-foreground" style={{ height: `${(w.actualRevenue / maxWeek) * 100}%`, minHeight: w.actualRevenue ? 2 : 0 }} />
                  <div title={`Expenses ${num(w.actualExpense)}`} className="w-6 rounded-t bg-accent" style={{ height: `${(w.actualExpense / maxWeek) * 100}%`, minHeight: w.actualExpense ? 2 : 0 }} />
                </div>
                <span className="text-xs text-muted">{showDate(w.week)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={clsx(card, "p-5")}>
          <h3 className="text-base font-semibold text-foreground">Where the money went</h3>
          <p className="mb-3 mt-0.5 text-xs text-muted">{fixed ? `Fixed costs ${num(fixed.fixed)}, one-off costs ${num(fixed.oneOff)}` : "Rent or salaries can make one week look higher."}</p>
          {categories.length === 0 ? <p className="py-6 text-center text-sm text-muted">No expenses in this period.</p> : (
            <ul className="space-y-2">
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
        <div className={clsx(card, "p-5")}>
          <h3 className="mb-3 text-base font-semibold text-foreground">Where the money came from</h3>
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

        <div className={clsx(card, "p-5")}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-foreground">Money still owed</h3>
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
  const from = e.origin === "TASK" ? "Task" : e.origin === "DEAL" ? "Deal" : e.dealId ? "Linked to a deal" : e.taskId ? "Linked to a task" : e.isFixed ? `Fixed, ${e.repeat === "WEEKLY" ? "weekly" : "monthly"}` : e.origin === "MIGRATED" ? "Moved from a deal" : "—";
  const income = e.type === "REVENUE";
  return (
    <tr className="hover:bg-subtle/50">
      <td className="whitespace-nowrap px-3 py-2.5 text-muted">{showDate(e.date)}</td>
      <td className="max-w-[280px] px-3 py-2.5">
        <p className="truncate font-medium text-foreground">{e.description ?? "—"}</p>
        {e.category && <p className="truncate text-xs text-muted">{e.category}</p>}
      </td>
      <td className="px-3 py-2.5"><span className={clsx("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", kind.style)}>{kind.label}</span></td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted">
        {from}
        {e.status === "EXPECTED" && !!e.received && <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">{e.received >= e.amount ? (e.type === "EXPENSE" ? "Spent" : "Received") : `${num(e.received)} ${e.type === "EXPENSE" ? "spent" : "received"}`}</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted">{e.createdByName ?? "—"}</td>
      <td className={clsx("whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums", income ? "text-emerald-700" : "text-foreground", e.status === "EXPECTED" && "opacity-70")}>
        <span className="mr-1 text-xs font-normal text-muted">{e.currency}</span>{income ? "+" : "\u2212"}{num(e.amount)}
      </td>
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