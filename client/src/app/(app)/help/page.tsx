import { PriorityBadge, TaskStatusBadge } from "@/components/Badges";

// A plain-language dictionary of the system, aimed at newly invited members.

type Def = { term: string; desc: string; badge?: React.ReactNode };

const SECTIONS: { id: string; title: string }[] = [
  { id: "overview", title: "What is this system?" },
  { id: "companies", title: "The Companies" },
  { id: "roles", title: "Roles & Access" },
  { id: "pipeline", title: "Deals" },
  { id: "revenue", title: "Revenue & Payment" },
  { id: "leads", title: "Leads & Clients" },
  { id: "scheme", title: "Scheme of Work" },
  { id: "grants", title: "Grants, Loans & Partnerships" },
  { id: "alerts", title: "Alerts & Notifications" },
  { id: "pages", title: "The Pages / Menu" },
];

const COMPANIES: Def[] = [
  { term: "BAPX", desc: "Business advisory and support for SMEs. Its deals track advisory work, its value, the money received and the balance." },
  { term: "Tradeline Consult", desc: "Investment and grant facilitation for institutional clients. Tracks the full money picture — potential, expected, received and outstanding revenue — plus grant applications." },
  { term: "Alpha Africa Consult Ltd", desc: "A group company. Its deals show the value, the money received and the balance." },
  { term: "Finance Factory Limited", desc: "A group company. Its deals show the value, the money received and the balance." },
  { term: "Community Finance Ltd", desc: "A group company. Its deals show the value, the money received and the balance." },
  { term: "Akoteq Ltd", desc: "A group company. Its deals show the value, the money received and the balance." },
];

const ROLES: Def[] = [
  { term: "Admin", desc: "Full access. Can manage BDOs and user logins, and see every company's data. An admin can also be linked to a BDO profile, in which case they additionally get a personal 'My BDO Dashboard'." },
  { term: "CEO", desc: "A leadership view. Lands on the main dashboard with the group-wide overview across all companies." },
  { term: "BDO (Business Development Officer)", desc: "Owns a set of clients and deals. Signs in and lands on their own dashboard for their company only, and sees only their own deals, clients, tasks and alerts." },
];

const REVENUE: Def[] = [
  { term: "Deal value", desc: "What the client agreed to pay. Saving a deal adds it as expected revenue in Finance." },
  { term: "Actual revenue", desc: "Money that has come in. Only the Business CEO adds it, by hand, and can link it to a deal." },
  { term: "Received", desc: "The actual revenue linked to a deal so far." },
  { term: "Balance", desc: "What is still owed: Deal value minus Received." },
  { term: "Unpaid, Part paid, Paid, Overdue", desc: "Worked out for you from the money received and the expected payment date." },
  { term: "Cancelled", desc: "Won work that fell through. Its balance stops counting as owed. It can be restored." },
  { term: "Expected and actual", desc: "Always kept apart, so you can compare what you planned with what happened." },
];

const PAYMENT: Def[] = [
  { term: "Paid", desc: "The client has fully paid." },
  { term: "Unpaid", desc: "Nothing has been received yet." },
  { term: "Partial", desc: "Some money received; a balance is still outstanding." },
  { term: "Overdue", desc: "A payment is past its due date." },
];

const TIER_PRIORITY: Def[] = [
  { term: "Tier 1 / 2 / 3", desc: "How important or high-value a client is. Tier 1 is the highest priority; Tier 3 the lowest." },
  { term: "Priority", badge: <span className="flex gap-1"><PriorityBadge value="HIGH" /><PriorityBadge value="MEDIUM" /><PriorityBadge value="LOW" /></span>, desc: "How urgently a deal or task should be worked on — High, Medium or Low." },
];

const LEADS: Def[] = [
  { term: "Lead", desc: "A potential client we haven't converted yet — the very top of the funnel, before it becomes a tracked deal." },
  { term: "Lead Status", desc: "New → Contacted → Qualified → In Progress → Converted (became a client/deal) or Lost." },
  { term: "Client / SME", desc: "A business we work with. 'SME' means Small & Medium Enterprise. Clients are shared across the system and linked to deals and BDOs." },
];

const SCHEME: Def[] = [
  { term: "Scheme of Work", desc: "Each BDO's plan of what they need to deliver — their tasks and client proposals, with target dates. BDOs see and manage their own; admins and the CEO see everyone's." },
  { term: "Task", desc: "A piece of work to be done with a target date." },
  { term: "Proposal", desc: "A Scheme-of-Work entry that represents a client proposal, with a value and an outcome (see below)." },
  { term: "Task Status", badge: <span className="flex flex-wrap gap-1"><TaskStatusBadge value="PENDING" /><TaskStatusBadge value="IN_PROGRESS" /><TaskStatusBadge value="COMPLETED" /><TaskStatusBadge value="OVERDUE" /><TaskStatusBadge value="CANCELLED" /></span>, desc: "Where a task stands. 'Overdue' means its target date has passed and it isn't done." },
  { term: "Proposal Outcome", desc: "Draft → Sent → Accepted, Rejected, or No Response." },
];

const GRANTS: Def[] = [
  { term: "Grants & Loans", desc: "Funding applications facilitated for clients (mainly on the Tradeline side)." },
  { term: "Grant Status", desc: "Draft → Submitted → Under Review → Approved → Disbursed. It can also be Rejected or Withdrawn." },
  { term: "Partnership", desc: "An ongoing relationship with a partner organisation." },
  { term: "Partnership Status", desc: "Active, Pending, Expired or Suspended." },
];

const PAGES: Def[] = [
  { term: "Dashboard", desc: "Your home screen. The CEO/Admin dashboard shows the whole group; a BDO dashboard shows that person's own numbers." },
  { term: "Deals", desc: "The list of a company's won work, with the value, money received and balance of each." },
  { term: "Finance", desc: "A company's expected and actual money, per currency, with the weekly report. Staff see My expenses instead." },
  { term: "Leads DB", desc: "The list of potential clients not yet converted." },
  { term: "Client Overview", desc: "The directory of all clients (SMEs) and who owns them." },
  { term: "Scheme of Work", desc: "Your tasks and proposals with their target dates." },
  { term: "Grants & Loans", desc: "The funding applications and their status." },
  { term: "Partnerships", desc: "Partner organisations and the state of each relationship." },
  { term: "KPI Scorecard", desc: "Performance measures tracked over time." },
  { term: "Consolidated", desc: "A combined roll-up view of records across the group." },
  { term: "Projects", desc: "Internal projects being tracked." },
  { term: "Manage BDOs / Manage Users", desc: "Admin-only: create and edit BDO profiles and the login accounts that map to them." },
];

const ALERTS: Def[] = [
  { term: "Upcoming Deadlines", desc: "A pop-up and banner that flags deals and Scheme-of-Work items with a due or target date within the next 7 days." },
  { term: "Needs Attention (Stale)", desc: "Open deals that haven't been updated in 14 days or more — a reminder to follow up." },
  { term: "Who sees what", desc: "A BDO only gets alerts for their own work; admins and the CEO see alerts across the whole group." },
];

export default function HelpPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Help &amp; Glossary</h1>
        <p className="text-sm text-muted mt-1">
          A plain-language guide to the Tradeline Business Operating System — what the data means and how the system is organised. New to the team? Start here.
        </p>
      </header>

      {/* Table of contents */}
      <nav className="bg-surface rounded-xl border border-border shadow-card p-4">
        <p className="type-colhead mb-3">On this page</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-sm text-accent hover:text-accent/80 hover:underline underline-offset-2"
            >
              {s.title}
            </a>
          ))}
        </div>
      </nav>

      <Section id="overview" title="What is this system?">
        <p className="text-sm text-foreground/80 leading-relaxed">
          The Tradeline Business Operating System is one shared place to run the group&apos;s business development. It tracks the
          <strong className="text-foreground"> clients</strong> we work with, the <strong className="text-foreground">deals</strong> in each company&apos;s pipeline, the <strong className="text-foreground">money</strong> expected and received,
          the <strong className="text-foreground">leads</strong> we&apos;re chasing, each officer&apos;s <strong className="text-foreground">tasks and proposals</strong>, and funding like <strong className="text-foreground">grants and loans</strong>.
          Everyone works from the same data, so the leadership can see the whole picture while each officer focuses on their own.
        </p>
      </Section>

      <Section id="companies" title="The Companies">
        <p className="text-sm text-muted mb-3">The system covers six companies. Each has its own pipeline; BAPX and Tradeline are the two main ones.</p>
        <DefList defs={COMPANIES} />
      </Section>

      <Section id="roles" title="Roles & Access">
        <DefList defs={ROLES} />
      </Section>

      <Section id="pipeline" title="Deals & Pipeline">
        <p className="text-sm text-foreground/80 leading-relaxed mb-3">
          A <strong className="text-foreground">deal</strong> is an opportunity with a specific client. The <strong className="text-foreground">pipeline</strong> is all of a company&apos;s deals together.
          Every deal has a <strong className="text-foreground">stage</strong> (how far along it is) and a <strong className="text-foreground">health</strong> (whether it&apos;s going well), plus a tier and priority.
        </p>
        <DefList defs={TIER_PRIORITY} />
      </Section>

      <Section id="stages" title="Deal Stages">
        <p className="text-sm text-muted mb-3">The steps a deal moves through, from first look to won or lost.</p>
        <DefList defs={STAGES} />
      </Section>

      <Section id="health" title="Deal Health">
        <p className="text-sm text-muted mb-3">A quick read on whether a deal is on track.</p>
        <DefList defs={HEALTH} />
      </Section>

      <Section id="revenue" title="Revenue & Payment">
        <p className="text-sm text-muted mb-3">How the money on a deal is tracked (mainly for Tradeline and the group companies). Amounts are in Ghana Cedis (GHS).</p>
        <DefList defs={REVENUE} />
        <p className="type-colhead mt-5 mb-3">Payment Status</p>
        <DefList defs={PAYMENT} />
      </Section>

      <Section id="leads" title="Leads & Clients">
        <DefList defs={LEADS} />
      </Section>

      <Section id="scheme" title="Scheme of Work">
        <DefList defs={SCHEME} />
      </Section>

      <Section id="grants" title="Grants, Loans & Partnerships">
        <DefList defs={GRANTS} />
      </Section>

      <Section id="alerts" title="Alerts & Notifications">
        <DefList defs={ALERTS} />
      </Section>

      <Section id="pages" title="The Pages / Menu">
        <p className="text-sm text-muted mb-3">What each item in the left-hand menu is for.</p>
        <DefList defs={PAGES} />
      </Section>

      <p className="text-xs text-muted pt-2">
        Something unclear or missing? Ask an admin to update this guide.
      </p>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 bg-surface rounded-xl border border-border shadow-card p-5">
      <h2 className="text-lg font-semibold text-foreground mb-3">{title}</h2>
      {children}
    </section>
  );
}

function DefList({ defs }: { defs: Def[] }) {
  return (
    <dl className="divide-y divide-border">
      {defs.map((d) => (
        <div
          key={d.term}
          className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-4 py-3 first:pt-0 last:pb-0"
        >
          <dt className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap content-start">
            <span>{d.term}</span>
            {d.badge}
          </dt>
          <dd className="text-sm text-muted leading-relaxed">{d.desc}</dd>
        </div>
      ))}
    </dl>
  );
}