"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { UserPlus, Mail, KeyRound, ShieldCheck, Pencil, Trash2, X, Link2, Search, MoreVertical, Copy, Check } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type BdoPerf = {
  bdo: { id: string; name: string; email: string | null; phone: string | null; company: string; role: string | null; managerId: string | null; isActive: boolean };
  bapxDeals: number; tradelineDeals: number; leads: number;
  tasks: { total: number; open: number; completed: number; overdue: number };
  revenue: { received: number; potential: number };
};
type UserRow = { id: string; email: string; role: string; bdoId: string | null; bdoName: string | null; mustChangePassword: boolean };
type Credentials = { email: string; password: string; emailSent: boolean; emailError?: string };

// Combined row: a person (staff profile) with their optional login, or a standalone login.
type TeamRow = { key: string; kind: "member" | "account"; perf?: BdoPerf; user?: UserRow };

// The three access levels the app is built around (see Sidebar.tsx). Mirrors ASSIGNABLE_ROLES
// in server/src/models/User.ts — the server rejects anything else. Seniority ("Senior BDO",
// "Intern") is a job title on the profile, not an access level.
const ACCESS_LEVELS = [
  { value: "CEO", label: "Group Owner", description: "Sees every company. Can invite or remove people and change anyone's access." },
  { value: "BUSINESS_CEO", label: "Business CEO", description: "Runs one company: its pipeline, team, tasks and KPIs." },
  { value: "BDO", label: "Staff", description: "Sees their own leads and tasks." },
];
// Labels for roles still on older accounts — ADMIN is a Group Owner; the rest are retired.
const ROLE_LABELS: Record<string, string> = {
  ...Object.fromEntries(ACCESS_LEVELS.map((r) => [r.value, r.label])),
  ADMIN: "Group Owner",
  MANAGING_PARTNER: "Managing Partner (retired)",
  SENIOR_PARTNER: "Senior Partner (retired)",
  SENIOR_BDO: "Senior BDO (retired)",
  JUNIOR_BDO: "Junior BDO (retired)",
  INTERN: "Intern (retired)",
};
function roleColor(role: string) {
  if (role === "ADMIN" || role === "CEO") return "bg-purple-100 text-purple-700";
  if (role === "BUSINESS_CEO") return "bg-amber-100 text-amber-700";
  if (role === "BDO") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-500";
}

type StatusKey = "ACTIVE" | "INVITED" | "NO_LOGIN";
const statusOf = (r: TeamRow): StatusKey => (!r.user ? "NO_LOGIN" : r.user.mustChangePassword ? "INVITED" : "ACTIVE");
const STATUS_FILTERS = [
  ["ALL", "All"], ["ACTIVE", "Active"], ["INVITED", "Invited"], ["NO_LOGIN", "No login"],
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number][0];

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

const AVATAR_COLORS = [
  "bg-slate-700", "bg-orange-500", "bg-violet-600", "bg-emerald-600",
  "bg-teal-600", "bg-indigo-500", "bg-amber-500", "bg-purple-600", "bg-sky-600", "bg-rose-500",
];
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[1][0] : "")).toUpperCase() || "?";
}
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// Closes a popover or dialog when Escape is pressed.
function useEscape(active: boolean, close: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close]);
}

type Confirm = { title: string; message: string; confirmLabel: string; danger?: boolean; run: () => void };

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ManageTeamPage() {
  const qc = useQueryClient();
  const { companies, byKey } = useCompanies();
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [showOnboard, setShowOnboard] = useState(false);
  const [editProfile, setEditProfile] = useState<BdoPerf | null>(null);
  const [inviteTarget, setInviteTarget] = useState<BdoPerf | null>(null);
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [linkTarget, setLinkTarget] = useState<UserRow | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [notice, setNotice] = useState("");

  const { data: perf = [], isLoading } = useQuery<BdoPerf[]>({ queryKey: ["bdo-performance"], queryFn: () => fetcher("/bdo/performance") });
  const { data: users = [] } = useQuery<UserRow[]>({ queryKey: ["auth-users"], queryFn: () => fetcher("/auth/users") });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["bdo-performance"] }); qc.invalidateQueries({ queryKey: ["auth-users"] }); qc.invalidateQueries({ queryKey: ["bdos"] }); };

  const userByBdo: Record<string, UserRow> = {};
  users.forEach((u) => { if (u.bdoId) userByBdo[u.bdoId] = u; });

  const allRows: TeamRow[] = [
    ...perf
      .filter((p) => !companyFilter || p.bdo.company === companyFilter)
      .map((p) => ({ key: `m-${p.bdo.id}`, kind: "member" as const, perf: p, user: userByBdo[p.bdo.id] })),
    // Standalone logins (e.g. the root admin) with no linked profile.
    ...(companyFilter ? [] : users.filter((u) => !u.bdoId).map((u) => ({ key: `a-${u.id}`, kind: "account" as const, user: u }))),
  ];

  // Search by name, email, job title or company.
  const q = query.trim().toLowerCase();
  const searched = q
    ? allRows.filter((r) => {
        const p = r.perf; const u = r.user;
        const hay = [p?.bdo.name, p?.bdo.email, u?.email, p?.bdo.role, p ? byKey[p.bdo.company]?.name : ""].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      })
    : allRows;
  const rows = statusFilter === "ALL" ? searched : searched.filter((r) => statusOf(r) === statusFilter);
  const countOf = (k: StatusFilter) => (k === "ALL" ? searched.length : searched.filter((r) => statusOf(r) === k).length);
  const filtering = !!(companyFilter || q || statusFilter !== "ALL");
  const clearFilters = () => { setCompanyFilter(""); setQuery(""); setStatusFilter("ALL"); };

  const resend = useMutation({
    mutationFn: (userId: string) => api.post(`/auth/users/${userId}/resend-invite`),
    onSuccess: (res) => { const d = res.data; setNotice(""); setCreds({ email: d.email ?? "", password: d.tempPassword, emailSent: d.emailSent, emailError: d.emailError }); refresh(); },
    onError: (err) => setNotice(apiError(err, "We couldn't reset that password. Please try again.")),
  });
  const removeMember = useMutation({
    mutationFn: async ({ bdoId, userId }: { bdoId: string; userId?: string }) => {
      if (userId) await api.delete(`/auth/users/${userId}`);
      await api.delete(`/bdo/${bdoId}`);
    },
    onSuccess: () => { setNotice(""); refresh(); },
    onError: (err) => setNotice(apiError(err, "We couldn't remove this person. Please try again.")),
  });
  const removeAccount = useMutation({
    mutationFn: (userId: string) => api.delete(`/auth/users/${userId}`),
    onSuccess: () => { setNotice(""); refresh(); },
    onError: (err) => setNotice(apiError(err, "We couldn't delete this account. Please try again.")),
  });

  const companyOfUser = (u: UserRow) => {
    const p = perf.find((x) => x.bdo.id === u.bdoId);
    return p ? (byKey[p.bdo.company]?.name ?? p.bdo.company) : undefined;
  };

  const menuFor = (r: TeamRow): MenuItem[] => {
    const p = r.perf; const u = r.user;
    const items: MenuItem[] = [];
    if (p) items.push({ label: "Edit profile", icon: <Pencil size={14} />, onClick: () => setEditProfile(p) });
    if (u) items.push({ label: "Change access", icon: <ShieldCheck size={14} />, onClick: () => setRoleTarget(u) });
    if (u) {
      items.push({
        label: "Reset password & resend invite", icon: <KeyRound size={14} />,
        onClick: () => setConfirm({
          title: "Reset password?",
          message: `We'll reset the password for ${u.email} and email them a new invite.`,
          confirmLabel: "Reset and resend",
          run: () => resend.mutate(u.id),
        }),
      });
    }
    items.push({
      label: p ? "Remove from team" : "Delete account", icon: <Trash2 size={14} />, danger: true,
      onClick: () => setConfirm(p
        ? {
            title: `Remove ${p.bdo.name}?`,
            message: `Their profile will be deactivated${u ? " and their login deleted" : ""}.`,
            confirmLabel: "Remove",
            danger: true,
            run: () => removeMember.mutate({ bdoId: p.bdo.id, userId: u?.id }),
          }
        : {
            title: "Delete this account?",
            message: `The account for ${u!.email} will be deleted. This can't be undone.`,
            confirmLabel: "Delete account",
            danger: true,
            run: () => removeAccount.mutate(u!.id),
          }),
    });
    return items;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl text-foreground">Team & access</h1>
          <p className="text-base text-muted mt-1 max-w-2xl">Add people, choose what each person can see, and manage their sign-in.</p>
        </div>
        <button onClick={() => setShowOnboard(true)} className="flex items-center gap-2 px-3.5 py-2 bg-accent text-accent-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
          <UserPlus size={16} /> Add team member
        </button>
      </div>

      {creds && <CredentialsBanner creds={creds} onClose={() => setCreds(null)} />}
      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-500/5 px-3 py-2 text-sm text-red-600">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss" className="shrink-0 text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={statusFilter === k}
              onClick={() => setStatusFilter(k)}
              className={clsx(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors tabular-nums",
                statusFilter === k ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-foreground/70 hover:border-accent/40",
              )}
            >
              {label} <span className="opacity-70">{countOf(k)}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[220px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or title"
              aria-label="Search team"
              className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            aria-label="Filter by company"
            className="text-sm bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="">All companies</option>
            {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-subtle/50">
              <tr>
                {["Name", "Company", "Title", "Access", "Status", "Deals", "Open tasks"].map((h) => (
                  <th key={h} className="type-colhead px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-2.5"><div className="h-9 rounded-lg bg-foreground/5 animate-pulse" /></td></tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <p className="text-muted">{filtering ? "No one matches these filters." : "No team members yet. Add your first one to get started."}</p>
                    <button
                      onClick={filtering ? clearFilters : () => setShowOnboard(true)}
                      className="mt-3 text-sm font-medium text-accent hover:underline"
                    >
                      {filtering ? "Clear filters" : "Add team member"}
                    </button>
                  </td>
                </tr>
              ) : rows.map((r) => {
                const p = r.perf; const u = r.user;
                const status = statusOf(r);
                const name = p ? p.bdo.name : u!.email;
                const email = p ? (u?.email ?? p.bdo.email) : null;
                return (
                  <tr key={r.key} className="hover:bg-primary/[0.03] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <span className={clsx("h-8 w-8 shrink-0 rounded-full grid place-items-center text-white text-xs font-semibold", avatarColor(name))}>
                          {initials(name)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{name}</div>
                          <div className="text-xs text-muted truncate">{p ? (email ?? "No email on file") : "Not linked to a staff profile"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{p ? (byKey[p.bdo.company]?.name ?? p.bdo.company) : "—"}</td>
                    <td className="px-4 py-2.5 text-muted">{p?.bdo.role ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {u
                        ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${roleColor(u.role)}`}>{ROLE_LABELS[u.role] ?? u.role}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-2.5"><StatusDot status={status} /></td>
                    <td className="px-4 py-2.5 text-muted tabular-nums">{p ? p.bapxDeals + p.tradelineDeals : "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {p ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-muted">{p.tasks.open}</span>
                          {p.tasks.overdue > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-700 text-xs font-medium">{p.tasks.overdue} overdue</span>
                          )}
                        </span>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {p && !u && (
                          <button onClick={() => setInviteTarget(p)} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-accent rounded-lg border border-accent/30 hover:bg-accent/10 transition-colors whitespace-nowrap">
                            <Mail size={13} /> Send invite
                          </button>
                        )}
                        {u && !p && (
                          <button onClick={() => setLinkTarget(u)} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-accent rounded-lg border border-accent/30 hover:bg-accent/10 transition-colors whitespace-nowrap">
                            <Link2 size={13} /> Link profile
                          </button>
                        )}
                        <RowMenu label={`More actions for ${name}`} items={menuFor(r)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showOnboard && <OnboardModal onClose={() => setShowOnboard(false)} onDone={(c) => { setShowOnboard(false); setCreds(c); refresh(); }} />}
      {editProfile && <EditProfileModal perf={editProfile} onClose={() => setEditProfile(null)} onSaved={() => { setEditProfile(null); refresh(); }} />}
      {inviteTarget && <InviteExistingModal perf={inviteTarget} onClose={() => setInviteTarget(null)} onDone={(c) => { setInviteTarget(null); setCreds(c); refresh(); }} />}
      {linkTarget && (
        <LinkProfileModal
          user={linkTarget}
          profiles={perf.filter((x) => !userByBdo[x.bdo.id]).map((x) => ({ id: x.bdo.id, name: x.bdo.name, company: byKey[x.bdo.company]?.name ?? x.bdo.company }))}
          onClose={() => setLinkTarget(null)}
          onSaved={() => { setLinkTarget(null); refresh(); }}
        />
      )}
      {roleTarget && <ChangeRoleModal user={roleTarget} companyName={companyOfUser(roleTarget)} onClose={() => setRoleTarget(null)} onSaved={() => { setRoleTarget(null); refresh(); }} />}
      {confirm && <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function StatusDot({ status }: { status: StatusKey }) {
  const map = {
    ACTIVE: { label: "Active", dot: "bg-emerald-500", text: "text-emerald-700", hint: "Has signed in and set a password" },
    INVITED: { label: "Invited", dot: "bg-amber-500", text: "text-amber-700", hint: "Hasn't signed in and set a password yet" },
    NO_LOGIN: { label: "No login", dot: "bg-foreground/25", text: "text-muted", hint: "Has a profile but no login yet" },
  }[status];
  return (
    <span title={map.hint} className={clsx("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", map.text)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", map.dot)} />
      {map.label}
    </span>
  );
}

// ─── Row menu ───────────────────────────────────────────────────────────────
// Fixed-position so it isn't clipped by the table's horizontal scroll area.
type MenuItem = { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean };

function RowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const close = useCallback(() => setPos(null), []);
  useEscape(!!pos, close);

  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [pos, close]);

  const toggle = () => {
    if (pos) return close();
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const right = window.innerWidth - r.right;
    // Open upward when there isn't room below.
    setPos(r.bottom + 220 > window.innerHeight ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right });
  };

  return (
    <>
      <button
        ref={btn}
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {pos && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} />
          <div role="menu" style={{ top: pos.top, bottom: pos.bottom, right: pos.right }} className="fixed z-40 w-60 rounded-lg border border-border bg-surface shadow-pop py-1 text-sm">
            {items.map((it, i) => (
              <div key={it.label}>
                {it.danger && i > 0 && <div className="my-1 border-t border-border" />}
                <button
                  role="menuitem"
                  onClick={() => { close(); it.onClick(); }}
                  className={clsx(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                    it.danger ? "text-red-600 hover:bg-red-500/10" : "text-foreground hover:bg-primary/5",
                  )}
                >
                  <span className={it.danger ? "" : "text-muted"}>{it.icon}</span>
                  {it.label}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ─── Credentials banner ─────────────────────────────────────────────────────
function CredentialsBanner({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(creds.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the password is still on screen */ }
  };
  const ok = creds.emailSent;
  return (
    <div className={`rounded-xl px-4 py-3 flex items-start justify-between gap-4 border ${ok ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
      <div className="text-sm min-w-0">
        <p className={`font-semibold mb-1 ${ok ? "text-green-800" : "text-amber-800"}`}>
          {ok ? "Invite sent" : "Account created, but the email didn't send"}{creds.email ? ` · ${creds.email}` : ""}
        </p>
        <p className={`flex items-center gap-2 flex-wrap ${ok ? "text-green-700" : "text-amber-700"}`}>
          Temporary password:
          <code className="bg-white/60 px-1.5 py-0.5 rounded font-mono">{creds.password}</code>
          <button onClick={copy} className="inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline">
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        </p>
        <p className={`text-xs mt-1 ${ok ? "text-green-600" : "text-amber-700"}`}>
          {ok
            ? "They'll choose their own password the first time they sign in."
            : `We couldn't send the email (${creds.emailError ?? "check your email settings"}). Share these details with them yourself.`}
        </p>
      </div>
      <button onClick={onClose} aria-label="Dismiss" className="shrink-0 text-muted hover:text-foreground transition-colors"><X size={16} /></button>
    </div>
  );
}

// Trunqo design tokens for the popups — same as the KPI pages.
const btnSecondary = "px-4 py-2 text-sm text-foreground rounded-lg border border-border hover:bg-primary/5 transition-colors disabled:opacity-50";
const btnPrimary = "px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity";
const btnDanger = "px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors";
const inputClass = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-60";
const labelClass = "text-xs font-medium text-muted block mb-1";
const errorClass = "text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-lg";

// ─── Confirm ────────────────────────────────────────────────────────────────
function ConfirmModal({ confirm, onClose }: { confirm: Confirm; onClose: () => void }) {
  return (
    <ModalShell
      title={confirm.title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={() => { confirm.run(); onClose(); }} className={confirm.danger ? btnDanger : btnPrimary}>{confirm.confirmLabel}</button>
        </>
      }
    >
      <p className="text-sm text-foreground/80">{confirm.message}</p>
    </ModalShell>
  );
}

// ─── Onboard (add + invite in one) ──────────────────────────────────────────
function OnboardModal({ onClose, onDone }: { onClose: () => void; onDone: (c: Credentials) => void }) {
  const { companies } = useCompanies();
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: companies[0]?.key ?? "BAPX", role: "", accessRole: "BDO" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError("Enter a name and an email address."); return; }
    setSaving(true); setError("");
    try {
      const res = await api.post("/auth/onboard", form);
      onDone({ email: form.email, password: res.data.tempPassword, emailSent: res.data.emailSent, emailError: res.data.emailError });
    } catch (err: unknown) {
      setError(apiError(err, "We couldn't add this person. Please try again."));
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Add team member" onClose={onClose} footer={
      <>
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={save} disabled={saving || !form.name.trim() || !form.email.trim()} className={btnPrimary}>
          {saving ? "Adding…" : "Add and invite"}
        </button>
      </>
    }>
      {error && <div className={errorClass}>{error}</div>}
      <p className="text-xs text-muted -mt-1">We'll create their profile and login, then email them an invite with a temporary password and a link to sign in.</p>
      <Field label="Full name" value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Ama Mensah" autoFocus />
      <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="name@company.com" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone (optional)" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field label="Job title (optional)" value={form.role} onChange={(v) => set("role", v)} placeholder="e.g. Sales officer" />
      </div>
      <Select label="Company" value={form.company} onChange={(v) => set("company", v)} options={companies.map((c) => ({ value: c.key, label: c.name }))} />
      <AccessPicker value={form.accessRole} onChange={(v) => set("accessRole", v)} companyName={companies.find((c) => c.key === form.company)?.name} />
    </ModalShell>
  );
}

// ─── Invite an existing profile ─────────────────────────────────────────────
function InviteExistingModal({ perf, onClose, onDone }: { perf: BdoPerf; onClose: () => void; onDone: (c: Credentials) => void }) {
  const { byKey } = useCompanies();
  const [email, setEmail] = useState(perf.bdo.email ?? "");
  const [accessRole, setAccessRole] = useState("BDO");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!email.trim()) { setError("Enter an email address to send the invite."); return; }
    setSaving(true); setError("");
    try {
      const res = await api.post(`/auth/bdos/${perf.bdo.id}/invite`, { email, accessRole });
      onDone({ email, password: res.data.tempPassword, emailSent: res.data.emailSent, emailError: res.data.emailError });
    } catch (err: unknown) {
      setError(apiError(err, "We couldn't send the invite. Please try again."));
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Invite ${perf.bdo.name}`} onClose={onClose} footer={
      <>
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={save} disabled={saving || !email.trim()} className={btnPrimary}>{saving ? "Sending…" : "Send invite"}</button>
      </>
    }>
      {error && <div className={errorClass}>{error}</div>}
      <p className="text-xs text-muted -mt-1">We'll create a login for {perf.bdo.name} and email them an invite.</p>
      <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="name@company.com" autoFocus />
      <AccessPicker value={accessRole} onChange={setAccessRole} companyName={byKey[perf.bdo.company]?.name ?? perf.bdo.company} />
    </ModalShell>
  );
}

// ─── Edit profile ───────────────────────────────────────────────────────────
function EditProfileModal({ perf, onClose, onSaved }: { perf: BdoPerf; onClose: () => void; onSaved: () => void }) {
  const { companies } = useCompanies();
  const b = perf.bdo;
  const [form, setForm] = useState({ name: b.name, phone: b.phone ?? "", company: b.company, role: b.role ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { setError("Enter a name."); return; }
    setSaving(true); setError("");
    try {
      await api.put(`/bdo/${b.id}`, { ...form, phone: form.phone || null, role: form.role || null });
      onSaved();
    } catch { setError("We couldn't save your changes. Please try again."); } finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Edit ${b.name}`} onClose={onClose} footer={
      <>
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={save} disabled={saving || !form.name.trim()} className={btnPrimary}>{saving ? "Saving…" : "Save changes"}</button>
      </>
    }>
      {error && <div className={errorClass}>{error}</div>}
      <Field label="Full name" value={form.name} onChange={(v) => set("name", v)} autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone (optional)" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field label="Job title (optional)" value={form.role} onChange={(v) => set("role", v)} />
      </div>
      <Select label="Company" value={form.company} onChange={(v) => set("company", v)} options={companies.map((c) => ({ value: c.key, label: c.name }))} />
    </ModalShell>
  );
}

// ─── Link a login to a staff profile ────────────────────────────────────────
// A login needs a profile for anything personal (own leads and tasks) and,
// for a Business CEO, to know which company they run.
function LinkProfileModal({ user, profiles, onClose, onSaved }: {
  user: UserRow; profiles: { id: string; name: string; company: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const [bdoId, setBdoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true); setError("");
    try { await api.put(`/auth/users/${user.id}/bdo`, { bdoId }); onSaved(); }
    catch (err: unknown) { setError(apiError(err, "We couldn't link this profile. Please try again.")); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title="Link to a staff profile" onClose={onClose} footer={
      <>
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={save} disabled={saving || !bdoId} className={btnPrimary}>{saving ? "Linking…" : "Link profile"}</button>
      </>
    }>
      {error && <div className={errorClass}>{error}</div>}
      <p className="text-sm text-foreground/80">
        Connect <strong>{user.email}</strong> to their staff profile so they see their own leads and tasks. This is also how a Business CEO is matched to their company.
      </p>
      {profiles.length ? (
        <Select label="Staff profile" value={bdoId} onChange={setBdoId}
          options={[{ value: "", label: "Choose a person" }, ...profiles.map((x) => ({ value: x.id, label: `${x.name} · ${x.company}` }))]} />
      ) : (
        <p className="text-xs text-muted">Every staff profile already has a login. Use &quot;Add team member&quot; to create a new profile first.</p>
      )}
    </ModalShell>
  );
}

// ─── Change access ──────────────────────────────────────────────────────────
function ChangeRoleModal({ user, companyName, onClose, onSaved }: { user: UserRow; companyName?: string; onClose: () => void; onSaved: () => void }) {
  // Admins show as Group Owner; retired roles start unselected so a level must be picked.
  const current = user.role === "ADMIN" ? "CEO" : user.role;
  const isRetired = !ACCESS_LEVELS.some((l) => l.value === current);
  const [role, setRole] = useState(isRetired ? "" : current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const unchanged = role === current;
  const save = async () => {
    setSaving(true); setError("");
    try { await api.put(`/auth/users/${user.id}/role`, { role }); onSaved(); }
    catch (err: unknown) { setError(apiError(err, "We couldn't update access. Please try again.")); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title="Change access" onClose={onClose} footer={
      <>
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={save} disabled={saving || !role || unchanged} className={btnPrimary}>{saving ? "Saving…" : "Update access"}</button>
      </>
    }>
      {error && <div className={errorClass}>{error}</div>}
      <p className="text-sm text-foreground/80">
        Choose what <strong>{user.email}</strong> can see and do.
        {isRetired && <> Their current role, {ROLE_LABELS[user.role] ?? user.role}, is no longer used, so please pick a new access level.</>}
      </p>
      <AccessPicker value={role} onChange={setRole} companyName={companyName} businessCeoDisabled={!user.bdoId} />
    </ModalShell>
  );
}

// ─── Shared UI ──────────────────────────────────────────────────────────────
function AccessPicker({ value, onChange, companyName, businessCeoDisabled }: {
  value: string; onChange: (v: string) => void; companyName?: string; businessCeoDisabled?: boolean;
}) {
  const selected = ACCESS_LEVELS.find((l) => l.value === value);
  return (
    <div>
      <label className={labelClass}>Access level</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {!selected && <option value="" disabled>Choose an access level</option>}
        {ACCESS_LEVELS.map((l) => (
          <option key={l.value} value={l.value} disabled={l.value === "BUSINESS_CEO" && businessCeoDisabled}>
            {l.label}{l.value === "BUSINESS_CEO" && businessCeoDisabled ? " (link a staff profile first)" : ""}
          </option>
        ))}
      </select>
      {selected && (
        <p className="text-xs text-muted mt-1">
          {selected.value === "BUSINESS_CEO" && companyName ? `Runs ${companyName}: its pipeline, team, tasks and KPIs.` : selected.description}
        </p>
      )}
    </div>
  );
}

function ModalShell({ title, children, footer, onClose }: { title: string; children: React.ReactNode; footer: React.ReactNode; onClose: () => void }) {
  useEscape(true, onClose);
  return (
    <div
      className="fixed inset-0 bg-primary/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-surface border border-border rounded-2xl shadow-pop w-full max-w-md max-h-[92vh] flex flex-col">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <h2 className="text-lg text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">{children}</div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 shrink-0">{footer}</div>
      </div>
    </div>
  );
}
function Field({ label, value, onChange, type = "text", placeholder, autoFocus }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} className={inputClass} />
    </div>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}