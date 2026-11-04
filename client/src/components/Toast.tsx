"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { clsx } from "clsx";

/**
 * App-wide toasts. Call `toast.success("Task created")` from anywhere (components, mutations,
 * plain functions). <Toaster /> sits once in the AppShell and renders the stack.
 *
 *   toast.success(title, { description, action: { label: "Undo", onClick }, duration })
 *   toast.error(...)    stays until dismissed unless a duration is given
 *   toast.dismiss(id)
 *
 * The countdown is a CSS animation on the progress bar: it pauses while the pointer is over the
 * stack, and the toast closes when the animation ends, so there is no timer to keep in sync.
 */

type Kind = "success" | "error" | "info" | "warning";

type ToastOptions = {
  description?: string;
  action?: { label: string; onClick: () => void };
  /** Milliseconds on screen. `Infinity` keeps it until dismissed. */
  duration?: number;
};

type ToastItem = ToastOptions & { id: number; kind: Kind; title: string; duration: number };

const MAX_VISIBLE = 3;
const DEFAULT_DURATION: Record<Kind, number> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: Infinity,
};

/* ---- store ---- */

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(kind: Kind, title: string, opts: ToastOptions = {}) {
  const id = nextId++;
  items = [...items, { ...opts, id, kind, title, duration: opts.duration ?? DEFAULT_DURATION[kind] }].slice(-MAX_VISIBLE);
  emit();
  return id;
}

function dismiss(id?: number) {
  items = id === undefined ? [] : items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (title: string, opts?: ToastOptions) => push("success", title, opts),
  error: (title: string, opts?: ToastOptions) => push("error", title, opts),
  info: (title: string, opts?: ToastOptions) => push("info", title, opts),
  warning: (title: string, opts?: ToastOptions) => push("warning", title, opts),
  /** An error toast for a failed request: the server's message if it sent one, else "Please try again." */
  failed: (title: string, err?: unknown) => push("error", title, { description: serverMessage(err) ?? "Please try again." }),
  dismiss,
};

function serverMessage(err: unknown): string | undefined {
  const r = (err as { response?: { data?: { error?: unknown; message?: unknown } } } | undefined)?.response?.data;
  const m = r?.error ?? r?.message;
  return typeof m === "string" && m.trim() ? m : undefined;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => items;
const serverSnapshot = (): ToastItem[] => [];

/* ---- view ---- */

const KIND: Record<Kind, { icon: typeof Info; tone: string; bar: string }> = {
  success: { icon: CheckCircle2, tone: "text-emerald-400", bar: "bg-emerald-400" },
  error: { icon: XCircle, tone: "text-red-400", bar: "bg-red-400" },
  info: { icon: Info, tone: "text-sky-400", bar: "bg-sky-400" },
  warning: { icon: AlertTriangle, tone: "text-amber-400", bar: "bg-amber-400" },
};

export function Toaster() {
  const list = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const reduce = useReducedMotion();

  return (
    // Top on phones (clear of bottom sheets), bottom-centre on desktop (clear of the sidebar and Ask Trunqo).
    <div className="group/stack pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 sm:top-auto sm:bottom-5">
      <AnimatePresence initial={false}>
        {list.map((t) => {
          const { icon: Icon, tone, bar } = KIND[t.kind];
          const timed = Number.isFinite(t.duration);
          return (
            <motion.div
              key={t.id}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              role={t.kind === "error" ? "alert" : "status"}
              aria-live={t.kind === "error" ? "assertive" : "polite"}
              className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl bg-primary text-accent-foreground shadow-xl shadow-black/20 ring-1 ring-white/10"
            >
              <div className="flex items-start gap-3 py-3 pl-3.5 pr-2.5">
                <Icon size={18} className={clsx("mt-0.5 shrink-0", tone)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-xs text-white/60 leading-snug break-words">{t.description}</p>}
                </div>
                {t.action && (
                  <button
                    onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="shrink-0 rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <X size={14} />
                </button>
              </div>
              {timed && (
                <span
                  aria-hidden
                  onAnimationEnd={() => dismiss(t.id)}
                  style={{ animationDuration: `${t.duration}ms` }}
                  className={clsx("toast-timer absolute bottom-0 left-0 h-0.5 w-full origin-left opacity-70 group-hover/stack:[animation-play-state:paused]", bar)}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
