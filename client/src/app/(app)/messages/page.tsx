"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { MessagesSquare } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { toast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { onDeepLink, clearParams } from "@/lib/mentions";
import { chatKeys, type ChatConversation, type ChatPerson } from "@/lib/chat";
import { ChatList } from "@/components/chat/ChatList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { NewChatDialog } from "@/components/chat/NewChatDialog";

/**
 * Messages: private one-to-one chats (docs/chat/README.md). Chats on the left, the open chat on
 * the right; on a phone, one at a time. Links: ?c=<chat id> opens a chat, ?to=<user id> starts
 * (or reopens) a chat with that person.
 */
export default function MessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const { data: list = [], isLoading, isError } = useQuery<ChatConversation[]>({
    queryKey: chatKeys.list,
    queryFn: () => fetcher("/messages/conversations"),
    enabled: !!user,
  });

  // Keep the open chat in the address, so a refresh or a shared link reopens it.
  const select = (id: string | null) => {
    setSelected(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("c", id); else url.searchParams.delete("c");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  };

  const openWith = async (userId: string) => {
    setOpening(userId);
    try {
      const r = await api.post<ChatConversation>("/messages/conversations", { userId });
      qc.setQueryData(chatKeys.conversation(r.data.id), r.data);
      qc.setQueryData<ChatConversation[]>(chatKeys.list, (l) => (l && !l.some((c) => c.id === r.data.id) ? [r.data, ...l] : l));
      setPicking(false);
      select(r.data.id);
    } catch (err) {
      toast.failed("Couldn't open that chat", err);
    } finally { setOpening(null); }
  };

  useEffect(() => onDeepLink((q) => {
    const to = q.get("to");
    if (to) { clearParams("to"); openWith(to); return; }
    const c = q.get("c");
    if (c) setSelected(c);
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-[calc(100dvh-3.5rem)] md:h-screen">
      <div className="grid h-full min-h-0 md:grid-cols-[minmax(280px,340px)_1fr]">
        <aside className={clsx("min-h-0 border-r border-border bg-surface", selected ? "hidden md:block" : "block")}>
          <ChatList
            conversations={list} loading={isLoading} error={isError}
            activeId={selected} onSelect={select} onNew={() => setPicking(true)}
          />
        </aside>
        <section className={clsx("min-h-0 bg-background", selected ? "block" : "hidden md:block")}>
          {selected ? (
            <ChatWindow key={selected} conversationId={selected} onBack={() => select(null)} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <MessagesSquare size={28} className="text-muted/60" />
              <p className="text-sm font-medium text-foreground">Pick a chat, or start a new one</p>
              <p className="max-w-xs text-xs text-muted">Messages are private: only you and the person you&apos;re talking to can see them.</p>
              <button onClick={() => setPicking(true)} className="mt-2 rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90">New message</button>
            </div>
          )}
        </section>
      </div>
      {picking && <NewChatDialog onPick={(p: ChatPerson) => openWith(p.id)} onClose={() => setPicking(false)} busy={opening} />}
    </div>
  );
}
