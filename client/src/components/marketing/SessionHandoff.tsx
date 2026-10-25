"use client";

import { useEffect } from "react";
import { hasSessionCookie, hasStoredToken, setSessionCookie } from "@/lib/session";

/**
 * Covers people who were already signed in before the session cookie existed.
 *
 * They have a token in localStorage but no cookie, so middleware shows them the landing page at
 * "/". If we find a token here, we set the cookie and reload "/" once, which now resolves to the
 * dashboard. If the token turns out to be expired, the dashboard route clears it and sends them
 * to /login, same as before.
 *
 * Only runs at "/" (not when someone opens /home on purpose), and only when the browser
 * actually accepted the cookie, so it can never loop.
 */
export function SessionHandoff() {
  useEffect(() => {
    if (window.location.pathname !== "/") return;
    if (!hasStoredToken()) return;
    if (hasSessionCookie() || setSessionCookie()) window.location.replace("/");
  }, []);

  return null;
}
