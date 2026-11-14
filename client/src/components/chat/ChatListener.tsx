"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/components/Toast";
import { useSocket, useSocketEvent } from "@/components/RealtimeProvider";
import { useOpenLink } from "@/components/notifications/Notifications";
import { chatKeys, chatStore, messagesPath, type ChatConversation, type ChatMessage } from "@/lib/chat";
import { markRead, patchConversation, upsertMessage } from "./chatCache";

/** Total unread messages, for the Messages badge. Live over the socket; refetched on focus. */
export function useUnreadMessages() {
  const { user } = useAuth();
  const { data } = useQuery<{ unread: number }>({
    queryKey: chatKeys.count,
    queryFn: () => fetcher("/messages/unread-count"),
    enabled: !!user,
    refetchOnWindowFocus: true,
    refetchInterval: 120_000,
  });
  return data?.unread ?? 0;
}

const preview = (m: ChatMessage) =>
  m.body.trim() || (m.attachments.length === 1 ? `Sent a file: ${m.attachments[0].name}` : `Sent ${m.attachments.length} files`);

/**
 * Mounted once (AppShell). Keeps chat caches current from the socket, tracks who's online and
 * typing, marks the open chat read as messages arrive, and toasts messages for other chats.
 */
export function ChatListener() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const socket = useSocket();
  const open = useOpenLink();
  const me = user?.id;

  useSocketEvent<{ unread: number }>("messages:count", ({ unread }) => qc.setQueryData(chatKeys.count, { unread }));

  useSocketEvent<{ conversationId: string; message: ChatMessage }>("message:new", ({ conversationId, message }) => {
    upsertMessage(qc, message);
    const known = qc.getQueryData<ChatConversation[]>(chatKeys.list)?.find((c) => c.id === conversationId);
    if (known) {
      patchConversation(qc, conversationId, {
        lastMessageAt: message.createdAt, lastPreview: preview(message), lastSenderId: message.senderUserId,
        unread: message.senderUserId === me ? known.unread : known.unread + 1,
      });
      // Newest first.
      qc.setQueryData<ChatConversation[]>(chatKeys.list, (list) => list && [...list].sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "")));
    } else {
      qc.invalidateQueries({ queryKey: chatKeys.list });
    }
    if (message.senderUserId === me) return;
    chatStore.setTyping(conversationId, false);
    const onScreen = chatStore.get().active === conversationId && document.visibilityState === "visible";
    if (onScreen) { markRead(qc, conversationId); return; }
    if (known?.muted) return;
    toast.info(known?.other.name ? `Message from ${known.other.name}` : "New message", {
      description: preview(message).slice(0, 120),
      action: { label: "Open", onClick: () => open(messagesPath(conversationId)) },
    });
  });

  const changed = ({ conversationId, message }: { conversationId: string; message: ChatMessage }) => {
    upsertMessage(qc, message);
    const known = qc.getQueryData<ChatConversation[]>(chatKeys.list)?.find((c) => c.id === conversationId);
    if (known && known.lastMessageAt === message.createdAt) qc.invalidateQueries({ queryKey: chatKeys.list });
  };
  useSocketEvent("message:updated", changed);
  useSocketEvent("message:deleted", changed);

  useSocketEvent<{ conversationId: string; userId: string; lastReadAt: string }>("conversation:read", ({ conversationId, userId, lastReadAt }) => {
    if (userId !== me) patchConversation(qc, conversationId, { otherLastReadAt: lastReadAt });
  });
  useSocketEvent<{ conversationId: string; userId: string; typing: boolean }>("typing", ({ conversationId, userId, typing }) => {
    if (userId !== me) chatStore.setTyping(conversationId, typing);
  });
  useSocketEvent<{ userId: string; online: boolean }>("presence", ({ userId, online }) => chatStore.setOnline(userId, online));

  // Who's online among the people you chat with: asked on connect and when the list changes.
  const { data: list } = useQuery<ChatConversation[]>({ queryKey: chatKeys.list, queryFn: () => fetcher("/messages/conversations"), enabled: !!user });
  const ids = (list ?? []).map((c) => c.other.id).sort().join(",");
  useEffect(() => {
    if (!socket || !ids) return;
    const ask = () => socket.emit("presence:list", { userIds: ids.split(",") }, (r: { online: string[] }) => chatStore.addOnline(r?.online ?? []));
    ask();
    socket.on("connect", ask);
    return () => { socket.off("connect", ask); };
  }, [socket, ids]);

  return null;
}
