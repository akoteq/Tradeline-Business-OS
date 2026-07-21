"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { UserPlus, Mail, KeyRound, ShieldCheck, Pencil, Trash2, X } from "lucide-react";

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

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "CEO", label: "CEO" },
  { value: "MANAGING_PARTNER", label: "Managing Partner" },
  { value: "SENIOR_PARTNER", label: "Senior Partner / Consultant" },
  { value: "SENIOR_BDO", label: "Senior BDO" },
  { value: "BDO", label: "BDO" },
  { value: "JUNIOR_BDO", label: "Junior BDO" },
  { value: "INTERN", label: "Intern" },
];
const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));
function roleColor(role: string) {
  if (role === "ADMIN") return "bg-purple-100 text-purple-700";
  if (["CEO", "MANAGING_PARTNER", "SENIOR_PARTNER"].includes(role)) return "bg-amber-100 text-amber-700";
  if (role === "SENIOR_BDO") return "bg-teal-100 text-teal-700";
  return "bg-blue-100 text-blue-700";
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
        <button onClick={() => setShowOnboard(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          <UserPlus size={16} /> Add team member
        </button>
      </div>

      {creds && <CredentialsBanner creds={creds} onClose={() => setCreds(null)} />}

      <div className="flex gap-2">
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">All Companies</option>
          {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Name", "Company", "Title", "Access", "Account", "Deals", "Tasks", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No team members yet — add one above.</td></tr>
              ) : rows.map((r) => {
                const p = r.perf; const u = r.user;
                return (
                  <tr key={r.key} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-medium text-gray-900">{p ? p.bdo.name : u!.email}</td>
                    <td className="px-3 py-2.5 text-gray-600">{p ? (byKey[p.bdo.company]?.name ?? p.bdo.company) : "—"}</td>
                    <td className="px-3 py-2.5 text-gray-600">{p?.bdo.role ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {u ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleColor(u.role)}`}>{ROLE_LABELS[u.role] ?? u.role}</span>
                         : <span className="text-xs text-gray-400">No login</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {!u ? <span className="text-xs text-gray-400">—</span>
                        : u.mustChangePassword ? <span className="text-xs text-amber-600 font-medium">Invited</span>
                        : <span className="text-xs text-green-600">Active</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 tabular-nums">{p ? p.bapxDeals + p.tradelineDeals : "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {p ? <span className={p.tasks.overdue > 0 ? "text-red-600 font-medium" : "text-gray-600"}>{p.tasks.open}{p.tasks.overdue > 0 ? ` (${p.tasks.overdue}!)` : ""}</span> : "—"}
                    </td>
                    <td className="px-3 py-2.5">
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
      {roleTarget && <ChangeRoleModal user={roleTarget} onClose={() => setRoleTarget(null)} onSaved={() => { setRoleTarget(null); refresh(); }} />}
    </div>
  );
}

function ActionBtn({ title, icon, onClick, danger, accent }: { title: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; accent?: boolean }) {
  const c = danger ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : accent ? "text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50";
  return <button title={title} onClick={onClick} className={`p-1.5 rounded ${c}`}>{icon}</button>;
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

// ─── Onboard (add + invite in one) ──────────────────────────────────────────
function OnboardModal({ onClose, onDone }: { onClose: () => void; onDone: (c: Credentials) => void }) {
  const { companies } = useCompanies();
  const { data: staff = [] } = useQuery<{ id: string; name: string; role: string | null }[]>({ queryKey: ["bdos"], queryFn: () => fetcher("/bdo") });
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: companies[0]?.key ?? "BAPX", role: "", accessRole: "BDO", managerId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required."); return; }
    setSaving(true); setError("");
    try {
      const res = await api.post("/auth/onboard", { ...form, managerId: form.managerId || undefined });
      onDone({ email: form.email, password: res.data.tempPassword, emailSent: res.data.emailSent, emailError: res.data.emailError });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to add team member.");
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Add team member" onClose={onClose} footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
        <button onClick={save} disabled={saving || !form.name.trim() || !form.email.trim()} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">
          {saving ? "Adding…" : "Add & send invite"}
        </button>
      </>
    }>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
      <p className="text-xs text-gray-500 -mt-1">Creates their profile and login, then emails an invite with a temporary password and the dashboard link.</p>
      <Field label="Full name *" value={form.name} onChange={(v) => set("name", v)} />
      <Field label="Email *" type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="name@example.com" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field label="Job title" value={form.role} onChange={(v) => set("role", v)} placeholder="e.g. Senior BDO" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Company" value={form.company} onChange={(v) => set("company", v)} options={companies.map((c) => ({ value: c.key, label: c.name }))} />
        <Select label="Access level" value={form.accessRole} onChange={(v) => set("accessRole", v)} options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))} />
      </div>
      <Select label="Reports to (manager)" value={form.managerId} onChange={(v) => set("managerId", v)}
        options={[{ value: "", label: "— None —" }, ...staff.map((s) => ({ value: s.id, label: s.name + (s.role ? ` · ${s.role}` : "") }))]} />
    </ModalShell>
  );
}

// ─── Invite an existing profile ─────────────────────────────────────────────
function InviteExistingModal({ perf, onClose, onDone }: { perf: BdoPerf; onClose: () => void; onDone: (c: Credentials) => void }) {
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
        <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
        <button onClick={save} disabled={saving || !email.trim()} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Sending…" : "Send invite"}</button>
      </>
    }>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
      <p className="text-xs text-gray-500 -mt-1">Creates a login for this existing profile and emails the invite.</p>
      <Field label="Email *" type="email" value={email} onChange={setEmail} placeholder="name@example.com" />
      <Select label="Access level" value={accessRole} onChange={setAccessRole} options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))} />
    </ModalShell>
  );
}

// ─── Edit profile ───────────────────────────────────────────────────────────
function EditProfileModal({ perf, onClose, onSaved }: { perf: BdoPerf; onClose: () => void; onSaved: () => void }) {
  const { companies } = useCompanies();
  const { data: staff = [] } = useQuery<{ id: string; name: string; role: string | null }[]>({ queryKey: ["bdos"], queryFn: () => fetcher("/bdo") });
  const b = perf.bdo;
  const [form, setForm] = useState({ name: b.name, phone: b.phone ?? "", company: b.company, role: b.role ?? "", managerId: b.managerId ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    try {
      await api.put(`/bdo/${b.id}`, { ...form, phone: form.phone || null, role: form.role || null, managerId: form.managerId || null });
      onSaved();
    } catch { setError("Failed to save."); } finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Edit ${b.name}`} onClose={onClose} footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
        <button onClick={save} disabled={saving || !form.name.trim()} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      </>
    }>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
      <Field label="Full name *" value={form.name} onChange={(v) => set("name", v)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field label="Job title" value={form.role} onChange={(v) => set("role", v)} />
      </div>
      <Select label="Company" value={form.company} onChange={(v) => set("company", v)} options={companies.map((c) => ({ value: c.key, label: c.name }))} />
      <Select label="Reports to (manager)" value={form.managerId} onChange={(v) => set("managerId", v)}
        options={[{ value: "", label: "— None —" }, ...staff.filter((s) => s.id !== b.id).map((s) => ({ value: s.id, label: s.name + (s.role ? ` · ${s.role}` : "") }))]} />
    </ModalShell>
  );
}

// ─── Change access role ─────────────────────────────────────────────────────
function ChangeRoleModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await api.put(`/auth/users/${user.id}/role`, { role }); onSaved(); } finally { setSaving(false); } };
  return (
    <ModalShell title="Change access role" onClose={onClose} footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
        <button onClick={save} disabled={saving || role === user.role} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Update"}</button>
      </>
    }>
      <p className="text-sm text-gray-600">Changing role for <strong>{user.email}</strong>.</p>
      <Select label="Access level" value={role} onChange={setRole} options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))} />
    </ModalShell>
  );
}

// ─── Shared UI ──────────────────────────────────────────────────────────────
function ModalShell({ title, children, footer, onClose }: { title: string; children: React.ReactNode; footer: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}
function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
    </div>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
