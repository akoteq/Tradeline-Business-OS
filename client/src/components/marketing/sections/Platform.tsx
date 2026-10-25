import { ScreenFrame } from "../ScreenFrame";
import { screens, type Screen } from "../screens";
import { Container } from "../ui";

type Row = { id: string; title: string; body: string; points: string[]; screen: Screen };

const rows: Row[] = [
  {
    id: "leads",
    title: "Every lead has an owner and a next date.",
    body: "Follow every prospect across all your businesses in one list. Filter by priority, source or owner, and see at once what is overdue or due this week.",
    points: [
      "Overdue and due-this-week views",
      "Private leads stay hidden until you share them",
      "Import leads in bulk and download the list",
    ],
    screen: screens.leads,
  },
  {
    id: "team",
    title: "Know who is on track and who needs support.",
    body: "Every KPI has an owner. Company and individual targets sit side by side, so accountability is visible rather than assumed. Work your team completes is approved before it counts.",
    points: [
      "Company and individual KPIs",
      "Tasks assigned and approved in one place",
      "Access set person by person",
    ],
    screen: screens.team,
  },
  {
    id: "ask",
    title: "Ask a question. Get an answer from your live data.",
    body: "Ask who is behind this month, or request a KPI summary, in plain language. Ask Trunqo can also prepare tasks for you.",
    points: [
      "Answers come from your live data",
      "Nothing is saved until you press Confirm",
      "Create tasks by asking for them",
    ],
    screen: screens.trunqoAi,
  },
];

export function Platform() {
  return (
    <section id="platform" aria-labelledby="platform-title" className="scroll-mt-16 border-t border-border">
      <Container className="py-20 lg:py-28">
        <h2 id="platform-title" className="max-w-3xl text-3xl font-semibold sm:text-4xl">
          Everything is built around an owner and a date.
        </h2>
        <p className="type-lede mt-4">
          Leads, KPIs and tasks each have someone responsible and a point in time, so progress can be seen instead of
          assumed.
        </p>

        <div className="mt-16 space-y-20 lg:mt-20 lg:space-y-28">
          {rows.map((row, i) => (
            <article key={row.id} className="grid items-center gap-8 lg:grid-cols-12 lg:gap-14">
              <div className={`lg:col-span-5 ${i % 2 === 1 ? "lg:order-2" : ""}`}>
                <h3 className="text-2xl font-semibold">{row.title}</h3>
                <p className="mt-4 text-base text-muted">{row.body}</p>
                <ul className="mt-6 space-y-3">
                  {row.points.map((p) => (
                    <li key={p} className="flex gap-3 text-base">
                      <span className="mt-2 size-1.5 shrink-0 rounded-sm bg-accent" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`lg:col-span-7 ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                <ScreenFrame screen={row.screen} sizes="(min-width: 1152px) 640px, (min-width: 1024px) 55vw, 100vw" />
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
