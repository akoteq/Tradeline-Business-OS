import { LedgerSection } from "../ui";

// Labels and descriptions are the ones shown in the product. Colour is never the only signal.
const statuses = [
  { label: "Overdue", detail: "Deadline passed, target missed", dot: "bg-red-600" },
  { label: "Behind", detail: "Well behind where it should be", dot: "bg-rose-500" },
  { label: "At risk", detail: "Slipping, needs attention soon", dot: "bg-amber-500" },
  { label: "Stale", detail: "No update in 7 days", dot: "bg-slate-400" },
  { label: "On track", detail: "Right where it should be", dot: "bg-emerald-600" },
  { label: "Achieved", detail: "Target reached", dot: "bg-sky-600" },
];

export function Performance() {
  return (
    <LedgerSection
      id="performance"
      title="One shared definition of how every target is doing."
      lede="Every KPI has an owner, a target, an actual figure, a trend and a review. Each one sits in exactly one of six statuses."
    >
      <ul className="divide-y divide-border border-y border-border">
        {statuses.map((s) => (
          <li key={s.label} className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 py-5 sm:grid-cols-[auto_11rem_1fr]">
            <span className={`size-2.5 translate-y-px rounded-full ${s.dot}`} aria-hidden="true" />
            <span className="font-display text-lg font-semibold">{s.label}</span>
            <span className="col-start-2 text-base text-muted sm:col-start-3">{s.detail}</span>
          </li>
        ))}
      </ul>
    </LedgerSection>
  );
}
