"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

const PUBLIC_PATHS = ["/login", "/change-password"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      if (!PUBLIC_PATHS.includes(pathname)) router.replace("/login");
      return;
    }
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    api.get<AuthUser>("/auth/me")
      .then((r) => {
        setUser(r.data);
        if (r.data.mustChangePassword && pathname !== "/change-password") {
          router.replace("/change-password");
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        delete api.defaults.headers.common["Authorization"];
        if (!PUBLIC_PATHS.includes(pathname)) router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const r = await api.post<{ token: string; user: AuthUser }>("/auth/login", { email, password });
    localStorage.setItem("token", r.data.token);
    api.defaults.headers.common["Authorization"] = `Bearer ${r.data.token}`;
    setUser(r.data.user);
    return r.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
    router.replace("/login");
  }, [router]);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
