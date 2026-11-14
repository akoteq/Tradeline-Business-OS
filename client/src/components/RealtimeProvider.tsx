"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./AuthProvider";

/**
 * One Socket.IO connection per signed-in tab, for live updates (server: lib/realtime.ts).
 * It connects to the API's origin with the login token and reconnects on its own. Everything
 * still works without it: lists refetch when the tab regains focus.
 */

const RealtimeContext = createContext<Socket | null>(null);

// NEXT_PUBLIC_API_URL ends in /api; the socket lives on the same origin.
const socketOrigin = () => (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "") || undefined;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let token: string | null = null;
    try { token = localStorage.getItem("token"); } catch { /* storage blocked */ }
    if (!token) return;
    const s = io(socketOrigin(), { auth: { token }, transports: ["websocket", "polling"] });
    setSocket(s);
    return () => { s.disconnect(); setSocket(null); };
  }, [userId]);

  return <RealtimeContext.Provider value={socket}>{children}</RealtimeContext.Provider>;
}

export const useSocket = () => useContext(RealtimeContext);

/** Runs the handler for a socket event while the component is mounted. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const socket = useSocket();
  // The latest handler, so callers don't need useCallback and we don't resubscribe every render.
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    if (!socket) return;
    const fn = (p: T) => ref.current(p);
    socket.on(event, fn);
    return () => { socket.off(event, fn); };
  }, [socket, event]);
}
