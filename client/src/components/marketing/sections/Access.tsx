import { LedgerSection } from "../ui";

// Mirrors how the app routes people after login (Home page and login page).
const roles = [
  {
    name: "Group Owner",
    detail: "The full group view: every company, approvals, deals and the items that need attention.",
  },
  {
    name: "Business CEO",
    detail: "Lands on the dashboard for their own company.",
  },
  {
    name: "Team member",
    detail: "Lands on their own overview and tasks.",
  },
];

export function Access() {
  return (
    <LedgerSection
      id="access"
      title="Each role starts from the right view."
      lede="Group Owners decide who has access, and to what, from Team & access."
    >
      <dl className="grid divide-y divide-border border-y border-border md:grid-cols-3 md:divide-x md:divide-y-0">
        {roles.map((r) => (
          <div key={r.name} className="py-6 md:px-6 md:first:pl-0 md:last:pr-0">
            <dt className="font-display text-lg font-semibold">{r.name}</dt>
            <dd className="mt-2 text-base text-muted">{r.detail}</dd>
          </div>
        ))}
      </dl>
    </LedgerSection>
  );
}
