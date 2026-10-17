"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Check, History, Loader2, MessageSquarePlus, Paperclip, Pencil, Sparkles, X } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isManager } from "@/lib/auth";
import { Markdown } from "./Markdown";

// The AI assistant: a chat panel for the Group Owner and Business CEOs. Answers stream in;
// tasks it prepares appear as summary cards and are only saved when Confirm is pressed.

type Conversation = { id: string; title: string; lastMessageAt: string };
type SummaryLine = { label: string; value: string; before?: string };
type Draft = {
  id: string;
  action: keyof typeof CARD;
  status: "COLLECTING" | "READY" | "CONFIRMING" | "CONFIRMED" | "CANCELLED" | "EXPIRED" | "FAILED";
  summary: SummaryLine[];
  resultLink: string | null;
  error: string | null;
};
type Msg = { id: string; role: "user" | "assistant"; content: string; draftIds: string[]; pending?: boolean; activity?: string; error?: string };
type Thread = { conversation: Conversation; messages: Msg[]; drafts: Draft[] };
type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool"; name: string; label: string }
  | { type: "draft"; draft: Draft }
  | { type: "done"; messageId: string | null; title: string }
  | { type: "error"; message: string };

const STARTERS = [
  "What needs my attention today?",
  "Top 5 things to do this week",
  "Where are the gaps in our data?",
  "Which deals are falling behind?",
  "How are we doing vs last month?",
  "Who is behind on their KPIs?",
  "Which compliance registrations expire soon?",
  "Suggest risks we should add to our register",
];

// Card title, the word shown once confirmed, and the link text for each kind of draft.
const CARD = {
  CREATE_TASK: { title: "New task", done: "Created", open: "Open the task" },
  UPDATE_TASK: { title: "Change to task", done: "Updated", open: "Open the task" },
  CREATE_TASKS: { title: "New tasks", done: "Created", open: "Open tasks" },
  CREATE_DEAL: { title: "New deal", done: "Created", open: "Open the deal" },
  UPDATE_DEAL: { title: "Change to deal", done: "Updated", open: "Open the deal" },
  CREATE_CLIENT: { title: "New client", done: "Added", open: "Open the client" },
  ADD_CLIENT_NOTE: { title: "Client note", done: "Saved", open: "Open the client" },
  SCHEDULE_FOLLOW_UP: { title: "Follow-up", done: "Scheduled", open: "Open it" },
  UPSERT_COMPLIANCE: { title: "Compliance record", done: "Saved (unverified)", open: "Open compliance" },
  CREATE_COMPLIANCE_OPPORTUNITY: { title: "Compliance opportunity", done: "In the pipeline", open: "Open the deal" },
  UPSERT_RISK: { title: "Risk", done: "Saved", open: "Open the register" },
  UPSERT_CONTACT: { title: "Contact", done: "Saved", open: "Open the contact" },
} as const;

const ACTIVE_KEY = "assistant.activeConversation";

function readActive(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}
function writeActive(id: string | null) {
  try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch { /* storage unavailable */ }
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// Opens the assistant from anywhere (e.g. the sidebar's "Ask Trunqo" button).
const OPEN_EVENT = "assistant:open";
export function openAssistant() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function AssistantLauncher() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Keyboard shortcut: Ctrl/Cmd + K toggles the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_EVENT, onOpen); };
  }, []);

  if (!isManager(user)) return null;
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask Trunqo"
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-background shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <Sparkles size={16} className="text-accent" />
          <span className="hidden sm:inline">Ask Trunqo</span>
        </button>
      )}
      {open && <AssistantPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function AssistantPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const pathname = usePathname();
  const [activeId, setActiveId] = useState<string | null>(() => readActive());
  const [messages, setMessages] = useState<Msg[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstPath = useRef(pathname);
  // A conversation this panel just created already has its messages on screen — don't reload it.
  const justCreated = useRef<string | null>(null);

  const status = useQuery<{ enabled: boolean }>({ queryKey: ["assistant", "status"], queryFn: () => fetcher("/assistant/status") });
  const conversations = useQuery<Conversation[]>({ queryKey: ["assistant", "conversations"], queryFn: () => fetcher("/assistant/conversations") });

  // Close on Escape; close on mobile after following a link.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (pathname !== firstPath.current && window.innerWidth < 768) onClose();
  }, [pathname, onClose]);

  // Load the active conversation.
  useEffect(() => {
    if (!activeId) { setMessages([]); setDrafts({}); return; }
    if (justCreated.current === activeId) return;
    let cancelled = false;
    setLoadingThread(true);
    fetcher(`/assistant/conversations/${activeId}`)
      .then((t: Thread) => {
        if (cancelled) return;
        setMessages(t.messages);
        setDrafts(Object.fromEntries(t.drafts.map((d) => [d.id, d])));
      })
      .catch(() => { if (!cancelled) { setActiveId(null); writeActive(null); } })
      .finally(() => { if (!cancelled) setLoadingThread(false); });
    return () => { cancelled = true; };
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, drafts]);

  useEffect(() => { inputRef.current?.focus(); }, [activeId]);

  const selectConversation = (id: string | null) => {
    justCreated.current = null;
    setActiveId(id);
    writeActive(id);
    setShowHistory(false);
  };

  const patchLast = useCallback((fn: (m: Msg) => Msg) => {
    setMessages((ms) => ms.map((m, i) => (i === ms.length - 1 ? fn(m) : m)));
  }, []);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setInput("");
    setMessages((ms) => [
      ...ms,
      { id: `u${Date.now()}`, role: "user", content, draftIds: [] },
      { id: `a${Date.now()}`, role: "assistant", content: "", draftIds: [], pending: true, activity: "Thinking" },
    ]);
    let id = activeId;
    try {
      if (!id) {
        const { data } = await api.post<Conversation>("/assistant/conversations");
        id = data.id;
        justCreated.current = id;
        setActiveId(id);
        writeActive(id);
      }

      const res = await fetch(`${api.defaults.baseURL}/assistant/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: String(api.defaults.headers.common["Authorization"] ?? "") },
        body: JSON.stringify({ content }),
      });
      if (!res.ok || !res.body || !res.headers.get("content-type")?.includes("text/event-stream")) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "The assistant couldn't answer just now.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const e = JSON.parse(part.slice(6)) as StreamEvent;
          if (e.type === "delta") patchLast((m) => ({ ...m, content: m.content + e.text, activity: undefined }));
          else if (e.type === "tool") patchLast((m) => ({ ...m, activity: e.label }));
          else if (e.type === "draft") {
            setDrafts((d) => ({ ...d, [e.draft.id]: e.draft }));
            patchLast((m) => ({ ...m, draftIds: m.draftIds.includes(e.draft.id) ? m.draftIds : [...m.draftIds, e.draft.id] }));
          } else if (e.type === "error") patchLast((m) => ({ ...m, error: e.message }));
          else if (e.type === "done") qc.invalidateQueries({ queryKey: ["assistant", "conversations"] });
        }
      }
    } catch (err) {
      patchLast((m) => (m.role === "assistant" ? { ...m, error: err instanceof Error ? err.message : "Something went wrong." } : m));
    } finally {
      patchLast((m) => ({ ...m, pending: false, activity: undefined, content: m.content.trim() }));
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  // A certificate (PDF or photo): the server reads it and starts an unverified compliance card.
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadCertificate = async (file: File) => {
    if (busy) return;
    setBusy(true);
    setMessages((ms) => [
      ...ms,
      { id: `u${Date.now()}`, role: "user", content: `Uploaded a certificate: ${file.name}`, draftIds: [] },
      { id: `a${Date.now()}`, role: "assistant", content: "", draftIds: [], pending: true, activity: "Reading the document" },
    ]);
    try {
      let id = activeId;
      if (!id) {
        const { data } = await api.post<Conversation>("/assistant/conversations");
        id = data.id;
        justCreated.current = id;
        setActiveId(id);
        writeActive(id);
      }
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<{ messages: { id: string; content: string; draftIds: string[] }[]; drafts: Draft[] }>(`/assistant/conversations/${id}/certificate`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setDrafts((d) => ({ ...d, ...Object.fromEntries(data.drafts.map((x) => [x.id, x])) }));
      const reply = data.messages[data.messages.length - 1];
      patchLast((m) => ({ ...m, content: reply?.content ?? "", draftIds: reply?.draftIds ?? [] }));
      qc.invalidateQueries({ queryKey: ["assistant", "conversations"] });
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Couldn't read that file.";
      patchLast((m) => ({ ...m, error: msg }));
    } finally {
      patchLast((m) => ({ ...m, pending: false, activity: undefined }));
      setBusy(false);
    }
  };

  const actOnDraft = async (draft: Draft, action: "confirm" | "cancel") => {
    setDrafts((d) => ({ ...d, [draft.id]: { ...draft, status: action === "confirm" ? "CONFIRMING" : draft.status } }));
    try {
      const { data } = await api.post<{ draft: Draft; message?: string }>(`/assistant/drafts/${draft.id}/${action}`);
      setDrafts((d) => ({ ...d, [draft.id]: data.draft }));
      if (action === "confirm") {
        for (const k of ["tasks", "alerts", "compliance", "risks", "contacts", "sme", "bapx", "tradeline", "company-deals"]) qc.invalidateQueries({ queryKey: [k] });
      }
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "That didn't work. Try again.";
      setDrafts((d) => ({ ...d, [draft.id]: { ...draft, status: msg.includes("Already") ? "CONFIRMED" : draft.status, error: msg } }));
    }
  };

  const editDraft = () => {
    setInput("Change ");
    inputRef.current?.focus();
  };

  // Each card shows once: on the latest reply that mentions it.
  const lastIndexFor: Record<string, number> = {};
  messages.forEach((m, i) => m.draftIds.forEach((id) => { lastIndexFor[id] = i; }));

  const enabled = status.data?.enabled !== false;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={onClose} />
      <aside
        role="dialog"
        aria-label="Assistant"
        className="fixed inset-0 z-50 flex flex-col bg-background md:inset-y-0 md:left-auto md:right-0 md:w-[440px] md:border-l md:border-border md:shadow-2xl md:shadow-black/10"
      >
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent"><Sparkles size={15} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Assistant</p>
            <p className="truncate text-[11px] text-muted">
              {conversations.data?.find((c) => c.id === activeId)?.title ?? "Ask about the business, or ask it to do something"}
            </p>
          </div>
          <IconButton label="Past conversations" onClick={() => setShowHistory((s) => !s)} active={showHistory}><History size={17} /></IconButton>
          <IconButton label="New conversation" onClick={() => selectConversation(null)}><MessageSquarePlus size={17} /></IconButton>
          <IconButton label="Close" onClick={onClose}><X size={18} /></IconButton>
        </header>

        {showHistory ? (
          <div className="flex-1 overflow-y-auto p-3">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Past conversations</p>
            {conversations.data?.length ? (
              <ul className="space-y-1">
                {conversations.data.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => selectConversation(c.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-surface ${c.id === activeId ? "bg-surface font-semibold" : ""}`}
                    >
                      <span className="truncate text-foreground">{c.title}</span>
                      <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.lastMessageAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2 text-sm text-muted">No conversations yet.</p>
            )}
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
            {loadingThread ? (
              <div className="flex justify-center py-10 text-muted"><Loader2 size={18} className="animate-spin" /></div>
            ) : messages.length === 0 ? (
              <EmptyState enabled={enabled} onPick={send} />
            ) : (
              <div className="space-y-5">
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-background">{m.content}</p>
                    </div>
                  ) : (
                    <div key={m.id} className="space-y-3 text-sm leading-relaxed text-foreground/90">
                      {m.content && <Markdown text={m.content} onNavigate={() => window.innerWidth < 768 && onClose()} />}
                      {m.pending && (
                        <p className="flex items-center gap-2 text-xs text-muted">
                          <Loader2 size={13} className="animate-spin" /> {m.activity ?? "Writing"}…
                        </p>
                      )}
                      {m.draftIds.filter((id) => lastIndexFor[id] === i && drafts[id]).map((id) => (
                        <DraftCard key={id} draft={drafts[id]} onConfirm={() => actOnDraft(drafts[id], "confirm")} onCancel={() => actOnDraft(drafts[id], "cancel")} onEdit={editDraft} />
                      ))}
                      {m.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{m.error}</p>}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="shrink-0 border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface px-3 py-2 focus-within:border-accent/60">
            <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadCertificate(f); }} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy || !enabled}
              aria-label="Attach a certificate"
              title="Attach a GRA, FDA, GSA, EPA or ORC certificate"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-background hover:text-foreground disabled:opacity-40"
            >
              <Paperclip size={16} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              maxLength={2000}
              disabled={!enabled}
              placeholder={enabled ? "Ask, or say “Create a task for…”" : "The assistant isn't set up yet"}
              className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-muted [field-sizing:content]"
            />
            <button
              type="submit"
              disabled={busy || !input.trim() || !enabled}
              aria-label="Send"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} strokeWidth={2.5} />}
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[10.5px] text-muted">Answers come from your live data. Nothing is saved until you press Confirm.</p>
        </form>
      </aside>
    </>
  );
}

function IconButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-foreground ${active ? "bg-surface text-foreground" : ""}`}
    >
      {children}
    </button>
  );
}

function EmptyState({ enabled, onPick }: { enabled: boolean; onPick: (q: string) => void }) {
  return (
    <div className="space-y-5 pt-4">
      <div>
        <p className="text-xl font-semibold tracking-tight text-foreground">What do you want to know?</p>
        <p className="mt-1 text-sm text-muted">Ask about deals, data gaps, KPIs or tasks — or ask it to create or change a task. You confirm before anything is saved.</p>
      </div>
      {!enabled ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">The assistant isn&apos;t set up yet. Add an OpenAI API key on the server to turn it on.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-[13px] text-foreground transition hover:border-accent/50 hover:text-accent"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_NOTE: Partial<Record<Draft["status"], string>> = {
  CANCELLED: "Cancelled — nothing was saved.",
  EXPIRED: "This draft expired. Ask again to start over.",
  FAILED: "This didn't go through.",
};

function DraftCard({ draft, onConfirm, onCancel, onEdit }: { draft: Draft; onConfirm: () => void; onCancel: () => void; onEdit: () => void }) {
  const done = draft.status === "CONFIRMED";
  const working = draft.status === "CONFIRMING";
  const open = draft.status === "READY" || working;
  const card = CARD[draft.action] ?? { title: "Action", done: "Done", open: "Open it" };
  return (
    <div className={`overflow-hidden rounded-2xl border bg-surface ${done ? "border-emerald-300" : "border-border"}`}>
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{card.title}{draft.action === "CREATE_TASKS" ? ` (${draft.summary.length})` : ""}</p>
        {done && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check size={13} strokeWidth={3} /> {card.done}</span>}
        {open && <span className="text-[11px] text-muted">Check, then confirm</span>}
      </div>
      <dl className="divide-y divide-border/60 px-4">
        {draft.summary.map((l, i) => (
          <div key={`${i}-${l.label}`} className="grid grid-cols-[96px_1fr] gap-3 py-2 text-[13px]">
            <dt className="text-muted">{l.label}</dt>
            <dd className="min-w-0 break-words text-foreground">
              {l.before !== undefined && <span className="mr-1.5 text-muted line-through decoration-muted/60">{l.before}</span>}
              <span className={l.before !== undefined ? "font-semibold" : ""}>{l.value}</span>
            </dd>
          </div>
        ))}
      </dl>
      {draft.error && <p className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{draft.error}</p>}
      {open ? (
        <div className="flex items-center gap-2 border-t border-border/70 px-4 py-3">
          <button onClick={onConfirm} disabled={working} className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60">
            {working ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />} Confirm
          </button>
          <button onClick={onEdit} disabled={working} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-foreground transition hover:bg-background disabled:opacity-60">
            <Pencil size={13} /> Edit
          </button>
          <button onClick={onCancel} disabled={working} className="ml-auto rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition hover:text-foreground disabled:opacity-60">
            Cancel
          </button>
        </div>
      ) : done && draft.resultLink ? (
        <div className="border-t border-border/70 px-4 py-2.5">
          <a href={draft.resultLink} className="text-[13px] font-semibold text-accent hover:underline">{card.open} →</a>
        </div>
      ) : STATUS_NOTE[draft.status] ? (
        <p className="border-t border-border/70 px-4 py-2.5 text-xs text-muted">{STATUS_NOTE[draft.status]}</p>
      ) : null}
    </div>
  );
}
