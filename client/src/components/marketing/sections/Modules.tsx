import { LedgerSection } from "../ui";

// Groups and item names mirror the sidebar in the product, so what visitors read here is what
// they will find after logging in.
const groups = [
  {
    name: "Sales & contacts",
    items: [
      { term: "Leads", detail: "Prospects before they become customers." },
      { term: "Clients", detail: "The customers you have won." },
      { term: "Contacts", detail: "The people behind every lead and client." },
    ],
  },
  {
    name: "Money",
    items: [
      { term: "Group finances", detail: "Finances across the group in one view." },
      { term: "Grants & loans", detail: "Tracked alongside everything else." },
    ],
  },
  {
    name: "Performance",
    items: [
      { term: "Company KPIs", detail: "Targets for each business and department." },
      { term: "Individual KPIs", detail: "Targets for each person." },
    ],
  },
  {
    name: "Risk & compliance",
    items: [
      { term: "Compliance", detail: "Obligations in one place." },
      { term: "Risks", detail: "The risks you are managing." },
    ],
  },
  {
    name: "Manage",
    items: [
      { term: "Assign tasks", detail: "Hand work to the right person, with approval." },
      { term: "Team & access", detail: "Add people and control what each can see." },
      { term: "Add a company", detail: "Bring another business into the group." },
    ],
  },
];

export function Modules() {
  return (
    <LedgerSection
      id="modules"
      title="Everything your group runs on, in one system."
      lede="Organised the same way inside the product, so nothing here is a surprise after you log in."
    >
      <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.name} className="border-t border-border pt-4">
            <h3 className="type-colhead">{g.name}</h3>
            <dl className="mt-4 space-y-4">
              {g.items.map((it) => (
                <div key={it.term}>
                  <dt className="font-display text-base font-semibold">{it.term}</dt>
                  <dd className="text-base text-muted">{it.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </LedgerSection>
  );
}
