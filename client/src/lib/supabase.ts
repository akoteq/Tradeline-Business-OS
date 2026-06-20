// Auth token helpers — replaces the Supabase client

const KEY = 'auth_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export function setToken(token: string) {
  localStorage.setItem(KEY, token);
  document.cookie = `${KEY}=${token}; path=/; max-age=604800; SameSite=Lax`;
}

export function clearToken() {
  localStorage.removeItem(KEY);
  document.cookie = `${KEY}=; path=/; max-age=0`;
}

export function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}
