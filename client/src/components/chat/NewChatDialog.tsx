"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import type { ChatPerson } from "@/lib/chat";
import { ChatAvatar } from "./ChatAvatar";

/** Pick someone to message. Lists only people you're allowed to message (server rule). */
export function NewChatDialog({ onPick, onClose, busy }: { onPick: (p: ChatPerson) => void; onClose: () => void; busy?: string | null }) {
  const { byKey } = useCompanies();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 200); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const { data = [], isFetching, error } = useQuery<ChatPerson[]>({
    queryKey: ["chat", "contacts", term],
    queryFn: () => fetcher(`/messages/contacts?q=${encodeURIComponent(term)}`),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
  const where = (p: ChatPerson) => (p.role === "EXTERNAL" ? "Outside collaborator" : p.company ? (byKey[p.company]?.name ?? p.company) : "Group");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="New message"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl border border-border bg-surface shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-serif text-lg text-foreground">New message</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="border-b border-border px-5 py-3">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-accent/30">
            <Search size={15} className="text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search people" className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted/70" />
            {isFetching && <Loader2 size={14} className="animate-spin text-muted" />}
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {error ? (
            <p className="px-5 py-6 text-sm text-red-600">Couldn&apos;t load people.</p>
          ) : data.length === 0 && !isFetching ? (
            <p className="px-5 py-6 text-sm text-muted">{term ? `Nobody you can message matches "${term}".` : "There's nobody you can message yet."}</p>
          ) : (
            <ul>
              {data.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => onPick(p)} disabled={!!busy}
                    className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-foreground/[0.04] disabled:opacity-60"
                  >
                    <ChatAvatar userId={p.id} name={p.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
                      <span className="block truncate text-xs text-muted">{where(p)} · {p.email}</span>
                    </span>
                    {busy === p.id && <Loader2 size={14} className="animate-spin text-muted" />}
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
