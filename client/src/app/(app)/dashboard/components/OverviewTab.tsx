"use client";

import { clsx } from "clsx";
import { ArrowRight, CheckCircle2, TrendingDown, TrendingUp, Minus, Wallet } from "lucide-react";
import { formatMoney as fmt, plural } from "@/lib/format";
import type { CompanyDash } from "./types";
import type { Alert, StatData, Trend } from "./insights";
import { MoneyTile, Panel, RING, Ring, TONE, card, label } from "./ui";

function TrendLine({ trend }: { trend: Trend }) {
  const Icon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  const colour = trend.good === null ? "text-muted" : trend.good ? "text-emerald-600" : "text-accent";
  return (
    <span className={clsx("inline-flex items-center gap-1 font-medium", colour)}>
      <Icon size={13} strokeWidth={2.25} aria-hidden /> {trend.text}
    </span>
  );
}

// A ring for the share, the number, and either how it moved or what it is out of.
function StatCard({ stat }: { stat: StatData }) {
  return (
    <div className={clsx(card, "flex items-center gap-3 p-4")} title={stat.title}>
      <Ring value={stat.ratio} className={RING[stat.tone]} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="type-colhead"><span className={TONE[stat.tone]}>{stat.label}</span></span>
          <span className="shrink-0 text-xs text-muted">{stat.scope}</span>
        </div>
        <div className={clsx("type-kpi truncate", stat.flag ? "text-accent" : stat.empty ? "text-muted" : "text-foreground")}>{stat.display}</div>
        <div className="min-h-[1.125rem] truncate text-xs">
          {stat.trend ? <TrendLine trend={stat.trend} /> : stat.sub ? <span className="text-muted">{stat.sub}</span> : null}
        </div>
      </div>
    </div>
  );
}

function AttentionCard({ alerts, onGo }: { alerts: Alert[]; onGo: (tab: string) => void }) {
  return (
    <Panel
      title="Needs your attention"
      aside={alerts.length > 0 ? <span className="rounded-full bg-accent/15 px-2 text-xs font-medium tabular-nums text-accent">{alerts.length}</span> : undefined}
    >
      {alerts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-600"><CheckCircle2 size={20} /></span>
          <p className="text-sm font-semibold text-foreground">You&apos;re all caught up</p>
          <p className="text-xs text-muted">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {alerts.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => onGo(a.tab)} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle/50">
                <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", a.tone === "bad" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600")}>
                  <a.icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{a.title}</span>
                  <span className="block truncate text-xs text-muted">{a.body}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent">
                  Review <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// Paid is green, part paid amber, overdue red; the rest are neutral. Biggest first.
const stageBar = (stage: string) => {
  const v = stage.toLowerCase();
  if (v === "paid") return "bg-emerald-500";
  if (v === "overdue") return "bg-red-500";
  if (v === "partial") return "bg-amber-500";
  if (v.includes("won")) return "bg-emerald-500";
  if (v.includes("lost")) return "bg-foreground/25";
  if (v.includes("hold")) return "bg-amber-500";
  return "bg-foreground/55";
};

function StageCard({ stages, total }: { stages: CompanyDash["byStage"]; total: number }) {
  const sorted = [...stages].sort((a, b) => b.count - a.count || a.dealStage.localeCompare(b.dealStage));
  const max = Math.max(...sorted.map((s) => s.count), 1);
  return (
    <Panel title="Deals by payment" aside={<span className="text-xs text-muted">{plural(total, "deal")}</span>}>
      {sorted.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">No deals yet.</p>
      ) : (
        <ul className="px-4 py-2">
          {sorted.map((s) => (
            <li key={s.dealStage} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-28 shrink-0 truncate text-foreground" title={label(s.dealStage)}>{label(s.dealStage)}</span>
              <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                <span className={clsx("block h-full rounded-full", stageBar(s.dealStage))} style={{ width: `${(s.count / max) * 100}%` }} />
              </span>
              <span className="w-5 shrink-0 text-right font-medium tabular-nums text-foreground">{s.count}</span>
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted">{total ? Math.round((s.count / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// Where the money stands in one bar: collected, invoiced but unpaid, and not invoiced yet.
function RevenueCard({ revenue }: { revenue: CompanyDash["revenue"] }) {
  const received = Math.max(0, revenue.revenueReceived);
  const owed = Math.max(0, revenue.outstanding);
  const notInvoiced = Math.max(0, revenue.revenuePotential - received - owed);
  const whole = Math.max(revenue.revenuePotential, received + owed, 1);
  const parts = [
    { key: "received", label: "Received", amount: received, bar: "bg-emerald-500", text: "text-foreground" },
    { key: "owed", label: "Still owed", amount: owed, bar: "bg-accent", text: owed > 0 ? "text-accent" : "text-foreground" },
    { key: "open", label: "Not invoiced yet", amount: notInvoiced, bar: "bg-foreground/20", text: "text-foreground" },
  ];
  return (
    <Panel title="Revenue" aside={<span className="text-xs text-muted">Expected {fmt(revenue.revenuePotential)}</span>}>
      <div className="space-y-4 px-4 py-4">
        <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-foreground/[0.06]" role="img" aria-label="Revenue split">
          {parts.map((p) => p.amount > 0 && <span key={p.key} className={p.bar} style={{ width: `${(p.amount / whole) * 100}%` }} />)}
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {parts.map((p) => (
            <div key={p.key}>
              <dt className="flex items-center gap-1.5 text-xs text-muted"><span className={clsx("h-2 w-2 rounded-full", p.bar)} />{p.label}</dt>
              <dd className={clsx("mt-1 font-display text-lg font-semibold tabular-nums", p.text)}>{fmt(p.amount)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  );
}

export function OverviewTab({ data, isBapx, stats, alerts, onGo }: {
  data: CompanyDash; isBapx: boolean; stats: StatData[]; alerts: Alert[]; onGo: (tab: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => <StatCard key={s.key} stat={s} />)}
      </div>

      {/* Attention + pipeline: same shell, same height */}
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3"><AttentionCard alerts={alerts} onGo={onGo} /></div>
        <div className="lg:col-span-2"><StageCard stages={(data.byPayment ?? []).map((p) => ({ dealStage: p.status, count: p.count }))} total={data.total} /></div>
      </div>

      {isBapx ? (
        <MoneyTile icon={Wallet} label="Target value" amount={data.revenue.revenuePotential} display={fmt(data.revenue.revenuePotential)} hint="Everything your deals could bring in" />
      ) : (
        <RevenueCard revenue={data.revenue} />
      )}
    </div>
  );
}
