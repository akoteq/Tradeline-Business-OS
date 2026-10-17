"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isStaff } from "@/lib/auth";

const inputClass =
  "w-full border border-border bg-background rounded-lg pl-3 pr-10 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent focus:outline-none disabled:opacity-60";

export default function ChangePasswordPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const passwordId = useId();
  const confirmId = useId();
  const errorId = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await api.put("/auth/me/password", { password });
      if (isStaff(user) && user?.bdoId) {
        router.replace("/overview");
      } else {
        router.replace("/");
      }
    } catch {
      setError("Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="relative mx-auto mb-4" style={{ width: 56, height: 56 }}>
            <Image src="/icon.png" alt="Trunqo" fill sizes="56px" priority className="object-contain rounded-2xl" />
          </div>
          <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">Security</div>
          <h1 className="font-serif text-3xl text-foreground">Set your password</h1>
          <p className="text-sm text-muted mt-1">
            {user?.email ? <>Choose a new password for <span className="text-foreground">{user.email}</span> to continue.</> : "You must set a new password before continuing."}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="bg-surface rounded-xl border border-border shadow-sm p-6 space-y-4">
          {error && (
            <div id={errorId} role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}
          <div>
            <label htmlFor={passwordId} className="block text-xs font-medium text-muted mb-1">New password</label>
            <div className="relative">
              <input
                id={passwordId}
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
                disabled={loading}
                aria-describedby={error ? errorId : undefined}
                className={inputClass}
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                disabled={loading}
                aria-label={show ? "Hide passwords" : "Show passwords"}
                aria-pressed={show}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-foreground disabled:opacity-60"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor={confirmId} className="block text-xs font-medium text-muted mb-1">Confirm password</label>
            <input
              id={confirmId}
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              disabled={loading}
              className={inputClass}
              placeholder="Repeat the password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:opacity-90 text-accent-foreground font-medium text-sm rounded-lg px-4 py-2.5 transition-opacity disabled:opacity-50"
          >
            {loading ? "Saving…" : "Set password & continue"}
          </button>
        </form>

        <p className="text-center text-xs text-muted mt-4">
          Not you?{" "}
          <button onClick={logout} className="underline hover:text-foreground transition-colors">Sign out</button>
        </p>
      </div>
    </div>
  );
}
