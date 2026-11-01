"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { useAuth } from "@/components/AuthProvider";
import { isGroupOwner } from "@/lib/auth";
import { KpiSheet } from "@/components/kpi";
import { ErrorNote, Label, btnPrimary, btnSecondary, inputClass, selectClass } from "../kpi-framework/components/fields";
import { Ring } from "../kpi-framework/components/KpiSummary";
import {
  BarChart3, CalendarX, Check, Copy, Hourglass, ListChecks, Mail, Phone, Search, Send, UserPlus, Users, type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";

type Login = "ACTIVE" | "PENDING" | "NONE";

/** GET /auth/team: everyone on the team, inactive included, with their login status. */
type Person = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string;
  role: string | null;
  isActive: boolean;
  login: Login;
};

/** GET /kpi-framework/team: each active person's KPIs and open work this month. */
type Workload = {
  person: { id: string };
  achievement: number | null;
  tracked: number;
  work: { open: number; overdue: number; blocked: number };
};

type InviteResult = { email: string; tempPassword: string; emailSent: boolean; emailError?: string };

type Filter = "all" | "signedIn" | "pending" | "none" | "inactive";

const FILTERS: [Filter, string][] = [
  ["all", "Everyone"],
  ["signedIn", "Signed in"],
  ["pending", "Invite pending"],
  ["none", "Not invited"],
  ["inactive", "Inactive"],
];

function matches(p: Person, f: Filter) {
  if (f === "all") return true;
  if (f === "inactive") return !p.isActive;
  if (!p.isActive) return false;
  return f === "signedIn" ? p.login === "ACTIVE" : f === "pending" ? p.login === "PENDING" : p.login === "NONE";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

// Quiet monogram tones from the Trunqo palette, picked per person so the roster scans easily.
const TONES = [
  "bg-accent/15 text-accent",
  "bg-primary/10 text-foreground",
  "bg-emerald-500/15 text-emerald-800",
  "bg-sky-500/15 text-sky-800",
  "bg-amber-500/15 text-amber-800",
];
function tone(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
// Same "YYYY-MM" local month the KPI pages use.
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const apiError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

// One shared grid so the header and every row line up. The Company column only shows for a
// Group Owner (a Business CEO sees one company).
const GRID_ONE = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_96px]";
const GRID_MANY = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_96px]";

export default function TeamPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { companies, byKey } = useCompanies();
  // The API limits a Business CEO to their own company; only a Group Owner picks one.
  const oneCompany = !isGroupOwner(user);
  const [companyFilter, setCompanyFilter] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [inviting, setInviting] = useState(false);
  // Shows the outcome of an invite sent from a row (email sent, or the password to pass on).
  const [sent, setSent] = useState<{ name: string; result: InviteResult } | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");

  const { data: people = [], isLoading, isError, refetch } = useQuery<Person[]>({
    queryKey: ["team"],
    queryFn: () => fetcher("/auth/team"),
  });
  const { data: workload = [] } = useQuery<Workload[]>({
    queryKey: ["kpi-team", thisMonth()],
    queryFn: () => fetcher(`/kpi-framework/team?period=${thisMonth()}`),
  });
  const workBy = new Map(workload.map((w) => [w.person.id, w]));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["team"] });
    qc.invalidateQueries({ queryKey: ["bdos"] });
    qc.invalidateQueries({ queryKey: ["kpi-team"] });
  };

  const sendInvite = async (p: Person) => {
    setSendingId(p.id); setRowError("");
    try {
      const res = await api.post(`/auth/team/${p.id}/invite`, {});
      setSent({ name: p.name, result: res.data });
      refresh();
    } catch (err) { setRowError(apiError(err, `Couldn't send ${p.name}'s invite.`)); }
    finally { setSendingId(null); }
  };

  const q = search.trim().toLowerCase();
  // Company + search narrow the pool; the filter chips count from this pool.
  const pool = people
    .filter((p) => oneCompany || !companyFilter || p.company === companyFilter)
    .filter((p) => !q || [p.name, p.role, p.email, p.phone].some((v) => v?.toLowerCase().includes(q)));
  const counts = Object.fromEntries(FILTERS.map(([f]) => [f, pool.filter((p) => matches(p, f)).length])) as Record<Filter, number>;

  // Active people first, those needing an invite next, then A–Z.
  const loginOrder: Record<Login, number> = { NONE: 0, PENDING: 1, ACTIVE: 2 };
  const rows = pool
    .filter((p) => matches(p, filter))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || loginOrder[a.login] - loginOrder[b.login] || a.name.localeCompare(b.name));

  // Summary across the active people in view.
  const active = pool.filter((p) => p.isActive);
  const needInvite = active.filter((p) => p.login !== "ACTIVE").length;
  const overdue = active.reduce((n, p) => n + (workBy.get(p.id)?.work.overdue ?? 0), 0);
  const openTasks = active.reduce((n, p) => n + (workBy.get(p.id)?.work.open ?? 0), 0);
  const scored = active.map((p) => workBy.get(p.id)?.achievement).filter((a): a is number => a != null);
  const avgKpi = scored.length ? Math.round(scored.reduce((s, a) => s + a, 0) / scored.length) : null;

  const companyName = user?.bdoCompany ? (byKey[user.bdoCompany]?.name ?? user.bdoCompany) : null;
  const subtitle = oneCompany && companyName
    ? `${plural(active.length, "person", "people")} at ${companyName}`
    : `${plural(active.length, "person", "people")} across ${plural(companies.length, "company", "companies")}`;

  const grid = oneCompany ? GRID_ONE : GRID_MANY;
  const filtering = !!q || !!companyFilter || filter !== "all";
  const clearFilters = () => { setSearch(""); setCompanyFilter(""); setFilter("all"); };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl text-foreground">Team</h1>
          <p className="text-sm text-muted mt-1">{isLoading ? "Loading your team…" : subtitle}</p>
        </div>
        <button onClick={() => setInviting(true)} className={clsx(btnPrimary, "inline-flex items-center gap-2")}>
          <UserPlus size={16} /> Invite someone
        </button>
      </div>

      {/* Summary: the team's progress leads, the cards beside it are what needs doing */}
      {!isLoading && !isError && people.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-3">
          <TeamCard
            avg={avgKpi} people={active.length} signedIn={active.filter((p) => p.login === "ACTIVE").length}
            pending={active.filter((p) => p.login === "PENDING").length} notInvited={active.filter((p) => p.login === "NONE").length}
          />
          <StatCard
            look="amber" Icon={Hourglass} label="Waiting to sign in" value={needInvite}
            hint={needInvite ? "Not invited yet, or invite unused" : "Everyone has signed in"}
            onClick={needInvite ? () => setFilter(counts.none ? "none" : "pending") : undefined}
            active={filter === "none" || filter === "pending"}
          />
          <StatCard look="red" Icon={CalendarX} label="Overdue tasks" value={overdue} hint={overdue ? "Past their due date" : "Nothing overdue"} pulse={overdue > 0} />
          <StatCard look="sky" Icon={ListChecks} label="Open tasks" value={openTasks} hint={`Across ${plural(active.length, "person", "people")}`} />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {!isLoading && !isError && people.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter the team">
            {FILTERS.filter(([key]) => key === "all" || counts[key] > 0 || filter === key).map(([key, label]) => {
              const selected = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  aria-pressed={selected}
                  className={clsx(
                    "h-8 px-3 rounded-full border text-sm transition-colors inline-flex items-center gap-1.5",
                    selected ? "bg-foreground text-white border-foreground" : "bg-surface border-border text-muted hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  {label}
                  <span className={clsx("tabular-nums text-xs", selected ? "text-white/70" : "text-muted/80")}>{counts[key]}</span>
                </button>
              );
            })}
          </div>
        ) : <span />}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!oneCompany && (
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              aria-label="Filter by company"
              className="h-9 text-sm bg-surface border border-border rounded-lg px-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="">All companies</option>
              {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          )}
          <div className="relative flex-1 sm:w-72 sm:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, title or email"
              aria-label="Search the team"
              className="w-full h-9 bg-surface border border-border rounded-lg pl-8 pr-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>
        </div>
      </div>

      <ErrorNote message={rowError} />

      {/* List */}
      <section className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className={clsx("hidden md:grid gap-4 px-4 py-2 border-b border-border bg-subtle/50 type-colhead", grid)}>
          <span>Name</span>
          {!oneCompany && <span>Company</span>}
          <span>Access</span>
          <span>Tasks</span>
          <span>KPIs this month</span>
          <span className="sr-only">Actions</span>
        </div>

        {isLoading ? (
          <ul className="divide-y divide-border/70" aria-busy="true" aria-label="Loading team">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-subtle" />
                <div className="space-y-1.5">
                  <div className="h-3 w-36 rounded bg-subtle" />
                  <div className="h-2.5 w-24 rounded bg-subtle" />
                </div>
              </li>
            ))}
          </ul>
        ) : isError ? (
          <EmptyState
            title="We couldn't load your team"
            body="Check your connection and try again."
            action={<button onClick={() => refetch()} className="text-sm font-medium text-accent hover:underline">Try again</button>}
          />
        ) : rows.length === 0 ? (
          people.length === 0 ? (
            <EmptyState
              title="No one is on the team yet"
              body="Invite the people you work with. They'll get an email with a link to sign in."
              action={<button onClick={() => setInviting(true)} className="text-sm font-medium text-accent hover:underline">Invite someone</button>}
            />
          ) : (
            <EmptyState
              title="No one matches those filters"
              body="Try a different name, or clear the filters."
              action={filtering ? <button onClick={clearFilters} className="text-sm font-medium text-accent hover:underline">Clear filters</button> : undefined}
            />
          )
        ) : (
          <ul className="divide-y divide-border/70">
            {rows.map((p) => {
              const w = workBy.get(p.id);
              return (
                <li
                  key={p.id}
                  className={clsx(
                    "px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 hover:bg-primary/[0.03] transition-colors",
                    grid,
                    !p.isActive && "opacity-60"
                  )}
                >
                  {/* Name + title */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${tone(p.id)}`}>
                      {initials(p.name) || "—"}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
                      <div className="text-xs text-muted truncate">
                        {p.role || "No title"}
                        {p.email && <span className="hidden lg:inline"> · {p.email}</span>}
                        {!oneCompany && <span className="md:hidden"> · {byKey[p.company]?.name ?? p.company}</span>}
                      </div>
                    </div>
                  </div>

                  {!oneCompany && (
                    <span className="hidden md:block text-sm text-foreground/80 truncate">{byKey[p.company]?.name ?? p.company}</span>
                  )}

                  {/* On phones, access, tasks and KPIs wrap onto a second line under the name */}
                  <div className="col-span-2 md:col-span-1 row-start-2 md:row-start-auto flex md:block items-center gap-3 flex-wrap">
                    <AccessPill person={p} />
                    <span className="md:hidden"><TaskSummary w={w} active={p.isActive} /></span>
                    <span className="md:hidden"><KpiSummary w={w} active={p.isActive} /></span>
                  </div>
                  <div className="hidden md:block"><TaskSummary w={w} active={p.isActive} /></div>
                  <div className="hidden md:block"><KpiSummary w={w} active={p.isActive} /></div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 justify-end row-start-1 col-start-2 md:row-start-auto md:col-start-auto">
                    {p.isActive && p.login !== "ACTIVE" && (
                      <button
                        onClick={() => sendInvite(p)}
                        disabled={sendingId === p.id || (p.login === "NONE" && !p.email)}
                        title={p.login === "NONE" && !p.email ? "Add an email to their profile first" : p.login === "PENDING" ? `Send ${p.name} a new invite` : `Invite ${p.name} to sign in`}
                        aria-label={p.login === "PENDING" ? `Resend invite to ${p.name}` : `Invite ${p.name}`}
                        className="p-2 rounded-lg text-accent hover:bg-accent/10 transition-colors disabled:text-foreground/20 disabled:hover:bg-transparent"
                      >
                        <Send size={15} className={clsx(sendingId === p.id && "animate-pulse")} />
                      </button>
                    )}
                    <ContactButton href={p.email ? `mailto:${p.email}` : null} label={p.email ? `Email ${p.name}` : `No email on file for ${p.name}`}>
                      <Mail size={15} />
                    </ContactButton>
                    <ContactButton href={p.phone ? `tel:${p.phone.replace(/\s+/g, "")}` : null} label={p.phone ? `Call ${p.name}` : `No phone on file for ${p.name}`}>
                      <Phone size={15} />
                    </ContactButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!isLoading && !isError && rows.length > 0 && filtering && (
        <p className="text-xs text-muted">Showing {rows.length} of {people.length}</p>
      )}
      {!isLoading && !isError && people.length > 0 && (
        <p className="text-xs text-muted">
          See each person&apos;s targets in <Link href="/my-kpis" className="text-accent hover:underline">Individual KPIs</Link>, or give them work in <Link href="/tasks" className="text-accent hover:underline">Assign tasks</Link>.
        </p>
      )}

      {inviting && (
        <InviteSheet
          oneCompany={oneCompany}
          companyName={companyName}
          onClose={() => setInviting(false)}
          onInvited={refresh}
        />
      )}
      {sent && <InviteSentSheet name={sent.name} result={sent.result} onClose={() => setSent(null)} />}
    </div>
  );
}

// The lead card, styled like "Overall progress" on the KPI framework: KPI achievement as a dial,
// and how far the team is through signing in.
function TeamCard({ avg, people, signedIn, pending, notInvited }: {
  avg: number | null; people: number; signedIn: number; pending: number; notInvited: number;
}) {
  const split: [number, string, string][] = [
    [signedIn, "bg-emerald-500", "Signed in"],
    [pending, "bg-amber-500", "Invite pending"],
    [notInvited, "bg-zinc-400", "Not invited"],
  ];
  return (
    <div className="sm:col-span-3 lg:col-span-1 rounded-2xl bg-primary text-accent-foreground p-4 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-black blur-2xl" />
      <div className="flex items-center gap-2 h-6 relative">
        <BarChart3 size={16} className="opacity-80" />
        <span className="text-[13px] font-semibold opacity-90">Team progress this month</span>
      </div>
      <div className="flex items-center gap-4 relative">
        <Ring pct={avg} size={84} />
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider opacity-50">People</div>
          <div className="text-2xl font-semibold tabular-nums leading-tight">{people}</div>
          <div className="text-[11px] opacity-60 leading-snug">{avg != null ? "Average KPI achievement" : "No KPIs scored yet this month"}</div>
        </div>
      </div>
      <div className="relative">
        <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-white/15 gap-px">
          {people > 0 && split.map(([n, bar, label]) => n > 0 && (
            <div key={label} className={bar} style={{ width: `${(n / people) * 100}%` }} title={`${label}: ${n}`} />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] opacity-50">
          <span>Signed in</span>
          <span className="tabular-nums">{signedIn} of {people}</span>
        </div>
      </div>
    </div>
  );
}

const STAT_LOOK = {
  amber: { card: "bg-amber-50/70 border-amber-100", icon: "bg-amber-100 text-amber-600", label: "text-amber-700" },
  red: { card: "bg-red-50/70 border-red-200", icon: "bg-red-600 text-white", label: "text-red-700" },
  sky: { card: "bg-sky-50/70 border-sky-100", icon: "bg-sky-100 text-sky-600", label: "text-sky-700" },
} as const;

function StatCard({ look, Icon, label, value, hint, onClick, active, pulse }: {
  look: keyof typeof STAT_LOOK; Icon: LucideIcon; label: string; value: number; hint: string;
  onClick?: () => void; active?: boolean; pulse?: boolean;
}) {
  const l = STAT_LOOK[look];
  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className={clsx("relative h-6 w-6 rounded-md grid place-items-center shrink-0", l.icon)}>
          <Icon size={13} />
          {pulse && (
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
          )}
        </span>
        <span className={clsx("text-[13px] font-semibold truncate", l.label)}>{label}</span>
      </div>
      <div className="text-3xl font-semibold text-foreground tabular-nums leading-none">{value}</div>
      <div className="text-[11px] text-muted truncate">{hint}</div>
    </>
  );
  // Same padding and height as the lead card: label on top, number in the middle (level with the
  // dial) and the hint at the bottom, so every card's lines sit level with each other.
  const cls = clsx("h-full rounded-2xl border p-4 text-left shadow-sm flex flex-col justify-between gap-3", l.card, active && "ring-2 ring-accent border-accent");
  return onClick
    ? <button onClick={onClick} className={clsx(cls, "transition-all hover:-translate-y-px hover:shadow hover:border-accent/40")}>{body}</button>
    : <div className={cls}>{body}</div>;
}

function AccessPill({ person }: { person: Person }) {
  if (!person.isActive) return <span className="inline-block text-xs text-muted bg-subtle rounded-full px-2 py-0.5">Inactive</span>;
  const [text, cls] = person.login === "ACTIVE"
    ? ["Signed in", "bg-emerald-500/10 text-emerald-800"]
    : person.login === "PENDING"
      ? ["Invite pending", "bg-amber-500/10 text-amber-800"]
      : ["Not invited", "bg-foreground/[0.06] text-foreground/70"];
  return <span className={clsx("inline-block text-xs font-medium rounded-full px-2 py-0.5 whitespace-nowrap", cls)}>{text}</span>;
}

function TaskSummary({ w, active }: { w: Workload | undefined; active: boolean }) {
  if (!active || !w) return <span className="text-xs text-muted">—</span>;
  if (!w.work.open) return <span className="text-xs text-muted">No open tasks</span>;
  return (
    <span className="text-sm text-foreground/80 tabular-nums whitespace-nowrap">
      {w.work.open} open
      {w.work.overdue > 0 && <span className="text-red-600 font-medium"> · {w.work.overdue} overdue</span>}
    </span>
  );
}

function KpiSummary({ w, active }: { w: Workload | undefined; active: boolean }) {
  if (!active || !w || w.achievement == null) return <span className="text-xs text-muted">{active && w?.tracked ? "Not scored yet" : "No KPIs"}</span>;
  const a = w.achievement;
  const color = a >= 80 ? "bg-emerald-500" : a >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="flex items-center gap-2" title={`${plural(w.tracked, "KPI", "KPIs")} tracked`}>
      <span className="w-16 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
        <span className={clsx("block h-full rounded-full", color)} style={{ width: `${Math.min(a, 100)}%` }} />
      </span>
      <span className="text-sm text-foreground/80 tabular-nums">{a}%</span>
    </span>
  );
}

// Add someone and email them a login. A Business CEO's invites always join their own company.
function InviteSheet({ oneCompany, companyName, onClose, onInvited }: {
  oneCompany: boolean; companyName: string | null; onClose: () => void; onInvited: () => void;
}) {
  const { companies } = useCompanies();
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "", company: companies[0]?.key ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InviteResult | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ready = form.name.trim() !== "" && /\S+@\S+\.\S+/.test(form.email.trim());
  const joining = oneCompany ? companyName : companies.find((c) => c.key === form.company)?.name;

  const save = async () => {
    if (!ready) { setError("Enter their name and a valid email address."); return; }
    setSaving(true); setError("");
    try {
      // The server ignores the company for a Business CEO and uses their own.
      const res = await api.post("/auth/team/invite", { ...form, ...(oneCompany ? { company: undefined } : {}) });
      setResult(res.data);
      onInvited();
    } catch (err) { setError(apiError(err, "Couldn't add this person. Please try again.")); }
    finally { setSaving(false); }
  };

  if (result) return <InviteSentSheet name={form.name.trim()} result={result} onClose={onClose} />;

  return (
    <KpiSheet
      title="Invite someone"
      subtitle={joining ? `They'll join ${joining} with Staff access.` : "They'll get Staff access."}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={save} disabled={saving || !ready} className={btnPrimary}>{saving ? "Sending…" : "Send invite"}</button>
        </>
      }
    >
      <div>
        <Label>Full name</Label>
        <input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} placeholder="e.g. Ama Mensah" />
      </div>
      <div>
        <Label>Email</Label>
        <input
          type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }} className={inputClass} placeholder="name@company.com"
        />
        <p className="mt-1.5 text-xs text-muted">We&apos;ll email them a temporary password and a link to sign in.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label hint="(optional)">Job title</Label>
          <input value={form.role} onChange={(e) => set("role", e.target.value)} className={inputClass} placeholder="e.g. Sales officer" />
        </div>
        <div>
          <Label hint="(optional)">Phone</Label>
          <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} placeholder="024 000 0000" />
        </div>
      </div>
      {!oneCompany && (
        <div>
          <Label>Company</Label>
          <select value={form.company} onChange={(e) => set("company", e.target.value)} className={selectClass}>
            {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>
      )}
      <ErrorNote message={error} />
    </KpiSheet>
  );
}

// After an invite: confirm the email went out, or hand over the password if it didn't.
function InviteSentSheet({ name, result, onClose }: { name: string; result: InviteResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Email: ${result.email}\nTemporary password: ${result.tempPassword}`); setCopied(true); } catch { /* clipboard blocked */ }
  };
  return (
    <KpiSheet
      title={result.emailSent ? "Invite sent" : "Invite created"}
      subtitle={result.emailSent ? `${name} will get an email at ${result.email}.` : `We couldn't email ${name}, so pass these on yourself.`}
      onClose={onClose}
      footer={<button onClick={onClose} className={btnPrimary}>Done</button>}
    >
      {result.emailSent ? (
        <p className="text-sm text-foreground/80">They&apos;ll sign in with a temporary password and choose their own. You&apos;ll see &ldquo;Signed in&rdquo; next to their name once they have.</p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-background p-3.5 text-sm space-y-1.5">
            <div className="flex justify-between gap-3"><span className="text-muted">Email</span><span className="font-medium text-foreground truncate">{result.email}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">Temporary password</span><span className="font-mono font-medium text-foreground">{result.tempPassword}</span></div>
          </div>
          <button onClick={copy} className={clsx(btnSecondary, "inline-flex items-center gap-2")}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy sign-in details"}
          </button>
          {result.emailError && <p className="text-xs text-muted">Email problem: {result.emailError}</p>}
        </div>
      )}
    </KpiSheet>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="px-5 py-12 flex flex-col items-center text-center gap-1.5">
      <div className="w-10 h-10 rounded-full bg-subtle text-muted flex items-center justify-center mb-1">
        <Users size={18} strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted max-w-sm">{body}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

function ContactButton({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  if (!href) {
    return (
      <span title={label} aria-label={label} className="p-2 rounded-lg text-foreground/20 cursor-not-allowed">
        {children}
      </span>
    );
  }
  return (
    <a href={href} title={label} aria-label={label} className="p-2 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors">
      {children}
    </a>
  );
}
