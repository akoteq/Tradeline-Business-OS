"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { isStaff } from "@/lib/auth";
import { BrandLoader } from "@/components/BrandLoader";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (user.mustChangePassword) {
        router.replace("/change-password");
      } else if (isStaff(user) && user.bdoId) {
        router.replace("/overview");
      } else {
        router.replace("/"); // home routes Group Owner / Business CEO onward
      }
    } catch {
      setError("Invalid email or password.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="relative mx-auto mb-4" style={{ width: 56, height: 56 }}>
            <Image
              src="/icon.png"
              alt="Trunqo"
              fill
              sizes="56px"
              priority
              className="object-contain rounded-2xl"
            />
          </div>
          <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
            Operations Portal
          </div>

        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-surface rounded-xl border border-border shadow-sm p-6 space-y-4"
        >
          {error && (
            <div
              id={errorId}
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor={emailId} className="block text-xs font-medium text-muted mb-1">
              Email
            </label>
            <input
              id={emailId}
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              inputMode="email"
              disabled={loading}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={!!error}
              className="w-full border border-border bg-background rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent focus:outline-none disabled:opacity-60"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor={passwordId} className="block text-xs font-medium text-muted">
                Password
              </label>
              <Link
                href="/forgot-password"
                tabIndex={loading ? -1 : 0}
                className="text-xs font-medium text-accent hover:opacity-80"
              >
                Forgot password?
              </Link>
            </div>

            <div className="relative">
              <input
                id={passwordId}
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
                className="w-full border border-border bg-background rounded-lg pl-3 pr-10 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent focus:outline-none disabled:opacity-60"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-foreground disabled:opacity-60"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:opacity-90 text-accent-foreground font-medium text-sm rounded-lg px-4 py-2.5 transition-opacity disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <AnimatePresence>
        {loading && <BrandLoader label="Signing in" />}
      </AnimatePresence>
    </div>
  );
}