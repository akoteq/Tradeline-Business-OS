"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { UserPlus, Mail, KeyRound, ShieldCheck, Pencil, Trash2, X, Link2 } from "lucide-react";

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
  { value: "CEO", label: "Group Owner", description: "Sees every company and can invite, remove and change access for anyone." },
  { value: "BUSINESS_CEO", label: "Business CEO", description: "Runs one company: its pipeline, team, tasks and KPIs." },
  { value: "BDO", label: "Staff", description: "Sees their own leads, tasks and KPIs." },
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

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ManageTeamPage() {
  const qc = useQueryClient();
  const { companies, byKey } = useCompanies();
  const [companyFilter, setCompanyFilter] = useState("");
  const [showOnboard, setShowOnboard] = useState(false);
  const [editProfile, setEditProfile] = useState<BdoPerf | null>(null);
  const [inviteTarget, setInviteTarget] = useState<BdoPerf | null>(null);
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [linkTarget, setLinkTarget] = useState<UserRow | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);

  const { data: perf = [], isLoading } = useQuery<BdoPerf[]>({ queryKey: ["bdo-performance"], queryFn: () => fetcher("/bdo/performance") });
  const { data: users = [] } = useQuery<UserRow[]>({ queryKey: ["auth-users"], queryFn: () => fetcher("/auth/users") });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["bdo-performance"] }); qc.invalidateQueries({ queryKey: ["auth-users"] }); qc.invalidateQueries({ queryKey: ["bdos"] }); };

  const userByBdo: Record<string, UserRow> = {};
  users.forEach((u) => { if (u.bdoId) userByBdo[u.bdoId] = u; });

  const rows: TeamRow[] = [
    ...perf
      .filter((p) => !companyFilter || p.bdo.company === companyFilter)
      .map((p) => ({ key: `m-${p.bdo.id}`, kind: "member" as const, perf: p, user: userByBdo[p.bdo.id] })),
    // Standalone logins (e.g. the root admin) with no linked profile.
    ...(companyFilter ? [] : users.filter((u) => !u.bdoId).map((u) => ({ key: `a-${u.id}`, kind: "account" as const, user: u }))),
  ];

  const resend = useMutation({
    mutationFn: (userId: string) => api.post(`/auth/users/${userId}/resend-invite`),
    onSuccess: (res, _userId) => { const d = res.data; setCreds({ email: d.email ?? "", password: d.tempPassword, emailSent: d.emailSent, emailError: d.emailError }); refresh(); },
  });
  const removeMember = useMutation({
    mutationFn: async ({ bdoId, userId }: { bdoId: string; userId?: string }) => {
      if (userId) await api.delete(`/auth/users/${userId}`);
      await api.delete(`/bdo/${bdoId}`);
    },
    onSuccess: refresh,
  });
  const removeAccount = useMutation({
    mutationFn: (userId: string) => api.delete(`/auth/users/${userId}`),
    onSuccess: refresh,
  });

  const companyOfUser = (u: UserRow) => {
    const p = perf.find((x) => x.bdo.id === u.bdoId);
    return p ? (byKey[p.bdo.company]?.name ?? p.bdo.company) : undefined;
  };

  const memberCount = rows.filter((r) => r.kind === "member").length;
  const noLoginCount = rows.filter((r) => r.kind === "member" && !r.user).length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Team</h1>
          <p className="text-sm text-gray-500 mt-1">
            {memberCount} team members{noLoginCount > 0 ? ` · ${noLoginCount} without a login` : ""}
          </p>
        </div>
        <button onClick={() => setShowOnboard(true)} className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground text-sm font-medium rounded-lg hover:opacity-90">
          <UserPlus size={16} /> Add team member
        </button>
      </div>

      {creds && <CredentialsBanner creds={creds} onClose={() => setCreds(null)} />}

      <div className="flex gap-2">
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30">
          <option value="">All Companies</option>
          {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                {["Name", "Company", "Title", "Access", "Account", "Deals", "Tasks", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted">No team members yet — add one above.</td></tr>
              ) : rows.map((r) => {
                const p = r.perf; const u = r.user;
                return (
                  <tr key={r.key} className="hover:bg-primary/[0.03] transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{p ? p.bdo.name : u!.email}</td>
                    <td className="px-4 py-3 text-muted">{p ? (byKey[p.bdo.company]?.name ?? p.bdo.company) : "—"}</td>
                    <td className="px-4 py-3 text-muted">{p?.bdo.role ?? "—"}</td>
                    <td className="px-4 py-3">
                      {u ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleColor(u.role)}`}>{ROLE_LABELS[u.role] ?? u.role}</span>
                         : <span className="text-xs text-muted">No login</span>}
                    </td>
                    <td className="px-4 py-3">
                      {!u ? <span className="text-xs text-muted">—</span>
                        : u.mustChangePassword ? <span className="text-xs text-amber-600 font-medium">Invited</span>
                        : <span className="text-xs text-green-600">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-muted tabular-nums">{p ? p.bapxDeals + p.tradelineDeals : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {p ? <span className={p.tasks.overdue > 0 ? "text-red-600 font-medium" : "text-muted"}>{p.tasks.open}{p.tasks.overdue > 0 ? ` (${p.tasks.overdue}!)` : ""}</span> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        {p && !u && (
                          <ActionBtn title="Send invite" onClick={() => setInviteTarget(p)} icon={<Mail size={14} />} accent />
                        )}
                        {u && (
                          <ActionBtn title="Reset & resend invite" onClick={() => { if (confirm(`Reset password and email a new invite to ${u.email}?`)) resend.mutate(u.id); }} icon={<KeyRound size={14} />} />
                        )}
                        {u && (
                          <ActionBtn title="Change access role" onClick={() => setRoleTarget(u)} icon={<ShieldCheck size={14} />} />
                        )}
                        {u && !p && (
                          <ActionBtn title="Link to a staff profile" onClick={() => setLinkTarget(u)} icon={<Link2 size={14} />} accent />
                        )}
                        {p && (
                          <ActionBtn title="Edit profile" onClick={() => setEditProfile(p)} icon={<Pencil size={14} />} />
                        )}
                        <ActionBtn
                          title={p ? "Remove team member" : "Delete account"}
                          danger
                          icon={<Trash2 size={14} />}
                          onClick={() => {
                            if (p) { if (confirm(`Remove ${p.bdo.name}? This deactivates their profile${u ? " and deletes their login" : ""}.`)) removeMember.mutate({ bdoId: p.bdo.id, userId: u?.id }); }
                            else if (confirm(`Delete account for ${u!.email}?`)) removeAccount.mutate(u!.id);
                          }}
                        />
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
    </div>
  );
}

function ActionBtn({ title, icon, onClick, danger, accent }: { title: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; accent?: boolean }) {
  const c = danger ? "text-muted hover:text-red-600 hover:bg-red-500/10" : accent ? "text-accent hover:text-accent hover:bg-accent/10" : "text-muted hover:text-accent hover:bg-accent/10";
  return <button title={title} onClick={onClick} className={`p-1.5 rounded-lg ${c}`}>{icon}</button>;
}

function CredentialsBanner({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
  return (
    <div className={`rounded-xl px-4 py-3 flex items-start justify-between gap-4 border ${creds.emailSent ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
      <div className="text-sm">
        <p className={`font-semibold mb-0.5 ${creds.emailSent ? "text-green-800" : "text-amber-800"}`}>
          {creds.emailSent ? "Invite emailed" : "Account ready — email not sent"}{creds.email ? ` · ${creds.email}` : ""}
        </p>
        <p className={creds.emailSent ? "text-green-700" : "text-amber-700"}>
          Temporary password: <code className="bg-white/60 px-1.5 py-0.5 rounded font-mono">{creds.password}</code>
        </p>
        <p className={`text-xs mt-1 ${creds.emailSent ? "text-green-600" : "text-amber-600"}`}>
          {creds.emailSent
            ? "They'll set their own password on first login."
            : `Email couldn't be sent (${creds.emailError ?? "check SMTP settings"}). Share these credentials manually.`}
        </p>
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
    </div>
  );
}

// Tranqo design tokens for the popups — same as the KPI pages.
const btnSecondary = "px-4 py-2 text-sm text-foreground rounded-lg border border-border hover:bg-primary/5 transition-colors disabled:opacity-50";
const btnPrimary = "px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity";
const inputClass = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-60";
const labelClass = "text-xs font-medium text-muted block mb-1";
const errorClass = "text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-lg";

// ─── Onboard (add + invite in one) ──────────────────────────────────────────
function OnboardModal({ onClose, onDone }: { onClose: () => void; onDone: (c: Credentials) => void }) {
  const { companies } = useCompanies();
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: companies[0]?.key ?? "BAPX", role: "", accessRole: "BDO" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required."); return; }
    setSaving(true); setError("");
    try {
      const res = await api.post("/auth/onboard", form);
      onDone({ email: form.email, password: res.data.tempPassword, emailSent: res.data.emailSent, emailError: res.data.emailError });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to add team member.");
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Add team member" onClose={onClose} footer={
      <>
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={save} disabled={saving || !form.name.trim() || !form.email.trim()} className={btnPrimary}>
          {saving ? "Adding…" : "Add & send invite"}
        </button>
      </>
    }>
      {error && <div className={errorClass}>{error}</div>}
      <p className="text-xs text-muted -mt-1">Creates their profile and login, then emails an invite with a temporary password and the dashboard link.</p>
      <Field label="Full name *" value={form.name} onChange={(v) => set("name", v)} />
      <Field label="Email *" type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="name@example.com" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field label="Job title" value={form.role} onChange={(v) => set("role", v)} placeholder="e.g. Senior BDO" />
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
    if (!email.trim()) { setError("An email is required to send the invite."); return; }
    setSaving(true); setError("");
    try {
      const res = await api.post(`/auth/bdos/${perf.bdo.id}/invite`, { email, accessRole });
      onDone({ email, password: res.data.tempPassword, emailSent: res.data.emailSent, emailError: res.data.emailError });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to send invite.");
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
      <p className="text-xs text-muted -mt-1">Creates a login for this existing profile and emails the invite.</p>
      <Field label="Email *" type="email" value={email} onChange={setEmail} placeholder="name@example.com" />
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
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    try {
      await api.put(`/bdo/${b.id}`, { ...form, phone: form.phone || null, role: form.role || null });
      onSaved();
    } catch { setError("Failed to save."); } finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Edit ${b.name}`} onClose={onClose} footer={
      <>
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={save} disabled={saving || !form.name.trim()} className={btnPrimary}>{saving ? "Saving…" : "Save"}</button>
      </>
    }>
      {error && <div className={errorClass}>{error}</div>}
      <Field label="Full name *" value={form.name} onChange={(v) => set("name", v)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field label="Job title" value={form.role} onChange={(v) => set("role", v)} />
      </div>
      <Select label="Company" value={form.company} onChange={(v) => set("company", v)} options={companies.map((c) => ({ value: c.key, label: c.name }))} />
    </ModalShell>
  );
}

// ─── Link a login to a staff profile ────────────────────────────────────────
// A login needs a profile for anything personal (My KPIs, own leads/tasks) and,
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
    catch (err: unknown) { setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to link profile."); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title="Link to a staff profile" onClose={onClose} footer={
      <>
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={save} disabled={saving || !bdoId} className={btnPrimary}>{saving ? "Linking…" : "Link"}</button>
      </>
    }>
      {error && <div className={errorClass}>{error}</div>}
      <p className="text-sm text-foreground/80">
        Link <strong>{user.email}</strong> to the person they are. They&apos;ll see that person&apos;s KPIs, leads and tasks.
      </p>
      {profiles.length ? (
        <Select label="Staff profile" value={bdoId} onChange={setBdoId}
          options={[{ value: "", label: "— Choose a person —" }, ...profiles.map((x) => ({ value: x.id, label: `${x.name} · ${x.company}` }))]} />
      ) : (
        <p className="text-xs text-muted">Every staff profile already has a login. Add the person with &quot;Add team member&quot; first.</p>
      )}
    </ModalShell>
  );
}

// ─── Change access role ─────────────────────────────────────────────────────
function ChangeRoleModal({ user, companyName, onClose, onSaved }: { user: UserRow; companyName?: string; onClose: () => void; onSaved: () => void }) {
  // Admins show as Group Owner; retired roles start unselected so a level must be picked.
  const current = user.role === "ADMIN" ? "CEO" : user.role;
  const [role, setRole] = useState(ACCESS_LEVELS.some((l) => l.value === current) ? current : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const unchanged = role === current;
  const save = async () => {
    setSaving(true); setError("");
    try { await api.put(`/auth/users/${user.id}/role`, { role }); onSaved(); }
    catch (err: unknown) { setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to update access."); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title="Change access role" onClose={onClose} footer={
      <>
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={save} disabled={saving || !role || unchanged} className={btnPrimary}>{saving ? "Saving…" : "Update"}</button>
      </>
    }>
      {error && <div className={errorClass}>{error}</div>}
      <p className="text-sm text-foreground/80">
        Changing access for <strong>{user.email}</strong>
        {!ACCESS_LEVELS.some((l) => l.value === current) && <> (currently <em>{ROLE_LABELS[user.role] ?? user.role}</em>, which is no longer used)</>}.
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
        {!selected && <option value="" disabled>— Choose an access level —</option>}
        {ACCESS_LEVELS.map((l) => (
          <option key={l.value} value={l.value} disabled={l.value === "BUSINESS_CEO" && businessCeoDisabled}>
            {l.label}{l.value === "BUSINESS_CEO" && businessCeoDisabled ? " (needs a staff profile)" : ""}
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
  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <h2 className="font-serif text-lg text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">{children}</div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 shrink-0">{footer}</div>
      </div>
    </div>
  );
}
function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
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
