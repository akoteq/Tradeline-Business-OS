"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { ErrorNote, btnGhost, btnPrimary, btnSecondary } from "./fields";

export type WizardStep = { title: string; subtitle: string; nudge: string };

// Step position, direction (for the slide) and how far the person has got (progress segments
// up to that point stay clickable).
export function useWizard(count: number, startReached = 0) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [reached, setReached] = useState(startReached);
  const go = (to: number) => {
    const t = Math.max(0, Math.min(count - 1, to));
    setDir(t > step ? 1 : -1); setStep(t); setReached((r) => Math.max(r, t));
  };
  return { step, dir, reached, go, last: step === count - 1 };
}

// Bottom sheet on phones, centred dialog from sm up.
export function WizardShell({ steps, step, dir, reached, onGo, onClose, primary, error, children }: {
  steps: readonly WizardStep[]; step: number; dir: number; reached: number;
  onGo: (to: number) => void; onClose: () => void;
  primary: { label: string; disabled?: boolean; onClick: () => void };
  error?: string; children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const meta = steps[step];
  const slide = reduce ? 0 : 24;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={meta.title} onClick={(e) => e.stopPropagation()}
        className="bg-surface shadow-xl border border-border w-full max-w-md max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl"
      >
        <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{meta.title}</h2>
            <p className="text-xs text-muted mt-0.5">{meta.subtitle}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors shrink-0" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div>
            <div className="flex gap-1.5" role="list" aria-label="Progress">
              {steps.map((s, i) => (
                <button
                  key={s.title} type="button" role="listitem" disabled={i > reached || i === step}
                  onClick={() => onGo(i)} aria-label={`Step ${i + 1}`} aria-current={i === step ? "step" : undefined}
                  className="group flex-1 py-1.5 disabled:cursor-default"
                >
                  <span className={clsx("block h-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-foreground/10 group-enabled:group-hover:bg-foreground/20")} />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-1">{step + 1} of {steps.length} · {meta.nudge}</p>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: dir * slide }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -dir * slide }} transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>

          <ErrorNote message={error} />
        </div>

        <div className="px-4 py-3 border-t border-border flex flex-wrap justify-end gap-2 shrink-0">
          {step === 0
            ? <button onClick={onClose} className={btnSecondary}>Cancel</button>
            : <button onClick={() => onGo(step - 1)} className={btnGhost}>Back</button>}
          <button onClick={primary.onClick} disabled={primary.disabled} className={btnPrimary}>{primary.label}</button>
        </div>
      </div>
    </div>
  );
}
