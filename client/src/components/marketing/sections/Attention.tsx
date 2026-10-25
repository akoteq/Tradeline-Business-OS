import { Briefcase, ClipboardCheck, Clock, Flag, Target } from "lucide-react";
import { LedgerSection } from "../ui";

const items = [
  { icon: Clock, term: "Deadlines", detail: "Ranked by urgency, soonest first." },
  { icon: Briefcase, term: "Deals", detail: "Flagged when they go quiet." },
  { icon: Flag, term: "Finances", detail: "Financial flags appear in the same feed." },
  { icon: Target, term: "Targets", detail: "KPIs that are behind or overdue." },
  { icon: ClipboardCheck, term: "Approvals", detail: "Finished work waiting for sign-off." },
];

export function Attention() {
  return (
    <LedgerSection
      id="attention"
      title="See what needs attention while there is still time to act."
      lede="Everything that needs a decision is surfaced together on your home screen, so you are not hunting through each business for it."
    >
      <ul className="divide-y divide-border border-y border-border">
        {items.map(({ icon: Icon, term, detail }) => (
          <li key={term} className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 py-5 sm:grid-cols-[auto_11rem_1fr]">
            <Icon size={18} className="translate-y-0.5 text-muted" aria-hidden="true" />
            <span className="font-display text-lg font-semibold">{term}</span>
            <span className="col-start-2 text-base text-muted sm:col-start-3">{detail}</span>
          </li>
        ))}
      </ul>
    </LedgerSection>
  );
}
