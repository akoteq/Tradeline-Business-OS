"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { clsx } from "clsx";
import { KpiSheet } from "@/components/kpi";
import type { KpiFormCtx } from "./types";
import { ErrorNote, btnGhost, btnPrimary, btnSecondary } from "./fields";
import { StepBasics } from "./StepBasics";
import { StepTarget } from "./StepTarget";
import { StepDetails } from "./StepDetails";

const STEPS = [
  { title: "What do you want to track?", subtitle: "Name it and pick how it's measured.", nudge: "Let's start" },
  { title: "What's the goal?", subtitle: "How often, and how much?", nudge: "Halfway there" },
  { title: "Last step", subtitle: "Who owns it, and where the numbers come from.", nudge: "Almost done" },
] as const;

type Props = {
  ctx: Omit<KpiFormCtx, "setTarget">;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string;
};

export function AddKpiSheet({ ctx, onClose, onSave, saving, error }: Props) {
  const { form, set, isEdit } = ctx;
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [reached, setReached] = useState(isEdit ? STEPS.length - 1 : 0);
  const [autoDrafted, setAutoDrafted] = useState(false);

  const targetKey = form.windowed ? "targetValue" : "periodTarget";
  const hasTarget = String(form[targetKey]).trim() !== "";
  const last = step === STEPS.length - 1;

  // Typing a target undoes the draft we set when they skipped it.
  const setTarget = (v: string) => {
    set(targetKey, v);
    if (autoDrafted && v.trim() !== "") { set("state", "ACTIVE"); setAutoDrafted(false); }
  };

  const go = (to: number) => { setDir(to > step ? 1 : -1); setStep(to); setReached((r) => Math.max(r, to)); };

  const canContinue =
    step === 0 ? form.metric.trim() !== "" :
    step === 1 && form.windowed ? !!form.startDate && !!form.endDate :
    true;

  const next = () => {
    if (!canContinue) return;
    if (step === 1 && !isEdit && !hasTarget && form.state === "ACTIVE") { set("state", "DRAFT"); setAutoDrafted(true); }
    go(step + 1);
  };

  const saveDisabled = saving || !form.metric.trim() || (form.source === "AUTO" && !form.autoKey);
  const primaryLabel = last
    ? (saving ? "Saving…" : isEdit ? "Save changes" : form.state === "DRAFT" ? "Save draft" : "Add KPI")
    : step === 1 && !isEdit && !hasTarget && !form.windowed ? "Skip for now" : "Continue";

  const full: KpiFormCtx = { ...ctx, setTarget };
  const meta = STEPS[step];
  const slide = reduce ? 0 : 24;

  return (
    <KpiSheet
      onClose={onClose}
      title={meta.title}
      subtitle={meta.subtitle}
      footer={
        <>
          {step === 0 ? <button onClick={onClose} className={btnSecondary}>Cancel</button> : <button onClick={() => go(step - 1)} className={btnGhost}>Back</button>}
          <button onClick={last ? onSave : next} disabled={last ? saveDisabled : !canContinue} className={btnPrimary}>{primaryLabel}</button>
        </>
      }
    >
      <div>
        <div className="flex gap-1.5" role="list" aria-label="Progress">
          {STEPS.map((s, i) => (
            <button
              key={s.title} type="button" role="listitem" disabled={i > reached || i === step}
              onClick={() => go(i)} aria-label={`Step ${i + 1}`} aria-current={i === step ? "step" : undefined}
              className="group flex-1 py-1.5 disabled:cursor-default"
            >
              <span className={clsx("block h-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-foreground/10 group-enabled:group-hover:bg-foreground/20")} />
            </button>
          ))}
        </div>
        <p className="text-xs text-muted mt-1">{step + 1} of {STEPS.length} · {meta.nudge}</p>
      </div>

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={step} custom={dir}
          initial={{ opacity: 0, x: dir * slide }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -dir * slide }} transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {step === 0 && <StepBasics ctx={full} onEnter={next} />}
          {step === 1 && <StepTarget ctx={full} />}
          {step === 2 && <StepDetails ctx={full} />}
        </motion.div>
      </AnimatePresence>

      <ErrorNote message={error} />
    </KpiSheet>
  );
}
