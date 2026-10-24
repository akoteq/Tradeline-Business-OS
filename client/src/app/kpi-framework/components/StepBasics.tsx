"use client";

import type { KpiFormCtx } from "./types";
import { Chips, Label, inputClass, selectClass } from "./fields";

const UNIT_LABEL: Record<string, string> = {
  CURRENCY: "Money (GHS)", COUNT: "A count", PERCENT: "Percent", SCORE: "A score", DAYS: "Days", HOURS: "Hours",
};

export function StepBasics({ ctx, onEnter }: { ctx: KpiFormCtx; onEnter: () => void }) {
  const { form, set, setForm, companyOpts, unitOpts } = ctx;
  return (
    <div className="space-y-5">
      <div>
        <Label>Name</Label>
        <input
          autoFocus value={form.metric} onChange={(e) => set("metric", e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && form.metric.trim()) onEnter(); }}
          className={inputClass} placeholder="e.g. Revenue received"
        />
      </div>

      <div>
        <Label>How is it measured?</Label>
        <Chips
          label="Unit" value={form.unit} onChange={(v) => set("unit", v)}
          options={unitOpts.map((u) => [u, UNIT_LABEL[u] ?? u] as [string, string])}
        />
      </div>

      {companyOpts.length > 1 && (
        <div>
          <Label>Which company?</Label>
          <select
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value, departmentId: "", ownerId: "", parentId: "" }))}
            className={selectClass}
          >
            {companyOpts.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
