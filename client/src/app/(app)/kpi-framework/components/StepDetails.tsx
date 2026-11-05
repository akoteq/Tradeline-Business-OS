"use client";

import type { KpiFormCtx } from "./types";
import { ChoiceCard, Chips, Disclosure, Label, inputClass, selectClass } from "./fields";
import { FREQ_WORD, fmtKpiVal } from "@/components/kpi";

export function StepDetails({ ctx }: { ctx: KpiFormCtx }) {
  const { form, set, isEdit, owners, departments, parentChoices, hiddenParents, autoKeys, aggLabels, defaultAgg, lockedAggregation } = ctx;
  const target = Number(form.windowed ? form.targetValue : form.periodTarget);
  const hasTarget = Number.isFinite(target) && target > 0 && (form.windowed ? form.targetValue : form.periodTarget) !== "";

  return (
    <div className="space-y-5">
      {/* A one-line recap so the last step feels like a confirmation, not more work. */}
      <p className="rounded-lg bg-foreground/5 px-3 py-2 text-sm text-foreground">
        <span className="font-medium">{form.metric || "Your KPI"}</span>
        <span className="text-muted">
          {hasTarget
            ? ` · ${fmtKpiVal(target, form.unit)} ${form.windowed ? "in total" : `a ${FREQ_WORD[form.frequency] ?? "period"}`}`
            : " · no target yet, saved as a draft"}
        </span>
      </p>

      <div>
        <Label>Who's responsible for it?</Label>
        <select value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)} className={selectClass}>
          <option value="">Nobody yet</option>
          {owners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {form.ownerId && <p className="text-xs text-muted mt-1">This KPI will also show on this person's KPI list.</p>}
      </div>

      <div>
        <Label>How will you get the numbers?</Label>
        <div role="radiogroup" aria-label="Source" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ChoiceCard selected={form.source === "MANUAL"} title="I'll add them myself" text="Log a result whenever something happens." onClick={() => set("source", "MANUAL")} />
          <ChoiceCard selected={form.source === "AUTO"} title="Pull them in for me" text="Updates itself from deals, payments, leads and tasks." onClick={() => set("source", "AUTO")} />
        </div>
        {form.source === "AUTO" && (
          <select value={form.autoKey} onChange={(e) => ctx.pickAutoKey(e.target.value)} className={selectClass + " mt-3"} aria-label="Data source">
            <option value="">Choose what to track…</option>
            {autoKeys.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        )}
      </div>

      <Disclosure title="More options">
        <div>
          <Label>Department</Label>
          <select value={form.departmentId} onChange={(e) => set("departmentId", e.target.value)} className={selectClass}>
            <option value="">None</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div>
          <Label hint="(if it's a slice of a bigger KPI)">Adds up to</Label>
          <select value={form.parentId} onChange={(e) => ctx.pickParent(e.target.value)} className={selectClass}>
            <option value="">Nothing, it stands on its own</option>
            {parentChoices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.company === "GROUP" ? "Group" : p.company} · {p.metric}
                {p.targetValue != null ? ` (target ${p.targetValue.toLocaleString()}${p.startDate && p.endDate ? "" : ` a ${FREQ_WORD[p.frequency] ?? "period"}`})` : ""}
              </option>
            ))}
          </select>
          {hiddenParents && <p className="text-xs text-muted mt-1">Only KPIs with the same unit and the same or a longer interval are listed, so results can roll up.</p>}
        </div>

        {form.source === "MANUAL" && (
          <div>
            <Label>How should results add up?</Label>
            <select
              value={form.aggregation || defaultAgg(form.unit)} onChange={(e) => set("aggregation", e.target.value)}
              disabled={lockedAggregation} className={selectClass}
            >
              {["SUM", "LATEST", "AVERAGE"].map((a) => <option key={a} value={a}>{aggLabels[a]}</option>)}
            </select>
            {lockedAggregation && <p className="text-xs text-muted mt-1">Locked once a KPI is live.</p>}
          </div>
        )}

        <div>
          <Label>Status</Label>
          <Chips
            label="State" value={form.state} onChange={(v) => set("state", v)}
            options={[["ACTIVE", "Live, counts in scores"], ["DRAFT", "Draft, not scored yet"]]}
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" checked={form.higherIsBetter} onChange={(e) => set("higherIsBetter", e.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />
          <span>A higher number is better <span className="text-muted text-xs">(untick for costs, turnaround times, overdue counts)</span></span>
        </label>

        <div>
          <Label>Description</Label>
          <textarea value={form.definition} onChange={(e) => set("definition", e.target.value)} rows={2} className={inputClass + " resize-none"} placeholder="What does it measure, and why does it matter?" />
        </div>
      </Disclosure>
    </div>
  );
}
