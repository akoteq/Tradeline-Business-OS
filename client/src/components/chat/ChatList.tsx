"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { BellOff, Loader2, PenSquare, Search } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useCompanies } from "@/lib/companies";
import type { ChatConversation } from "@/lib/chat";
import { ChatAvatar } from "./ChatAvatar";
import { useTyping } from "./useChatStore";

// "14:05" today, "Mon" this week, "12 Nov" otherwise.
export function listTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return d.toLocaleDateString("en-GH", { weekday: "short" });
  return d.toLocaleDateString("en-GH", { day: "numeric", month: "short" });
}

function Row({ c, active, onSelect }: { c: ChatConversation; active: boolean; onSelect: () => void }) {
  const { user } = useAuth();
  const { byKey } = useCompanies();
  const typing = useTyping(c.id);
  const mine = c.lastSenderId === user?.id;
  const company = c.other.company && c.other.company !== "EXTERNAL" ? (byKey[c.other.company]?.name ?? c.other.company) : c.other.role === "EXTERNAL" ? "Outside collaborator" : null;
  return (
    <li>
      <button
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={clsx(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
          active ? "bg-accent/10" : "hover:bg-foreground/[0.03]",
        )}
      >
        <ChatAvatar userId={c.other.id} name={c.other.name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={clsx("truncate text-sm", c.unread ? "font-semibold text-foreground" : "font-medium text-foreground")}>{c.other.name}</span>
            {c.muted && <BellOff size={12} className="shrink-0 text-muted" aria-label="Muted" />}
            <span className={clsx("ml-auto shrink-0 text-[11px]", c.unread ? "font-semibold text-accent" : "text-muted")}>{listTime(c.lastMessageAt)}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={clsx("truncate text-xs", typing ? "italic text-accent" : c.unread ? "text-foreground" : "text-muted")}>
              {typing ? "typing…" : c.lastPreview ? `${mine ? "You: " : ""}${c.lastPreview}` : company ?? "No messages yet"}
            </span>
            {c.unread > 0 && (
              <span className="ml-auto min-w-[18px] shrink-0 rounded-full bg-accent px-1.5 text-center text-[11px] font-semibold leading-[18px] text-accent-foreground tabular-nums">
                {c.unread > 99 ? "99+" : c.unread}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

export function ChatList({ conversations, loading, error, activeId, onSelect, onNew }: {
  conversations: ChatConversation[]; loading: boolean; error: boolean;
  activeId: string | null; onSelect: (id: string) => void; onNew: () => void;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle ? conversations.filter((c) => c.other.name.toLowerCase().includes(needle) || c.other.email.toLowerCase().includes(needle)) : conversations;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
        <h1 className="font-serif text-xl text-foreground">Messages</h1>
        <button
          onClick={onNew}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          <PenSquare size={14} /> New
        </button>
      </div>
      {conversations.length > 6 && (
        <div className="border-b border-border px-4 py-2">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
            <Search size={14} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a chat" aria-label="Find a chat" className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted/70" />
          </label>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> Loading chats…</p>
        ) : error ? (
          <p className="px-4 py-6 text-sm text-red-600">Couldn&apos;t load your chats.</p>
        ) : conversations.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No chats yet</p>
            <p className="mt-1 text-xs text-muted">Start one with anyone you work with.</p>
            <button onClick={onNew} className="mt-4 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-foreground/5">New message</button>
          </div>
        ) : shown.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No chat matches &ldquo;{q}&rdquo;.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {shown.map((c) => <Row key={c.id} c={c} active={c.id === activeId} onSelect={() => onSelect(c.id)} />)}
          </ul>
        )}
      </div>
    </div>
  );
}
