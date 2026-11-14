"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { chatStore, isTyping } from "@/lib/chat";

const server = () => chatStore.get();

/** Whether a person is online right now. */
export function useOnline(userId: string | null | undefined): boolean {
  const s = useSyncExternalStore(chatStore.subscribe, chatStore.get, server);
  return !!userId && s.online.has(userId);
}

/** Whether the other person is typing in this chat. Re-checks every second so it lapses on time. */
export function useTyping(conversationId: string | null | undefined): boolean {
  const s = useSyncExternalStore(chatStore.subscribe, chatStore.get, server);
  const [, tick] = useState(0);
  const on = !!conversationId && isTyping(s, conversationId);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [on]);
  return on;
}
