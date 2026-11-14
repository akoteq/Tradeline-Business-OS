"use client";

import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { chatKeys, type ChatConversation, type ChatMessage, type MessagesPage } from "@/lib/chat";

// Small helpers that keep the React Query caches in step with what the server and socket say.

type Pages = InfiniteData<MessagesPage, string | null>;

/** Adds a message to the newest page (or replaces it if it's already there). */
export function upsertMessage(qc: QueryClient, m: ChatMessage) {
  qc.setQueryData<Pages>(chatKeys.messages(m.conversationId), (data) => {
    if (!data) return data;
    const exists = data.pages.some((p) => p.messages.some((x) => x.id === m.id));
    const pages = exists
      ? data.pages.map((p) => ({ ...p, messages: p.messages.map((x) => (x.id === m.id ? m : x)) }))
      : data.pages.map((p, i) => (i === 0 ? { ...p, messages: [...p.messages, m] } : p));
    return { ...data, pages };
  });
}

export function patchConversation(qc: QueryClient, id: string, patch: Partial<ChatConversation>) {
  qc.setQueryData<ChatConversation[]>(chatKeys.list, (list) => list?.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  qc.setQueryData<ChatConversation>(chatKeys.conversation(id), (c) => (c ? { ...c, ...patch } : c));
}

/** Marks a chat read on the server and clears its unread count here straight away. */
export async function markRead(qc: QueryClient, id: string) {
  const before = qc.getQueryData<ChatConversation[]>(chatKeys.list)?.find((c) => c.id === id)?.unread ?? 0;
  patchConversation(qc, id, { unread: 0 });
  if (before) qc.setQueryData<{ unread: number }>(chatKeys.count, (c) => ({ unread: Math.max(0, (c?.unread ?? 0) - before) }));
  try {
    const r = await api.post<{ lastReadAt: string }>(`/messages/conversations/${id}/read`);
    patchConversation(qc, id, { lastReadAt: r.data.lastReadAt });
  } catch {
    qc.invalidateQueries({ queryKey: chatKeys.count });
  }
}
