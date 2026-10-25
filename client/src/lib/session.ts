/**
 * A routing hint, not authentication.
 *
 * The real session is the JWT in localStorage plus the API. Middleware cannot read localStorage,
 * so on login we also set this plain cookie. Middleware uses it for one decision only: what to
 * show at "/" (dashboard for signed-in people, the public landing page for everyone else).
 * It holds no secret and grants no access: a forged or stale cookie just shows the dashboard
 * route, where AuthProvider asks the API, fails, and sends the person to /login.
 *
 * This file is imported by middleware (Edge runtime), so nothing here may touch `document`
 * or `window` at module level.
 */
export const SESSION_COOKIE = "trunqo_session";

// Longer than any sensible token life. Both directions fail safe: a stale cookie is cleared by
// AuthProvider, and a missing one is restored from the stored token by the landing page.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function hasSessionCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c.startsWith(`${SESSION_COOKIE}=`));
}

/** Returns true when the browser actually accepted the cookie. */
export function setSessionCookie(): boolean {
  if (typeof document === "undefined") return false;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=1; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  return hasSessionCookie();
}

export function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function hasStoredToken(): boolean {
  try {
    return !!localStorage.getItem("token");
  } catch {
    return false;
  }
}
