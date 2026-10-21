"use client";

import { clsx } from "clsx";
import { BarChart3, CalendarX, AlertCircle, AlertTriangle, Clock, CheckCircle2, Target, type LucideIcon } from "lucide-react";
import { KPI_STATUS_LABEL, KPI_STATUS_HINT, type KpiStatus, type KpiRow } from "@/components/kpi";

// Summary cards, worst first. The other statuses (Not started, No target, Draft) are in the filter menu.
const CARD_STATUSES: KpiStatus[] = ["OVERDUE", "OFF_TRACK", "AT_RISK", "STALE", "ON_TRACK", "ACHIEVED"];
// One-line captions for the cards. The longer explanation stays in the hover tooltip.
const CARD_HINT: Partial<Record<KpiStatus, string>> = {
  OVERDUE: "Deadline passed, target missed",
  OFF_TRACK: "Well behind where it should be",
  AT_RISK: "Slipping, needs attention soon",
  STALE: "No update in 7 days",
  ON_TRACK: "Right where it should be",
  ACHIEVED: "Target reached",
};
type CardLook = { Icon: LucideIcon; card: string; icon: string; label: string; bar: string };
const STATUS_CARD: Partial<Record<KpiStatus, CardLook>> = {
  OVERDUE: { Icon: CalendarX, card: "bg-red-50/70 border-red-200", icon: "bg-red-600 text-white", label: "text-red-700", bar: "bg-red-600" },
  OFF_TRACK: { Icon: AlertCircle, card: "bg-red-50/70 border-red-100", icon: "bg-red-100 text-red-500", label: "text-red-600", bar: "bg-red-400" },
  AT_RISK: { Icon: AlertTriangle, card: "bg-amber-50/70 border-amber-100", icon: "bg-amber-100 text-amber-600", label: "text-amber-600", bar: "bg-amber-500" },
  STALE: { Icon: Clock, card: "bg-surface border-border", icon: "bg-foreground/5 text-muted", label: "text-foreground/70", bar: "bg-zinc-400" },
  ON_TRACK: { Icon: CheckCircle2, card: "bg-emerald-50/70 border-emerald-100", icon: "bg-emerald-100 text-emerald-600", label: "text-emerald-600", bar: "bg-emerald-500" },
  ACHIEVED: { Icon: Target, card: "bg-sky-50/70 border-sky-100", icon: "bg-sky-100 text-sky-600", label: "text-sky-600", bar: "bg-sky-500" },
};
// These two get a live pulse when anything is in them — they're the ones that need action.
const PULSE_STATUSES: KpiStatus[] = ["OVERDUE", "OFF_TRACK"];

// Ring gauge: the achievement number as a dial. Progress uses the accent colour.
function Ring({ pct, size = 92 }: { pct: number | null; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-accent)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-xl font-semibold tabular-nums leading-none">{pct != null ? pct : "—"}{pct != null && <span className="text-[11px] font-medium opacity-60">%</span>}</span>
      </div>
    </div>
  );
}

function AchievementCard({ avg, withTarget, live, counts, total }: {
  avg: number | null; withTarget: number; live: number; counts: Record<string, number>; total: number;
}) {
  return (
    <div className="col-span-2 sm:col-span-3 lg:col-span-1 lg:row-span-2 rounded-2xl bg-primary text-accent-foreground p-4 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/5 blur-2xl" />
      <div className="flex items-center gap-2 relative">
        <BarChart3 size={16} className="opacity-80" />
        <span className="text-[13px] font-medium opacity-90">Overall progress</span>
      </div>
      <div className="flex items-center gap-4 relative">
        <Ring pct={avg} />
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider opacity-50">Being tracked</div>
          <div className="text-2xl font-semibold tabular-nums leading-tight">{live}</div>
          <div className="text-[11px] opacity-60 leading-snug">
            {live ? `${withTarget} with a target` : "Set a target to start tracking"}
          </div>
        </div>
      </div>
      {/* Distribution: how every KPI splits across statuses */}
      <div className="relative">
        <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-white/15 gap-px">
          {total > 0 && CARD_STATUSES.map((s) => (counts[s] ?? 0) > 0 && (
            <div key={s} className={STATUS_CARD[s]!.bar} style={{ width: `${((counts[s] ?? 0) / total) * 100}%` }} title={`${KPI_STATUS_LABEL[s]}: ${counts[s]}`} />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] opacity-50">
          <span>Status split</span>
          <span>{total} KPI{total === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ status, count, total, active, onClick }: {
  status: KpiStatus; count: number; total: number; active: boolean; onClick: () => void;
}) {
  const look = STATUS_CARD[status]!;
  const share = total > 0 ? Math.round((count / total) * 100) : 0;
  const pulse = PULSE_STATUSES.includes(status) && count > 0;
  return (
    <button
      onClick={onClick}
      title={KPI_STATUS_HINT[status]}
      className={clsx(
        "group relative overflow-hidden rounded-xl border px-3.5 pt-2.5 pb-3 text-left transition-all shadow-sm hover:-translate-y-px hover:shadow",
        look.card,
        active ? "ring-2 ring-accent border-accent" : "hover:border-accent/40",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={clsx("relative h-6 w-6 rounded-md grid place-items-center shrink-0", look.icon)}>
          <look.Icon size={13} />
          {pulse && (
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
          )}
        </span>
        <span className={clsx("text-[13px] font-semibold truncate", look.label)}>{KPI_STATUS_LABEL[status]}</span>
        <span className="ml-auto text-[10.5px] tabular-nums text-muted">{share}%</span>
      </div>
      <div className="mt-1.5 flex items-end gap-2">
        <span className="text-2xl font-semibold text-foreground tabular-nums leading-none">{count}</span>
        <span className="text-[11px] text-muted leading-tight truncate pb-px">{CARD_HINT[status] ?? KPI_STATUS_HINT[status]}</span>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-foreground/5">
        <span className={clsx("block h-full transition-all duration-500", look.bar)} style={{ width: `${share}%` }} />
      </span>
    </button>
  );
}

// Achievement spans two rows; six compact status cards in 2 × 3. Click a status to filter.
export function KpiSummary({ board, statusFilter, onStatus }: {
  board: KpiRow[]; statusFilter: KpiStatus | ""; onStatus: (s: KpiStatus | "") => void;
}) {
  const counts = board.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  // Achievement covers every live KPI with a target, so a few good ones can't hide the rest.
  const judged = board.filter((r) => r.status !== "DRAFT" && r.status !== "NOT_STARTED");
  const scored = judged.filter((r) => r.attainment != null);
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + Math.min(100, r.attainment ?? 0), 0) / scored.length) : null;
  const withTarget = judged.filter((r) => r.target != null).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[minmax(280px,1.1fr)_repeat(3,minmax(0,1fr))] gap-3">
      <AchievementCard avg={avg} withTarget={withTarget} live={judged.length} counts={counts} total={board.length} />
      {CARD_STATUSES.map((s) => (
        <StatusCard
          key={s} status={s} count={counts[s] ?? 0} total={board.length} active={statusFilter === s}
          onClick={() => onStatus(statusFilter === s ? "" : s)}
        />
      ))}
    </div>
  );
}
