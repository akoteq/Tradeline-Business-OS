"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowLeft, Bell, BellOff, Download, FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { useCompanies } from "@/lib/companies";
import { chatKeys, chatStore, fileSize, isImage, type ChatAttachment, type ChatConversation, type ChatMessage, type MessagesPage } from "@/lib/chat";
import { ChatAvatar } from "./ChatAvatar";
import { Composer } from "./Composer";
import { markRead, patchConversation, upsertMessage } from "./chatCache";
import { useOnline, useTyping } from "./useChatStore";

/**
 * One open chat: who it's with (online / typing), the messages (scroll up for older ones), and
 * the box to write in. Opening it, and new messages arriving while it's on screen, mark it read.
 */

const dayLabel = (d: Date) => {
  const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });

// Plain text with web links made clickable.
function Linked({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1
        ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all">{p}</a>
        : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

function Files({ files, mine }: { files: ChatAttachment[]; mine: boolean }) {
  const images = files.filter(isImage), others = files.filter((f) => !isImage(f));
  return (
    <div className="space-y-1.5">
      {images.length > 0 && (
        <div className={clsx("grid gap-1.5", images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {images.map((f) => (
            <a key={f.publicId} href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
              <img src={f.url} alt={f.name} loading="lazy" className="max-h-60 w-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {others.map((f) => (
        <a
          key={f.publicId} href={f.url} target="_blank" rel="noopener noreferrer" download={f.name}
          className={clsx("flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs", mine ? "bg-white/15 hover:bg-white/20" : "bg-foreground/5 hover:bg-foreground/10")}
        >
          <FileText size={16} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{f.name}</span>
            {f.fileSize != null && <span className="block opacity-75">{fileSize(f.fileSize)}</span>}
          </span>
          <Download size={14} className="shrink-0 opacity-75" />
        </a>
      ))}
    </div>
  );
}

function Bubble({ m, mine, showTime, seen, onEdit, onDelete }: {
  m: ChatMessage; mine: boolean; showTime: boolean; seen: boolean; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className={clsx("group/msg flex items-end gap-1.5", mine ? "justify-end" : "justify-start")}>
      {mine && !m.deleted && (
        <span className="mb-1 flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/msg:opacity-100 sm:focus-within:opacity-100">
          <button onClick={onEdit} className="rounded p-1 text-muted hover:bg-foreground/5 hover:text-foreground" aria-label="Edit message" title="Edit"><Pencil size={13} /></button>
          <button onClick={onDelete} className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Delete message" title="Delete"><Trash2 size={13} /></button>
        </span>
      )}
      <div className={clsx("max-w-[80%] sm:max-w-[70%]", mine ? "items-end" : "items-start", "flex flex-col")}>
        <div
          id={`message-${m.id}`}
          className={clsx(
            "rounded-2xl px-3 py-2 text-sm leading-relaxed",
            m.deleted ? "border border-dashed border-border bg-transparent italic text-muted"
              : mine ? "bg-accent text-accent-foreground" : "border border-border bg-surface text-foreground",
            mine ? "rounded-br-md" : "rounded-bl-md",
          )}
        >
          {m.deleted ? "Message deleted" : (
            <div className="space-y-1.5">
              {m.attachments.length > 0 && <Files files={m.attachments} mine={mine} />}
              {m.body && <p className="whitespace-pre-wrap break-words"><Linked text={m.body} /></p>}
            </div>
          )}
        </div>
        {(showTime || seen) && (
          <span className="mt-0.5 px-1 text-[11px] text-muted">
            {clock(m.createdAt)}{m.editedAt && !m.deleted ? " · edited" : ""}{seen ? " · Seen" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export function ChatWindow({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const { user } = useAuth();
  const me = user?.id;
  const qc = useQueryClient();
  const { byKey } = useCompanies();

  const { data: conv, error: convError } = useQuery<ChatConversation>({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: () => fetcher(`/messages/conversations/${conversationId}`),
  });
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId),
    queryFn: ({ pageParam }): Promise<MessagesPage> => fetcher(`/messages/conversations/${conversationId}/messages?limit=30${pageParam ? `&before=${pageParam}` : ""}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.messages[0]?.id ?? null : null),
    // The socket keeps it current while open; refetch on return in case events were missed.
    staleTime: 0,
  });
  const messages = (data?.pages ?? []).slice().reverse().flatMap((p) => p.messages);
  const online = useOnline(conv?.other.id);
  const typing = useTyping(conversationId);

  // This chat is on screen: new messages here are marked read instead of toasted.
  useEffect(() => {
    chatStore.setActive(conversationId);
    return () => chatStore.setActive(null);
  }, [conversationId]);
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!conv) return;
    const read = () => { if (document.visibilityState === "visible") markRead(qc, conversationId); };
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, [conversationId, !!conv, lastId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrolling: start at the bottom; stay there as messages arrive (if you were near it); keep your
  // place when older messages load above.
  const scroller = useRef<HTMLDivElement>(null);
  const firstScroll = useRef<string | null>(null);
  const prevHeight = useRef<number | null>(null);
  const nearBottom = useRef(true);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !messages.length) return;
    if (firstScroll.current !== conversationId) { el.scrollTop = el.scrollHeight; firstScroll.current = conversationId; return; }
    if (prevHeight.current != null) { el.scrollTop += el.scrollHeight - prevHeight.current; prevHeight.current = null; return; }
    const last = messages[messages.length - 1];
    if (nearBottom.current || last?.senderUserId === me) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, lastId, conversationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 80 && hasNextPage && !isFetchingNextPage) {
      prevHeight.current = el.scrollHeight;
      fetchNextPage();
    }
  };

  const send = async (input: { body: string; attachments: ChatAttachment[] }) => {
    const r = await api.post<ChatMessage>(`/messages/conversations/${conversationId}/messages`, input);
    upsertMessage(qc, r.data);
    nearBottom.current = true;
  };

  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const r = await api.put<ChatMessage>(`/messages/messages/${editing.id}`, { body: editText.trim() });
      upsertMessage(qc, r.data);
      setEditing(null);
    } catch (err) {
      toast.failed("Couldn't save your changes", err);
    } finally { setSavingEdit(false); }
  };
  const remove = async (m: ChatMessage) => {
    const ok = await confirmAction({ title: "Delete this message?", body: "It will show as \"Message deleted\" for both of you. Any files in it are removed.", confirmLabel: "Delete message" });
    if (!ok) return;
    try { await api.delete(`/messages/messages/${m.id}`); upsertMessage(qc, { ...m, deleted: true, body: "", attachments: [], deletedAt: new Date().toISOString() }); }
    catch (err) { toast.failed("Couldn't delete the message", err); }
  };
  const toggleMute = async () => {
    if (!conv) return;
    try {
      const r = await api.post<{ muted: boolean }>(`/messages/conversations/${conversationId}/mute`, { muted: !conv.muted });
      patchConversation(qc, conversationId, { muted: r.data.muted });
      toast.success(r.data.muted ? "Chat muted" : "Chat unmuted", { description: r.data.muted ? "No pop-ups or emails for this chat." : undefined });
    } catch (err) { toast.failed("Couldn't change that", err); }
  };

  // "Seen" goes under your newest message the other person has read.
  const otherRead = conv?.otherLastReadAt ? new Date(conv.otherLastReadAt).getTime() : 0;
  const seenId = [...messages].reverse().find((m) => m.senderUserId === me && !m.deleted)?.id;
  const seenOk = (m: ChatMessage) => m.id === seenId && otherRead >= new Date(m.createdAt).getTime();

  const other = conv?.other;
  const company = other ? (other.role === "EXTERNAL" ? "Outside collaborator" : other.company ? (byKey[other.company]?.name ?? other.company) : "Group") : "";

  if (convError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted">This chat can&apos;t be opened.</p>
        <button onClick={onBack} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-foreground/5">Back to chats</button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-3 py-2.5 sm:px-4">
        <button onClick={onBack} className="rounded-lg p-1.5 text-muted hover:bg-foreground/5 hover:text-foreground md:hidden" aria-label="Back to chats"><ArrowLeft size={18} /></button>
        {other ? <ChatAvatar userId={other.id} name={other.name} size="sm" /> : <span className="h-8 w-8 rounded-full bg-foreground/10" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{other?.name ?? "…"}</p>
          <p className={clsx("truncate text-xs", typing ? "italic text-accent" : "text-muted")}>
            {typing ? "typing…" : online ? `Online · ${company}` : company}
          </p>
        </div>
        {conv && (
          <button
            onClick={toggleMute}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-foreground/5 hover:text-foreground"
            aria-label={conv.muted ? "Unmute chat" : "Mute chat"} title={conv.muted ? "Muted: no pop-ups or emails. Click to unmute." : "Mute: no pop-ups or emails for this chat"}
          >
            {conv.muted ? <BellOff size={17} /> : <Bell size={17} />}
          </button>
        )}
      </header>

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite">
        {isFetchingNextPage && <p className="flex justify-center py-2 text-xs text-muted"><Loader2 size={14} className="animate-spin" /></p>}
        {isLoading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> Loading messages…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-red-600">Couldn&apos;t load messages.</p>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            {other && <ChatAvatar userId={other.id} name={other.name} />}
            <p className="mt-3 text-sm font-medium text-foreground">Say hello to {other?.name ?? "them"}</p>
            <p className="mt-1 text-xs text-muted">Only the two of you can see this chat.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((m, i) => {
              const prev = messages[i - 1], next = messages[i + 1];
              const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
              // Time shows on the last of a run from the same person within 5 minutes.
              const showTime = !next || next.senderUserId !== m.senderUserId || new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() > 5 * 60_000;
              const mine = m.senderUserId === me;
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <div className="flex justify-center py-3">
                      <span className="rounded-full bg-foreground/5 px-3 py-0.5 text-[11px] font-medium text-muted">{dayLabel(new Date(m.createdAt))}</span>
                    </div>
                  )}
                  {editing?.id === m.id ? (
                    <div className="ml-auto max-w-[80%] space-y-2 sm:max-w-[70%]">
                      <textarea
                        autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} aria-label="Edit message"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditing(null);
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                        }}
                        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditing(null)} className="rounded-lg px-3 py-1 text-xs font-medium text-muted hover:bg-foreground/5">Cancel</button>
                        <button onClick={saveEdit} disabled={savingEdit || (!editText.trim() && !m.attachments.length)} className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground disabled:opacity-50">
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={clsx(showTime && "pb-1.5")}>
                      <Bubble
                        m={m} mine={mine} showTime={showTime} seen={seenOk(m)}
                        onEdit={() => { setEditing(m); setEditText(m.body); }} onDelete={() => remove(m)}
                      />
                    </div>
                  )}
                </Fragment>
              );
            })}
            {typing && (
              <div className="flex justify-start pt-1">
                <span className="rounded-2xl rounded-bl-md border border-border bg-surface px-3 py-2 text-xs italic text-muted">{other?.name.split(" ")[0] ?? "They"} is typing…</span>
              </div>
            )}
          </div>
        )}
      </div>

      <Composer
        conversationId={conversationId}
        onSend={send}
        disabledReason={conv && conv.canSend === false ? `You can't message ${other?.name ?? "this person"} any more. You can still read your chat.` : null}
      />
    </div>
  );
}
