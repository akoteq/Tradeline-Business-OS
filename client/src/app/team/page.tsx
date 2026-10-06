"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { useAuth } from "@/components/AuthProvider";
import { isGroupOwner } from "@/lib/auth";
import { Mail, Phone, Search } from "lucide-react";

type Staff = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string;
  role: string | null;
  isActive: boolean;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

// A few quiet monogram tones from the Trunqo palette, picked per person so the roster scans easily.
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

export default function TeamPage() {
  const { user } = useAuth();
  const { companies, byKey } = useCompanies();
  // The API already limits a Business CEO to their own company; only a Group Owner picks one.
  const oneCompany = !isGroupOwner(user);
  const [companyFilter, setCompanyFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: staff = [], isLoading } = useQuery<Staff[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
  });

  const q = search.trim().toLowerCase();
  const filtered = staff
    .filter((s) => (oneCompany || !companyFilter || s.company === companyFilter))
    .filter((s) => !q || [s.name, s.role, s.email, s.phone].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const companyName = user?.bdoCompany ? (byKey[user.bdoCompany]?.name ?? user.bdoCompany) : null;
  const subtitle = oneCompany && companyName
    ? `${staff.length} ${staff.length === 1 ? "person" : "people"} at ${companyName}`
    : `${staff.length} staff across ${companies.length} companies`;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">People</p>
          <h1 className="font-serif text-2xl md:text-3xl text-foreground">Team</h1>
          <p className="text-sm text-muted mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!oneCompany && (
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="text-sm bg-background border border-border rounded-lg px-2 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="">All companies</option>
              {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          )}
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, title, email…"
              className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface overflow-hidden">
        {/* Column labels, desktop only */}
        <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_auto] gap-4 px-5 py-2.5 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted">
          <span>Member</span><span>Email</span><span>Phone</span><span className="w-[72px]" />
        </div>

        {isLoading ? (
          <p className="px-5 py-12 text-center text-sm text-muted">Loading team…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">{staff.length ? "No one matches your search." : "No team members yet."}</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {filtered.map((s) => (
              <li
                key={s.id}
                className="px-4 md:px-5 py-3.5 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_auto] items-center gap-x-4 gap-y-1 hover:bg-primary/[0.03] transition-colors"
              >
                {/* Member */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${tone(s.id)}`}>
                    {initials(s.name) || "—"}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{s.name}</div>
                    <div className="text-xs text-muted truncate">
                      {[s.role, !oneCompany ? (byKey[s.company]?.name ?? s.company) : null].filter(Boolean).join(" · ") || "No title"}
                    </div>
                  </div>
                </div>

                {/* Email / phone — columns on desktop, hidden on mobile (the action buttons cover it) */}
                <span className="hidden md:block text-sm text-foreground/80 truncate">{s.email ?? <span className="text-muted">—</span>}</span>
                <span className="hidden md:block text-sm text-foreground/80 tabular-nums truncate">{s.phone ?? <span className="text-muted">—</span>}</span>

                {/* Quick actions */}
                <div className="flex items-center gap-1 justify-end w-[72px]">
                  <ContactButton href={s.email ? `mailto:${s.email}` : null} label={s.email ? `Email ${s.name}` : "No email"}><Mail size={15} /></ContactButton>
                  <ContactButton href={s.phone ? `tel:${s.phone.replace(/\s+/g, "")}` : null} label={s.phone ? `Call ${s.name}` : "No phone"}><Phone size={15} /></ContactButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ContactButton({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  if (!href) {
    return <span title={label} aria-label={label} className="p-2 rounded-lg text-foreground/20">{children}</span>;
  }
  return (
    <a href={href} title={label} aria-label={label} className="p-2 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors">
      {children}
    </a>
  );
}
