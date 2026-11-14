"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AtSign, Bell, CheckCheck, Loader2, X } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { toast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { useSocketEvent } from "@/components/RealtimeProvider";
import { DEEP_LINK_EVENT, type EntityType } from "@/lib/mentions";
import { timeAgo } from "@/components/comments/time";

/**
 * The bell (docs/mentions/README.md, flow 3): an unread badge, a panel listing mentions, and
 * clicking one opens the item scrolled to the comment and marks it read. Counts arrive live over
 * the socket; without it they refresh when the tab regains focus.
 */

export type AppNotification = {
  id: string;
  type: "MENTION";
  actorName: string | null;
  entityType: EntityType;
  entityId: string;
  entityTitle: string | null;
  commentId: string | null;
  excerpt: string | null;
  link: string | null;
  readAt: string | null;
  commentDeleted: boolean;
  createdAt: string;
};

const COUNT_KEY = ["notifications", "count"];
const LIST_KEY = ["notifications", "inbox"];
const NOUN: Record<EntityType, string> = { TASK: "task", LEAD: "lead", PROJECT: "project", KPI: "KPI" };

export function useUnreadCount() {
  const { user } = useAuth();
  const { data } = useQuery<{ unread: number }>({
    queryKey: COUNT_KEY,
    queryFn: () => fetcher("/notifications/inbox/unread-count"),
    enabled: !!user,
    refetchOnWindowFocus: true,
    // A slow fallback in case the socket is down; live events keep it current otherwise.
    refetchInterval: 120_000,
  });
  return data?.unread ?? 0;
}

/** Goes to an app link, and tells the page if it's the one already open (see lib/mentions.ts). */
export function useOpenLink() {
  const router = useRouter();
  return (link: string) => {
    router.push(link);
    for (const ms of [60, 300]) setTimeout(() => window.dispatchEvent(new Event(DEEP_LINK_EVENT)), ms);
  };
}

const headline = (n: AppNotification) =>
  `${n.actorName ?? "Someone"} mentioned you ${n.commentId ? "on" : "in"} ${n.entityTitle ?? `a ${NOUN[n.entityType]}`}`;

/** Mount once (AppShell): keeps the count and list fresh from the socket and toasts new mentions. */
export function NotificationsListener() {
  const qc = useQueryClient();
  const open = useOpenLink();
  useSocketEvent<{ notification: AppNotification; unread: number }>("notification:new", ({ notification, unread }) => {
    qc.setQueryData(COUNT_KEY, { unread });
    qc.invalidateQueries({ queryKey: LIST_KEY });
    toast.info(headline(notification), {
      description: notification.excerpt ?? undefined,
      action: notification.link ? { label: "Open", onClick: () => open(notification.link!) } : undefined,
    });
  });
  useSocketEvent<{ unread: number }>("notification:count", ({ unread }) => {
    qc.setQueryData(COUNT_KEY, { unread });
    qc.invalidateQueries({ queryKey: LIST_KEY });
  });
  return null;
}

/** The bell button. `variant="row"` is the sidebar row; "icon" is the compact header button. */
export function NotificationBell({ onOpen, variant = "icon", rail = false, className }: {
  onOpen: () => void; variant?: "icon" | "row"; rail?: boolean; className?: string;
}) {
  const unread = useUnreadCount();
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";
  const badge = unread > 0 && (
    <span className="min-w-[18px] rounded-full bg-accent px-1.5 text-center text-[11px] font-semibold leading-[18px] text-accent-foreground tabular-nums">
      {unread > 99 ? "99+" : unread}
    </span>
  );
  if (variant === "row") {
    return (
      <button
        onClick={onOpen} aria-label={label} title={rail ? label : undefined}
        className={clsx("relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-muted hover:bg-foreground/[0.05] hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30", className)}
      >
        <Bell size={15} strokeWidth={1.75} className="shrink-0" />
        <span className={clsx("flex-1 text-left whitespace-nowrap transition-opacity", rail && "md:opacity-0")}>Notifications</span>
        {rail ? unread > 0 && <span className="absolute left-6 top-1.5 h-2 w-2 rounded-full bg-accent" /> : badge}
      </button>
    );
  }
  return (
    <button
      onClick={onOpen} aria-label={label} title={label}
      className={clsx("relative p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors", className)}
    >
      <Bell size={20} />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5">{badge}</span>}
    </button>
  );
}

/** The slide-over list of notifications. */
export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const open = useOpenLink();
  const unread = useUnreadCount();
  const panelRef = useRef<HTMLDivElement>(null);
  const { data = [], isLoading, error } = useQuery<AppNotification[]>({
    queryKey: LIST_KEY,
    queryFn: () => fetcher("/notifications/inbox?limit=40"),
  });

  useEffect(() => {
    panelRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const refresh = () => { qc.invalidateQueries({ queryKey: LIST_KEY }); qc.invalidateQueries({ queryKey: COUNT_KEY }); };
  const readAll = useMutation({
    mutationFn: () => api.post("/notifications/inbox/read-all"),
    onSuccess: refresh,
    onError: (err) => toast.failed("Couldn't mark them read", err),
  });

  const click = (n: AppNotification) => {
    if (!n.readAt) {
      qc.setQueryData<AppNotification[]>(LIST_KEY, (list) => list?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      qc.setQueryData<{ unread: number }>(COUNT_KEY, (c) => ({ unread: Math.max(0, (c?.unread ?? 1) - 1) }));
      api.post(`/notifications/inbox/${n.id}/read`).catch(refresh);
    }
    if (n.link) {
      // A deleted comment can't be scrolled to: open the item itself.
      open(n.commentDeleted ? n.link.replace(/[?&]comment=[^&]+/, "") : n.link);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-primary/30 backdrop-blur-[1px]" onClick={onClose}>
      <div
        ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Notifications"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-sm flex-col border-l border-border bg-surface shadow-xl outline-none"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          <h2 className="font-serif text-lg text-foreground">Notifications</h2>
          {unread > 0 && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">{unread} new</span>}
          <div className="ml-auto flex items-center gap-1">
            {unread > 0 && (
              <button
                onClick={() => readAll.mutate()} disabled={readAll.isPending}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-foreground" aria-label="Close"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> Loading…</p>
          ) : error ? (
            <p className="px-4 py-6 text-sm text-red-600">Couldn&apos;t load notifications.</p>
          ) : data.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Bell size={22} className="mx-auto text-muted/60" />
              <p className="mt-2 text-sm font-medium text-foreground">Nothing yet</p>
              <p className="mt-1 text-xs text-muted">When someone @mentions you on a task, lead, project or KPI, it shows up here and in your email.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {data.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => click(n)}
                    className={clsx("flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.03]", !n.readAt && "bg-accent/[0.04]")}
                  >
                    <span className={clsx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", n.readAt ? "bg-foreground/5 text-muted" : "bg-accent/10 text-accent")}>
                      <AtSign size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={clsx("block text-sm leading-snug", n.readAt ? "text-foreground/80" : "font-medium text-foreground")}>{headline(n)}</span>
                      {n.commentDeleted
                        ? <span className="mt-0.5 block text-xs italic text-muted">Comment deleted</span>
                        : n.excerpt && <span className="mt-0.5 block truncate text-xs text-muted">{n.excerpt}</span>}
                      <span className="mt-1 block text-[11px] text-muted/80">{timeAgo(n.createdAt)} · {NOUN[n.entityType]}</span>
                    </span>
                    {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
