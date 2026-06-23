"use client";

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getToken, clearToken, decodeToken } from '@/lib/supabase';

export type Role = 'CEO' | 'BDO';

type AuthUser = {
  id: string;
  email: string;
  role: Role;
  bdoId: string | null;
  name: string | null;
};

type AuthContextType = {
  user: AuthUser | null;
  role: Role | null;
  bdoId: string | null;
  displayName: string | null;
  loading: boolean;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

function readUser(): AuthUser | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload) return null;
  // Check expiry
  if (payload.exp && (payload.exp as number) * 1000 < Date.now()) {
    clearToken();
    return null;
  }
  return {
    id: payload.id as string,
    email: payload.email as string,
    role: (payload.role as Role) ?? 'BDO',
    bdoId: (payload.bdoId as string | null) ?? null,
    name: (payload.name as string | null) ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(readUser());
    setLoading(false);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'auth_token') setUser(readUser());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.role ?? null,
      bdoId: user?.bdoId ?? null,
      displayName: user?.name ?? user?.email ?? null,
      loading,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
