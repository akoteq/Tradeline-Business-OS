"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Loader2, MessageSquare, Pencil, Send, Trash2 } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isManager } from "@/lib/auth";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { useSocket, useSocketEvent } from "@/components/RealtimeProvider";
import { MentionInput } from "@/components/mentions/MentionInput";
import { MentionText } from "@/components/mentions/MentionText";
import type { EntityType } from "@/lib/mentions";
import { timeAgo } from "./time";

/**
 * The comment thread on a task, lead, project or KPI (docs/mentions/README.md, flows 1, 4, 5).
 * Type @ to mention someone who can open the item; they get a bell notification and an email.
 * New, edited and deleted comments from other people appear live while the thread is open.
 */

export type Comment = {
  id: string;
  entityType: EntityType;
  entityId: string;
  body: string;
  authorUserId: string;
  author: { id: string; name: string };
  mentions: { id: string; name: string | null }[];
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};
export type Thread = { entity: { type: EntityType; id: string; title: string; path: string }; comments: Comment[] };

export const threadKey = (type: EntityType, id: string) => ["comments", type, id];

export function useThread(type: EntityType, id: string) {
  return useQuery<Thread>({ queryKey: threadKey(type, id), queryFn: () => fetcher(`/comments?entityType=${type}&entityId=${id}`) });
}

export function CommentThread({ entityType, entityId, focusCommentId, disabledReason, className }: {
  entityType: EntityType;
  entityId: string;
  /** Scroll to and briefly highlight this comment once it has loaded (from a notification). */
  focusCommentId?: string | null;
  /** When set, the box to write a comment is replaced by this note. */
  disabledReason?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = threadKey(entityType, entityId);
  const { data, isLoading, error } = useThread(entityType, entityId);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const source = { entityType, entityId };

  // Live: watch this thread while it's on screen, and again after a reconnect.
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    const watch = () => socket.emit("comments:watch", { entityType, entityId });
    watch();
    socket.on("connect", watch);
    return () => { socket.off("connect", watch); socket.emit("comments:unwatch", { entityType, entityId }); };
  }, [socket, entityType, entityId]);
  const onLive = (p: { comment?: { entityType: string; entityId: string } }) => {
    if (p?.comment?.entityType === entityType && p.comment.entityId === entityId) qc.invalidateQueries({ queryKey: key });
  };
  useSocketEvent("comment:created", onLive);
  useSocketEvent("comment:updated", onLive);
  useSocketEvent("comment:deleted", onLive);

  // From a notification: scroll the comment into view and flash it.
  const scrolled = useRef<string | null>(null);
  useEffect(() => {
    if (!focusCommentId || !data || scrolled.current === focusCommentId) return;
    scrolled.current = focusCommentId;
    const el = document.getElementById(`comment-${focusCommentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(focusCommentId);
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [focusCommentId, data]);

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const send = useMutation({
    mutationFn: (body: string) => api.post("/comments", { entityType, entityId, body }).then((r) => r.data as Comment),
    onSuccess: (c) => {
      setDraft("");
      qc.setQueryData<Thread>(key, (t) => (t && !t.comments.some((x) => x.id === c.id) ? { ...t, comments: [...t.comments, c] } : t));
      const told = c.mentions.filter((m) => m.id !== user?.id);
      if (told.length) toast.success(`Comment sent, ${told.length === 1 ? `${told[0].name ?? "1 person"} was` : `${told.length} people were`} notified`);
    },
    onError: (err) => toast.failed("Couldn't send your comment", err),
  });
  const save = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.put(`/comments/${id}`, { body }),
    onSuccess: () => { setEditing(null); refresh(); },
    onError: (err) => toast.failed("Couldn't save your changes", err),
  });
  const remove = async (c: Comment) => {
    const ok = await confirmAction({ title: "Delete this comment?", body: "It will show as deleted. People mentioned in it won't be told.", confirmLabel: "Delete comment" });
    if (!ok) return;
    try { await api.delete(`/comments/${c.id}`); refresh(); } catch (err) { toast.failed("Couldn't delete the comment", err); }
  };

  const submit = () => { if (draft.trim() && !send.isPending) send.mutate(draft.trim()); };
  // Live payloads leave these out; work them out the same way the server does.
  const canEdit = (c: Comment) => c.canEdit ?? (!c.deleted && c.authorUserId === user?.id);
  const canDelete = (c: Comment) => c.canDelete ?? (!c.deleted && (c.authorUserId === user?.id || isManager(user)));
  const comments = data?.comments ?? [];

  return (
    <div className={clsx("space-y-3", className)}>
      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> Loading comments…</p>
      ) : error ? (
        <p className="text-sm text-red-600">Couldn&apos;t load comments.</p>
      ) : comments.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
          <MessageSquare size={15} className="shrink-0" /> No comments yet. Type @ to bring someone in.
        </p>
      ) : (
        <ol className="space-y-2">
          {comments.map((c) => {
            const names = Object.fromEntries(c.mentions.map((m) => [m.id, m.name]));
            return (
              <li
                key={c.id}
                id={`comment-${c.id}`}
                className={clsx(
                  "group/comment flex gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-700",
                  flash === c.id ? "border-accent/50 bg-accent/10" : "border-border bg-background",
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-semibold text-foreground/70">
                  {c.author.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="text-sm font-medium text-foreground">{c.author.name}</span>
                    <time className="text-muted" dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString("en-GH")}>{timeAgo(c.createdAt)}</time>
                    {c.editedAt && !c.deleted && <span className="text-muted/70">edited</span>}
                    {(canEdit(c) || canDelete(c)) && editing !== c.id && (
                      <span className="ml-auto flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/comment:opacity-100 sm:focus-within:opacity-100">
                        {canEdit(c) && (
                          <button onClick={() => { setEditing(c.id); setEditDraft(c.body); }} className="rounded p-1 text-muted hover:bg-foreground/5 hover:text-foreground" aria-label="Edit comment" title="Edit">
                            <Pencil size={13} />
                          </button>
                        )}
                        {canDelete(c) && (
                          <button onClick={() => remove(c)} className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Delete comment" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                  {c.deleted ? (
                    <p className="mt-0.5 text-sm italic text-muted">Comment deleted</p>
                  ) : editing === c.id ? (
                    <div className="mt-1.5 space-y-2">
                      <MentionInput
                        value={editDraft} onChange={setEditDraft} source={source} rows={2} autoFocus aria-label="Edit comment"
                        onSubmit={() => editDraft.trim() && save.mutate({ id: c.id, body: editDraft.trim() })}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-foreground/5">Cancel</button>
                        <button
                          onClick={() => save.mutate({ id: c.id, body: editDraft.trim() })} disabled={!editDraft.trim() || save.isPending}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          {save.isPending ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <MentionText value={c.body} names={names} className="mt-0.5 block text-sm leading-relaxed text-foreground" />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {disabledReason ? (
        <p className="text-xs text-muted">{disabledReason}</p>
      ) : (
        <div className="space-y-2">
          <MentionInput
            value={draft} onChange={setDraft} source={source} rows={2} pickerPlacement="above" onSubmit={submit}
            placeholder="Write a comment. Type @ to mention someone." aria-label="Write a comment"
            disabled={!!error}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="hidden text-[11px] text-muted sm:inline">Ctrl + Enter to send</span>
            <button
              onClick={submit} disabled={!draft.trim() || send.isPending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {send.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
