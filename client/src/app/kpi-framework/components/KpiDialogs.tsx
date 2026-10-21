"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, fetcher } from "@/lib/api";
import { accessLevel } from "@/lib/auth";
import { KpiRow, KpiSheet } from "@/components/kpi";
import { ReviewBadge } from "./ui";
import {
  TRANSITIONS, apiError, periodLabelFor, inputClass, btnPrimary, btnSecondary,
  type Category, type ReviewStatus,
} from "./lib";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted block mb-1">{children}</label>;
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-lg">{message}</p>;
}

// ─── Review workflow for the period (submit → verify → lock) ────────────────
export function ReviewPanel({ row, role, onChanged }: { row: KpiRow; role: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const entry = row.entry;
  if (!entry) return null;
  const review = (entry.reviewStatus ?? "DRAFT") as ReviewStatus;
  const actions = TRANSITIONS.filter((t) => t.from.includes(review) && (!t.levels || t.levels.includes(accessLevel(role))));
  const transition = async (action: string) => {
    setBusy(true); setError("");
    try { await api.post(`/kpi-framework/entries/${entry.id}/transition`, { action }); onChanged(); }
    catch (err) { setError(apiError(err, "Couldn't update the review status. Please try again.")); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
      <span className="text-xs text-muted">Review</span>
      <ReviewBadge value={review} />
      <span className="flex-1" />
      {actions.map((t) => (
        <button key={t.action} onClick={() => transition(t.action)} disabled={busy} className="px-2.5 py-1 text-xs rounded-lg border border-border hover:bg-primary/5 disabled:opacity-50">{t.label}</button>
      ))}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Target for one period of a recurring KPI ───────────────────────────────
export function PeriodTargetSheet({ row, period, onClose, onSaved }: { row: KpiRow; period: string; onClose: () => void; onSaved: () => void }) {
  const [target, setTarget] = useState(row.target != null ? String(row.target) : "");
  const [start, setStart] = useState(row.start != null ? String(row.start) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true); setError("");
    try {
      await api.post("/kpi-framework/quick-update", { definitionId: row.definition.id, period, target, start });
      onSaved();
    } catch (err) { setError(apiError(err, "Couldn't save the target. Please try again.")); setBusy(false); }
  };
  return (
    <KpiSheet
      title={row.definition.metric}
      subtitle={`Target for ${periodLabelFor(period, row.definition.frequency)}${row.targetCarried ? " · carried over from an earlier period" : ""}`}
      onClose={onClose}
      footer={<><button onClick={onClose} className={btnSecondary}>Cancel</button><button onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving…" : "Save target"}</button></>}
    >
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Target *</Label><input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} autoFocus /></div>
        <div><Label>Starting value <span className="text-muted/60">(optional)</span></Label><input type="number" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} placeholder="Where progress begins" /></div>
      </div>
      <p className="text-[11px] text-muted">This target carries forward to later periods until you change it.</p>
      <ErrorNote message={error} />
    </KpiSheet>
  );
}

// ─── Categories (per company) ───────────────────────────────────────────────
export function CategoriesModal({ company, companyName, onClose, onChanged }: { company: string; companyName: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery<Category[]>({ queryKey: ["kpi-categories", company, "all"], queryFn: () => fetcher(`/kpi-framework/categories?company=${company}&all=1`) });
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["kpi-categories"] }); onChanged(); };
  const add = async () => {
    if (!name.trim()) return;
    setError("");
    try { await api.post("/kpi-framework/categories", { company, name }); setName(""); refresh(); }
    catch (err) { setError(apiError(err, "Couldn't add the category. Please try again.")); }
  };
  const update = async (c: Category, body: Record<string, unknown>) => {
    try { await api.put(`/kpi-framework/categories/${c.id}`, body); refresh(); }
    catch (err) { setError(apiError(err, "Couldn't update the category. Please try again.")); }
  };
  return (
    <KpiSheet title="KPI categories" subtitle={`${companyName} · Group related KPIs together, e.g. Sales, Delivery, Finance`} onClose={onClose}>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className={inputClass} placeholder="New category name" />
        <button onClick={add} className={btnPrimary}>Add</button>
      </div>
      <ErrorNote message={error} />
      <ul className="divide-y divide-border/60">
        {cats.map((c) => (
          <li key={c.id} className="py-2 flex items-center gap-2">
            <input defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && update(c, { name: e.target.value })} className={clsx(inputClass, "py-1.5", c.status === "ARCHIVED" && "opacity-50")} />
            <span className="text-[11px] text-muted whitespace-nowrap">{c.kpiCount} KPI{c.kpiCount === 1 ? "" : "s"}</span>
            <button onClick={() => update(c, { status: c.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED" })} className="text-xs text-muted hover:text-accent whitespace-nowrap">
              {c.status === "ARCHIVED" ? "Restore" : "Archive"}
            </button>
          </li>
        ))}
        {cats.length === 0 && <li className="py-3 text-sm text-muted">No categories yet. Add one above to start grouping your KPIs.</li>}
      </ul>
    </KpiSheet>
  );
}
