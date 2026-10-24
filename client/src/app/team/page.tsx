"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { useAuth } from "@/components/AuthProvider";
import { isGroupOwner } from "@/lib/auth";
import { Mail, Phone, Search, Users } from "lucide-react";
import { clsx } from "clsx";

type Staff = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string;
  role: string | null;
  isActive: boolean;
};

type StatusFilter = "all" | "active" | "inactive";

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

// One shared grid so the header and every row line up. Two versions because the
// Company column only shows for a Group Owner (a Business CEO sees one company).
const GRID_ONE = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_72px]";
const GRID_MANY = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,1fr)_72px]";

export default function TeamPage() {
  const { user } = useAuth();
  const { companies, byKey } = useCompanies();
  // The API already limits a Business CEO to their own company; only a Group Owner picks one.
  const oneCompany = !isGroupOwner(user);
  const [companyFilter, setCompanyFilter] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data: staff = [], isLoading, isError, refetch } = useQuery<Staff[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
  });

  const q = search.trim().toLowerCase();
  // Company + search narrow the pool; the status chips count from this pool.
  const pool = staff
    .filter((s) => oneCompany || !companyFilter || s.company === companyFilter)
    .filter((s) => !q || [s.name, s.role, s.email, s.phone].some((v) => v?.toLowerCase().includes(q)));

  const counts = {
    all: pool.length,
    active: pool.filter((s) => s.isActive).length,
    inactive: pool.filter((s) => !s.isActive).length,
  };

  // Active people first, then A–Z.
  const rows = pool
    .filter((s) => status === "all" || (status === "active" ? s.isActive : !s.isActive))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));

  const companyName = user?.bdoCompany ? (byKey[user.bdoCompany]?.name ?? user.bdoCompany) : null;
  const subtitle = oneCompany && companyName
    ? `${plural(staff.length, "person", "people")} at ${companyName}`
    : `${plural(staff.length, "person", "people")} across ${plural(companies.length, "company", "companies")}`;

  const grid = oneCompany ? GRID_ONE : GRID_MANY;
  const filtering = !!q || !!companyFilter || status !== "all";

  const clearFilters = () => {
    setSearch("");
    setCompanyFilter("");
    setStatus("all");
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl text-foreground">Team</h1>
          <p className="text-sm text-muted mt-1">{isLoading ? "Loading your team…" : subtitle}</p>
        </div>
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

      {/* Status chips: they filter the list and show how many people are in each */}
      {!isLoading && !isError && staff.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
          {([
            ["all", "Everyone"],
            ["active", "Active"],
            ["inactive", "Inactive"],
          ] as [StatusFilter, string][]).map(([key, label]) => {
            const selected = status === key;
            return (
              <button
                key={key}
                onClick={() => setStatus(key)}
                aria-pressed={selected}
                className={clsx(
                  "h-8 px-3 rounded-full border text-sm transition-colors inline-flex items-center gap-1.5",
                  selected
                    ? "bg-foreground text-white border-foreground"
                    : "bg-surface border-border text-muted hover:text-foreground hover:border-foreground/30"
                )}
              >
                {label}
                <span className={clsx("tabular-nums text-xs", selected ? "text-white/70" : "text-muted/80")}>
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* List */}
      <section className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        {/* Column labels, desktop only */}
        <div className={clsx("hidden md:grid gap-4 px-4 py-2 border-b border-border bg-subtle/50 type-colhead", grid)}>
          <span>Name</span>
          {!oneCompany && <span>Company</span>}
          <span>Email</span>
          <span>Phone</span>
          <span className="sr-only">Contact</span>
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
          staff.length === 0 ? (
            <EmptyState
              title="No one is on the team yet"
              body={oneCompany ? "Your Group Owner adds people to the team." : "Add people and choose what each can see."}
              action={!oneCompany ? <Link href="/admin/team" className="text-sm font-medium text-accent hover:underline">Go to Team & access</Link> : undefined}
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
            {rows.map((s) => (
              <li
                key={s.id}
                className={clsx(
                  "px-4 py-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 hover:bg-primary/[0.03] transition-colors",
                  grid,
                  !s.isActive && "opacity-60"
                )}
              >
                {/* Name + title */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${tone(s.id)}`}>
                    {initials(s.name) || "—"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                      {!s.isActive && (
                        <span className="shrink-0 text-xs text-muted bg-subtle rounded-full px-2 py-px">Inactive</span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {s.role || "No title"}
                      {/* On mobile the Company column is hidden, so fold it in here */}
                      {!oneCompany && (
                        <span className="md:hidden"> · {byKey[s.company]?.name ?? s.company}</span>
                      )}
                    </div>
                  </div>
                </div>

                {!oneCompany && (
                  <span className="hidden md:block text-sm text-foreground/80 truncate">
                    {byKey[s.company]?.name ?? s.company}
                  </span>
                )}
                <span className="hidden md:block text-sm text-foreground/80 truncate">
                  {s.email ?? <span className="text-muted">No email</span>}
                </span>
                <span className="hidden md:block text-sm text-foreground/80 tabular-nums truncate">
                  {s.phone ?? <span className="text-muted">No phone</span>}
                </span>

                {/* Quick contact */}
                <div className="flex items-center gap-0.5 justify-end">
                  <ContactButton
                    href={s.email ? `mailto:${s.email}` : null}
                    label={s.email ? `Email ${s.name}` : `No email on file for ${s.name}`}
                  >
                    <Mail size={15} />
                  </ContactButton>
                  <ContactButton
                    href={s.phone ? `tel:${s.phone.replace(/\s+/g, "")}` : null}
                    label={s.phone ? `Call ${s.name}` : `No phone on file for ${s.name}`}
                  >
                    <Phone size={15} />
                  </ContactButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isLoading && !isError && rows.length > 0 && filtering && (
        <p className="text-xs text-muted">Showing {rows.length} of {staff.length}</p>
      )}
    </div>
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
    <a
      href={href}
      title={label}
      aria-label={label}
      className="p-2 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors"
    >
      {children}
    </a>
  );
}