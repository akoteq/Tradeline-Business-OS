"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { UserCircle, Plus, KeyRound, Trash2, ShieldCheck } from "lucide-react";

type BDO = { id: string; name: string; company: string };
type UserRow = { id: string; email: string; role: string; bdoId: string | null; bdoName: string | null; mustChangePassword: boolean };

export default function ManageUsersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [inviteBanner, setInviteBanner] = useState<{ email: string; password: string } | null>(null);

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["auth-users"],
    queryFn: () => fetcher("/auth/users"),
  });

  const { data: bdos = [] } = useQuery<BDO[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-users"] }),
  });

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Users</h1>
          <p className="text-sm text-gray-500">Create and manage BDO login accounts</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Invite BDO
        </button>
      </div>

      {inviteBanner && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
          <div className="text-sm text-green-800">
            <p className="font-semibold mb-0.5">Account created for <span className="font-bold">{inviteBanner.email}</span></p>
            <p>Temporary password: <code className="bg-green-100 px-1.5 py-0.5 rounded font-mono">{inviteBanner.password}</code></p>
            <p className="text-xs text-green-600 mt-1">Share these credentials. The user will be required to set a new password on first login.</p>
          </div>
          <button onClick={() => setInviteBanner(null)} className="text-green-500 hover:text-green-700 mt-0.5 text-lg leading-none">&times;</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No users yet. Create one above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["User", "Role", "Linked BDO", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserCircle size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-900">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "ADMIN" ? "bg-purple-100 text-purple-700" : u.role === "CEO" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.bdoName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {u.mustChangePassword ? (
                      <span className="text-xs text-amber-600 font-medium">Pending password change</span>
                    ) : (
                      <span className="text-xs text-green-600">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRoleTarget(u)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Change role"
                      >
                        <ShieldCheck size={12} />
                        Role
                      </button>
                      <button
                        onClick={() => setResetTarget(u)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <KeyRound size={12} />
                        Reset pw
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete account for ${u.email}?`)) deleteMutation.mutate(u.id); }}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <CreateUserModal
          bdos={bdos}
          existingBdoIds={users.filter((u) => u.bdoId).map((u) => u.bdoId!)}
          onClose={() => setShowForm(false)}
          onSaved={(email, password) => {
            setShowForm(false);
            setInviteBanner({ email, password });
            qc.invalidateQueries({ queryKey: ["auth-users"] });
          }}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onSaved={() => { setResetTarget(null); qc.invalidateQueries({ queryKey: ["auth-users"] }); }}
        />
      )}

      {roleTarget && (
        <ChangeRoleModal
          user={roleTarget}
          onClose={() => setRoleTarget(null)}
          onSaved={() => { setRoleTarget(null); qc.invalidateQueries({ queryKey: ["auth-users"] }); }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ bdos, existingBdoIds, onClose, onSaved }: {
  bdos: BDO[];
  existingBdoIds: string[];
  onClose: () => void;
  onSaved: (email: string, password: string) => void;
}) {
  const [form, setForm] = useState({ email: "", password: "", bdoId: "", role: "BDO" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const availableBdos = bdos.filter((b) => !existingBdoIds.includes(b.id));

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      await api.post("/auth/users", { ...form, bdoId: form.bdoId || undefined });
      onSaved(form.email, form.password);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to create user";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Invite User</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="bdo@example.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Temporary Password</label>
            <input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="They will change this on first login" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Role</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm">
              <option value="BDO">BDO</option>
              <option value="ADMIN">Admin</option>
              <option value="CEO">CEO</option>
            </select>
          </div>
          {form.role === "BDO" && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Link to BDO Profile</label>
              <select value={form.bdoId} onChange={(e) => setForm((f) => ({ ...f, bdoId: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm">
                <option value="">— Select BDO —</option>
                {availableBdos.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.company})</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Linking a BDO profile means they only see their own data after login.</p>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving || !form.email || !form.password} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">
            {saving ? "Creating…" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/auth/users/${user.id}/password`, { password });
      setDone(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Reset Password</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="p-5 space-y-3">
          {done ? (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">
              Password reset for {user.email}. They will be required to set a new password on next login.
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">Setting temporary password for <strong>{user.email}</strong>.</p>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Temporary Password</label>
                <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="New temporary password" />
              </div>
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">{done ? "Close" : "Cancel"}</button>
          {!done && (
            <button onClick={save} disabled={saving || !password} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">
              {saving ? "Saving…" : "Reset"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChangeRoleModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.put(`/auth/users/${user.id}/role`, { role });
      onSaved();
    } catch {
      setError("Failed to update role.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xs">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Change Role</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
          <p className="text-sm text-gray-600">Changing role for <strong>{user.email}</strong>.</p>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">New Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
              <option value="BDO">BDO</option>
              <option value="ADMIN">Admin</option>
              <option value="CEO">CEO</option>
            </select>
          </div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving || role === user.role} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">
            {saving ? "Saving…" : "Update Role"}
          </button>
        </div>
      </div>
    </div>
  );
}
