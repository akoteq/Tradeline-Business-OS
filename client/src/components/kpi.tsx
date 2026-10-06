import { Zap, X } from "lucide-react";
import { clsx } from "clsx";

// Shared KPI status vocabulary. Mirrors computeAttainment in server/src/models/KpiDefinition.ts —
// the server computes status, this only styles it.
export type KpiStatus = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "NO_TARGET" | "ACHIEVED" | "STALE";

export const KPI_STATUS_LIST: KpiStatus[] = ["OFF_TRACK", "AT_RISK", "STALE", "ON_TRACK", "ACHIEVED", "NO_TARGET"];

export const KPI_STATUS_STYLE: Record<KpiStatus, string> = {
  ON_TRACK: "bg-emerald-500/10 text-emerald-700",
  AT_RISK: "bg-amber-500/10 text-amber-700",
  OFF_TRACK: "bg-red-500/10 text-red-700",
  ACHIEVED: "bg-sky-500/10 text-sky-700",
  STALE: "bg-foreground/10 text-foreground/70",
  NO_TARGET: "bg-foreground/5 text-muted",
};
export const KPI_STATUS_BAR: Record<KpiStatus, string> = {
  ON_TRACK: "bg-emerald-500", AT_RISK: "bg-amber-500", OFF_TRACK: "bg-red-500",
  ACHIEVED: "bg-sky-500", STALE: "bg-foreground/30", NO_TARGET: "bg-border",
};
export const KPI_STATUS_LABEL: Record<KpiStatus, string> = {
  ON_TRACK: "On Track", AT_RISK: "At Risk", OFF_TRACK: "Behind", ACHIEVED: "Achieved", STALE: "Stale", NO_TARGET: "No Target",
};
export const KPI_STATUS_HINT: Record<KpiStatus, string> = {
  ON_TRACK: "At or ahead of where you should be by now",
  AT_RISK: "60–89% of where you should be by now",
  OFF_TRACK: "Below 60% of where you should be by now",
  ACHIEVED: "Target reached",
  STALE: "No update in 7 days",
  NO_TARGET: "No target or actual yet",
};

export function fmtKpiVal(v: number | null | undefined, unit: string) {
  if (v == null) return "—";
  if (unit === "CURRENCY") return "GHS " + v.toLocaleString();
  if (unit === "PERCENT") return `${v}%`;
  if (unit === "SCORE") return `${v}/100`;
  if (unit === "DAYS") return `${v}d`;
  if (unit === "HOURS") return `${v}h`;
  return v.toLocaleString();
}

// Progress bar with a pace marker showing where the KPI should be by today.
export function PaceBar({ attainment, expected, status, className = "h-1.5" }: {
  attainment: number | null; expected: number | null; status: KpiStatus; className?: string;
}) {
  return (
    <div className={`relative flex-1 rounded-full bg-foreground/5 ${className}`}>
      <div
        className={`h-full rounded-full ${KPI_STATUS_BAR[status]}`}
        style={{ width: `${Math.min(100, Math.max(0, attainment ?? 0))}%` }}
      />
      {expected != null && expected > 0 && expected < 100 && (
        <div
          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground/60"
          style={{ left: `calc(${expected}% - 1px)` }}
          title={`Pace: ${expected}% expected by today`}
        />
      )}
    </div>
  );
}

// Bottom sheet on phones, centred dialog from sm up.
export function KpiSheet({ title, subtitle, onClose, footer, children }: {
  title: React.ReactNode; subtitle?: string; onClose: () => void; footer: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose}>
      <div
        className={clsx("bg-surface shadow-xl border border-border w-full max-w-md max-h-[90vh] flex flex-col", "rounded-t-2xl sm:rounded-2xl")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-serif text-lg text-foreground flex items-center gap-2">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors shrink-0" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">{children}</div>
        <div className="px-5 py-3 border-t border-border flex flex-wrap justify-end gap-2 shrink-0">{footer}</div>
      </div>
    </div>
  );
}

export function AutoTag() {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-700 px-1.5 py-0.5 rounded"
      title="Actual is auto-calculated from live data"
    >
      <Zap size={9} /> Auto
    </span>
  );
}
