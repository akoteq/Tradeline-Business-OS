"use client";

/**
 * Ask Tranqo — a scope-aware chat drawer over the group/company data.
 *
 * ARCHITECTURE NOTE (read before wiring the backend):
 * This component never asks a model to *know* a number. Every request
 * sends a `scope` (group-wide, or a specific company) and the backend is
 * expected to answer via tool-calling against the same endpoints your
 * dashboards already call — /dashboard/executive, /dashboard/company/:key,
 * /alerts — using the signed-in user's own session. That gets you two
 * things for free, matching your existing guardrails:
 *   1. Financial accuracy stays deterministic (FR-16–18's guardrail) —
 *      the model quotes numbers a real endpoint returned, never invents.
 *   2. Role scoping (FR-1, FR-2) is inherited, not reimplemented — a
 *      Staff session's tool calls simply can't reach another business's
 *      data, because the underlying endpoint already enforces that.
 *
 * This file only needs one endpoint to be real:
 *   POST /assistant/chat
 *   body: { message: string; scope: Scope; history: ChatMessage[] }
 *   returns: { reply: string; citedFrom?: string[] }
 * `citedFrom` is optional — if your backend can report which endpoints it
 * called to answer (e.g. ["dashboard/executive", "alerts"]), the drawer
 * shows that as a small trust signal under the reply. Leave it out and
 * that line just doesn't render.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Sparkles, Building2, Layers } from "lucide-react";
import { fetcher } from "@/lib/api";

export type Scope =
  | { level: "group" }
  | { level: "company"; companyKey: string; companyName: string };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citedFrom?: string[];
};

function scopeLabel(scope: Scope) {
  return scope.level === "group" ? "the whole group" : scope.companyName;
}

function suggestedPrompts(scope: Scope): string[] {
  if (scope.level === "group") {
    return [
      "Which companies need attention this week?",
      "Who's been quiet on deals the longest?",
      "How's outstanding revenue trending across the group?",
    ];
  }
  return [
    `How is ${scope.companyName} doing this month?`,
    "What's driving the outstanding balance?",
    "Which deals are at risk right now?",
  ];
}

// ---- Sidebar trigger --------------------------------------------------
// A featured card, not a plain nav row — this is a flagship entry point,
// so it gets an accent-tinted treatment and a live scope hint instead of
// blending into the rest of the list. Pin it above the scrollable nav in
// the sidebar so it's never scrolled out of view.

export function AskTranqoTrigger({ onClick, scopeHint }: { onClick: () => void; scopeHint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-accent/20 bg-accent/[0.06] px-3 py-2.5 text-left transition-colors hover:bg-accent/[0.12]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
        <Sparkles size={15} strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">Ask Tranqo</span>
        {scopeHint && <span className="block truncate text-[11px] text-muted">{scopeHint}</span>}
      </span>
    </button>
  );
}

// ---- Floating launcher --------------------------------------------------
// Optional — reachable from anywhere without a sidebar click. Coexists
// fine with the sidebar trigger; both just call the same setAskOpen(true).

export function AskTranqoFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ask Tranqo"
      className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105 md:hidden"
    >
      <MessageCircle size={20} />
    </button>
  );
}

// ---- Drawer -------------------------------------------------------------

export function TranqoAssistant({
  scope,
  open,
  onClose,
}: {
  scope: Scope;
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  // Fresh conversation whenever the scope changes — asking about Finance
  // Factory shouldn't carry context from a group-wide question, and vice
  // versa. If you want cross-scope memory later, key this off something
  // broader than `scope` instead of resetting here.
  useEffect(() => {
    setMessages([]);
  }, [scope.level, scope.level === "company" ? scope.companyKey : null]);

  // Close on Escape, lock background scroll while the drawer is open (it's
  // full-width on mobile), and land focus in the input so typing works
  // immediately instead of requiring an extra tap.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 320);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetcher<{ reply: string; citedFrom?: string[] }>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({
          message: trimmed,
          scope,
          history: messages.map(({ role, content }) => ({ role, content })),
        }),
      });
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: res.reply, citedFrom: res.citedFrom },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Couldn't reach the numbers just now — try again in a moment.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px]"
            aria-hidden
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Ask Tranqo"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Sparkles size={14} strokeWidth={2.25} />
                </span>
                <div>
                  <p className="text-sm font-semibold tracking-tight text-foreground">Ask Tranqo</p>
                  <p className="flex items-center gap-1 text-[11px] text-muted">
                    {scope.level === "company" ? <Building2 size={10} /> : <Layers size={10} />}
                    Scoped to {scopeLabel(scope)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-muted">
                    Ask about deals, outstanding revenue, silent accounts, or anything else in{" "}
                    {scopeLabel(scope)}&apos;s numbers.
                  </p>
                  <div className="space-y-2">
                    {suggestedPrompts(scope).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => send(p)}
                        className="block w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left text-sm text-foreground transition-colors hover:border-accent/30 hover:bg-accent/[0.05]"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-accent text-accent-foreground"
                        : "border border-border bg-surface text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.citedFrom && m.citedFrom.length > 0 && (
                      <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted">
                        From {m.citedFrom.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
                        style={{ animationDelay: `${i * 0.12}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2 border-t border-border p-4"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about ${scopeLabel(scope)}…`}
                className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                aria-label="Send"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---- Usage sketch ---------------------------------------------------------
//
// In Sidebar, the trigger now lives pinned above the scrollable nav (see
// Sidebar.tsx) — scope is computed per role there:
//
//   Group Owner: group-wide by default, auto-scopes to a company when
//   you're already sitting on that company's dashboard page.
//
//   Business CEO / Staff: always scoped to their own company, since their
//   `companies` list is already backend-scoped to just that one business.
//
// AskTranqoFab is optional — a mobile-only floating launcher, in case you
// want Tranqo reachable without opening the sidebar drawer first. Both
// entry points call the same setAskOpen(true), so they coexist safely.