"use client";

import type { KpiFormCtx } from "./types";
import { Chips, Label, inputClass } from "./fields";
import { FREQ_WORD, ShareHint } from "@/components/kpi";
import { Milestones } from "./Milestones";
import { DateRangePicker } from "./DateRangePicke";
import { CURRENCIES } from "@/lib/currency";

const EVERY: Record<string, string> = { WEEKLY: "Every week", MONTHLY: "Every month", QUARTERLY: "Every quarter", ANNUAL: "Every year" };
const UNIT_ADORN: Record<string, { post?: string }> = {
  PERCENT: { post: "%" }, DAYS: { post: "days" }, HOURS: { post: "hours" }, SCORE: { post: "/ 100" },
};

function CurrencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative shrink-0">
      <select
        value={value} onChange={(e) => onChange(e.target.value)} aria-label="Currency"
        className="appearance-none cursor-pointer rounded-md border border-border bg-subtle py-1 pl-2.5 pr-7 text-sm font-medium text-foreground hover:border-muted focus:outline-none focus-visible:border-accent"
      >
        {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
      </select>
      <svg
        aria-hidden viewBox="0 0 20 20"
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      >
        <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function TargetInput({ ctx, autoFocus }: { ctx: KpiFormCtx; autoFocus?: boolean }) {
  const { form, set, isEdit, setTarget } = ctx;
  const value = form.windowed ? form.targetValue : form.periodTarget;
  const adorn = UNIT_ADORN[form.unit] ?? {};
  return (
    <div className="flex items-center gap-3 border-b-2 border-border focus-within:border-accent transition-colors pb-1">
      {form.unit === "CURRENCY" && <CurrencySelect value={form.currency} onChange={(v) => set("currency", v)} />}
      <input
        autoFocus={autoFocus} type="number" inputMode="decimal" value={value}
        required={!isEdit} aria-required={!isEdit}
        onChange={(e) => setTarget(e.target.value)}
        placeholder={isEdit ? "Leave blank to keep it" : "0"}
        className="w-full bg-transparent font-serif text-4xl text-foreground tabular-nums placeholder:text-muted/40 focus:outline-none"
      />
      {adorn.post && <span className="text-sm text-muted whitespace-nowrap">{adorn.post}</span>}
    </div>
  );
}

export function StepTarget({ ctx }: { ctx: KpiFormCtx }) {
  const { form, set, isEdit, parent, freqOpts, periodLabel, parentRange, setTarget } = ctx;
  const requiredHint = !isEdit ? "(required)" : undefined;

  // New KPIs can repeat every period OR run between two dates picked on a calendar.
  const options: [string, string][] = [
    ...freqOpts.map((f) => [f, EVERY[f] ?? f] as [string, string]),
    ...(!isEdit ? [["CUSTOM", "Pick dates"] as [string, string]] : []),
  ];
  const choice = form.windowed ? "CUSTOM" : form.frequency;
  const onChoice = (v: string) => {
    if (v === "CUSTOM") { set("windowed", true); return; }
    if (form.windowed) set("windowed", false);
    ctx.pickFrequency(v);
  };

  // Existing date-based KPIs keep their fixed-date layout (no frequency chips while editing).
  if (form.windowed) {
    return (
      <div className="@container space-y-6">
        {!isEdit && (
          <div>
            <Label>How often do you want to hit it?</Label>
            <Chips label="Frequency" value={choice} onChange={onChoice} options={options} />
          </div>
        )}

        {/* One column in a narrow modal, two columns once the modal is wide enough */}
        <div className="grid gap-6 @2xl:grid-cols-2 @2xl:gap-8">
          <div className="min-w-0">
            <Label>Which dates?</Label>
            <DateRangePicker
              start={form.startDate} end={form.endDate}
              onChange={(s, e) => { set("startDate", s); set("endDate", e); }}
            />
            {parentRange && <p className="text-xs text-muted mt-2">Keep these dates within {parentRange}, the bigger KPI's range.</p>}
          </div>

          <div className="min-w-0 space-y-6">
            <div>
              <Label hint={requiredHint}>Your total target for these dates</Label>
              <TargetInput ctx={ctx} />
              <ShareHint parent={parent} frequency={form.frequency} onUse={(v) => setTarget(String(v))} />
            </div>

            <div>
              <Label hint="(optional)">Starting value</Label>
              <input type="number" value={form.startValue} onChange={(e) => set("startValue", e.target.value)} className={inputClass} />
            </div>

            <Milestones value={form.milestones} onChange={(m) => set("milestones", m)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Label>How often do you want to hit it?</Label>
        <Chips label="Frequency" value={choice} onChange={onChoice} options={options} />
      </div>

      <div>
        <Label hint={requiredHint}>Your target for {periodLabel}</Label>
        <TargetInput ctx={ctx} autoFocus />
        <ShareHint parent={parent} frequency={form.frequency} onUse={(v) => setTarget(String(v))} />
        <p className="text-xs text-muted mt-2">
          Stays the same every {FREQ_WORD[form.frequency] ?? "period"} until you change it.
        </p>
      </div>
    </div>
  );
}