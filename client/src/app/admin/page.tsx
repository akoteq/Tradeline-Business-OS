"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { UserPlus, Trash2, CheckCircle, Clock, ShieldCheck } from "lucide-react";

type BdoOption = { id: string; name: string; company: string };

type SystemUser = {
  id: string;
  email: string;
  role: string;
  bdoId: string | null;
  name: string | null;
  createdAt: string;
  confirmed: boolean;
};

export default function AdminPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: "", bdoId: "" });
  const [success, setSuccess] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");

  const { data: bdos = [] } = useQuery<BdoOption[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
  });

  const { data: users = [], isLoading } = useQuery<SystemUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetcher("/admin/users"),
  });

  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; bdoId: string; bdoName: string }) =>
      api.post("/admin/invite-bdo", body).then((r) => r.data),
    onSuccess: (data: { inviteUrl: string }) => {
      setSuccess(`Invite link created for ${form.email}`);
      setInviteUrl(data.inviteUrl);
      setError("");
      setForm({ email: "", bdoId: "" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to send invite";
      setError(msg);
      setSuccess("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const selectedBdo = bdos.find((b) => b.id === form.bdoId);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.bdoId) { setError("Please fill in all fields."); return; }
    setError("");
    inviteMutation.mutate({ email: form.email, bdoId: form.bdoId, bdoName: selectedBdo?.name ?? "" });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-500 mt-1">Invite BDOs and manage system access</p>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-lg">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <UserPlus size={16} className="text-indigo-600" /> Invite a BDO
        </h2>
        <form onSubmit={handleInvite} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">BDO record</label>
            <select
              value={form.bdoId}
              onChange={(e) => setForm((f) => ({ ...f, bdoId: e.target.value }))}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Select a BDO…</option>
              {bdos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.company}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              placeholder="bdo@example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          {success && (
            <div className="text-green-600 text-sm bg-green-50 border border-green-100 rounded-lg px-3 py-2 space-y-2">
              <p className="flex items-center gap-1.5"><CheckCircle size={14} /> {success}</p>
              {inviteUrl && (
                <div>
                  <p className="text-xs text-green-700 font-medium mb-1">Share this link with the BDO:</p>
                  <input
                    readOnly
                    value={inviteUrl}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full text-xs bg-white border border-green-200 rounded px-2 py-1 text-gray-700 cursor-text"
                  />
                </div>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="w-full py-2.5 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {inviteMutation.isPending ? "Sending invite…" : "Send invite email"}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-3">
          The BDO will receive an email with a link to set their own password and activate their account.
        </p>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">{users.length} system users</h2>
        </div>
        {isLoading ? (
          <p className="px-4 py-8 text-sm text-gray-400 text-center">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-800">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        u.role === "CEO"
                          ? "bg-indigo-50 text-indigo-700"
                          : u.role === "BDO"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {u.confirmed ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <ShieldCheck size={12} /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-500">
                          <Clock size={12} /> Invite pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${u.email} from the system?`)) deleteMutation.mutate(u.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
