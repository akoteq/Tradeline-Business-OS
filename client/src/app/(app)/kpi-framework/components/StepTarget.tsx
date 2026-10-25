"use client";

import type { KpiFormCtx } from "./types";
import { Chips, Label, inputClass } from "./fields";
import { FREQ_WORD, ShareHint } from "@/components/kpi";
import { Milestones } from "./Milestones";

const EVERY: Record<string, string> = { WEEKLY: "Every week", MONTHLY: "Every month", QUARTERLY: "Every quarter", ANNUAL: "Every year" };
const UNIT_ADORN: Record<string, { pre?: string; post?: string }> = {
  CURRENCY: { pre: "GHS" }, PERCENT: { post: "%" }, DAYS: { post: "days" }, HOURS: { post: "hours" }, SCORE: { post: "/ 100" },
};

export function StepTarget({ ctx }: { ctx: KpiFormCtx }) {
  const { form, set, isEdit, parent, freqOpts, periodLabel, parentRange, setTarget } = ctx;
  const adorn = UNIT_ADORN[form.unit] ?? {};

  // Older KPIs that were set up with fixed dates keep their date fields.
  if (form.windowed) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Starts</Label><input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputClass} /></div>
          <div><Label>Ends</Label><input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={inputClass} /></div>
          <div><Label>Target</Label><input type="number" value={form.targetValue} onChange={(e) => set("targetValue", e.target.value)} className={inputClass} placeholder="e.g. 5000000" /></div>
          <div><Label hint="(optional)">Starting value</Label><input type="number" value={form.startValue} onChange={(e) => set("startValue", e.target.value)} className={inputClass} /></div>
        </div>
        {parentRange && <p className="text-xs text-muted">Keep these dates within {parentRange}, the bigger KPI's range.</p>}
        <Milestones value={form.milestones} onChange={(m) => set("milestones", m)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Label>How often do you want to hit it?</Label>
        <Chips
          label="Frequency" value={form.frequency} onChange={ctx.pickFrequency}
          options={freqOpts.map((f) => [f, EVERY[f] ?? f] as [string, string])}
        />
      </div>

      <div>
        <Label>Your target for {periodLabel}</Label>
        <div className="flex items-baseline gap-2 border-b-2 border-border focus-within:border-accent transition-colors pb-1">
          {adorn.pre && <span className="text-sm text-muted">{adorn.pre}</span>}
          <input
            autoFocus type="number" inputMode="decimal" value={form.periodTarget}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={isEdit ? "Leave blank to keep it" : "0"}
            className="w-full bg-transparent font-serif text-4xl text-foreground tabular-nums placeholder:text-muted/40 focus:outline-none"
          />
          {adorn.post && <span className="text-sm text-muted whitespace-nowrap">{adorn.post}</span>}
        </div>
        <ShareHint parent={parent} frequency={form.frequency} onUse={(v) => setTarget(String(v))} />
        <p className="text-xs text-muted mt-2">
          Stays the same every {FREQ_WORD[form.frequency] ?? "period"} until you change it.
        </p>
      </div>
    </div>
  );
}
