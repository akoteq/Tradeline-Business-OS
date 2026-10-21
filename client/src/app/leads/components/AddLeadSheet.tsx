"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { WizardShell, useWizard } from "./WizardShell";
import { Chips, Disclosure, Label, inputClass, selectClass } from "./fields";
import {
  EDITABLE_STATUSES, EMPTY_FORM, PRIORITIES, SOURCES, STATUS_LABEL, STATUS_LIST, apiError, formToBody, inDays, leadToForm,
  type BdoOption, type Lead, type LeadForm,
} from "./lib";

const STEPS = [
  { title: "Who's the lead?", subtitle: "Start with the business. The rest can wait.", nudge: "Let's start" },
  { title: "What happens next?", subtitle: "Set a follow-up so this lead doesn't go cold.", nudge: "Last step" },
] as const;

const QUICK_DAYS: [string, string][] = [["1", "Tomorrow"], ["3", "In 3 days"], ["7", "Next week"], ["custom", "Pick a date"]];

export function AddLeadSheet({ lead, bdos, canAssign, onClose, onSaved }: {
  lead: Lead | null; bdos: BdoOption[]; canAssign: boolean; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!lead;
  const [form, setForm] = useState<LeadForm>(lead ? leadToForm(lead) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customDate, setCustomDate] = useState(false);
  const { step, dir, reached, go, last } = useWizard(STEPS.length, isEdit ? STEPS.length - 1 : 0);
  const set = <K extends keyof LeadForm>(k: K, v: LeadForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const hasName = form.businessName.trim() !== "";
  const quick = ["1", "3", "7"].find((n) => inDays(Number(n)) === form.followUpDate);
  const quickValue = customDate || (form.followUpDate && !quick) ? "custom" : quick ?? "";
  const stages = form.status === "CONVERTED" ? STATUS_LIST : EDITABLE_STATUSES;

  const save = async () => {
    if (!hasName) { setError("Add the business name first."); go(0); return; }
    setSaving(true); setError("");
    try {
      const body = formToBody(form, canAssign);
      if (lead) await api.put(`/leads/${lead.id}`, body); else await api.post("/leads", body);
      onSaved();
    } catch (err) { setError(apiError(err, "Couldn't save this lead. Please try again.")); }
    finally { setSaving(false); }
  };

  return (
    <WizardShell
      steps={STEPS} step={step} dir={dir} reached={reached} onGo={go} onClose={onClose} error={error}
      primary={last
        ? { label: saving ? "Saving…" : isEdit ? "Save changes" : "Add lead", disabled: saving || !hasName, onClick: save }
        : { label: "Continue", disabled: !hasName, onClick: () => go(step + 1) }}
    >
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <Label>Business name</Label>
            <input
              autoFocus value={form.businessName} onChange={(e) => set("businessName", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && hasName) go(1); }}
              className={inputClass} placeholder="e.g. Asante Foods Ltd"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Who do you talk to?</Label>
              <input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} className={inputClass} placeholder="Contact person" />
            </div>
            <div>
              <Label>Phone</Label>
              <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} placeholder="024 000 0000" />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} placeholder="name@business.com" />
          </div>
          <Disclosure title="Add their role" defaultOpen={!!form.roleTitle}>
            <div>
              <Label>Role or title</Label>
              <input value={form.roleTitle} onChange={(e) => set("roleTitle", e.target.value)} className={inputClass} placeholder="e.g. Operations manager" />
            </div>
          </Disclosure>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <Label>How promising is it?</Label>
            <Chips label="Priority" value={form.priority} onChange={(v) => set("priority", v)} options={PRIORITIES} />
          </div>
          <div>
            <Label>Where is it now?</Label>
            <Chips label="Stage" value={form.status} onChange={(v) => set("status", v)} options={stages.map((s) => [s, STATUS_LABEL[s]] as [string, string])} />
          </div>
          <div>
            <Label>When will you follow up?</Label>
            <Chips
              label="Follow-up" value={quickValue}
              onChange={(v) => { if (v === "custom") setCustomDate(true); else { setCustomDate(false); set("followUpDate", inDays(Number(v))); } }}
              options={QUICK_DAYS}
            />
            {quickValue === "custom" && (
              <input type="date" value={form.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} className={inputClass + " mt-2"} aria-label="Follow-up date" />
            )}
          </div>
          <div>
            <Label>Where did it come from?</Label>
            <Chips label="Source" value={form.source} onChange={(v) => set("source", v)} options={[...SOURCES.map((s) => [s, s] as [string, string]), ["", "Not sure"] as [string, string]]} />
          </div>
          <div>
            <Label hint="(optional)">Anything worth remembering?</Label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputClass + " resize-none"} placeholder="What they need, what you promised, who referred them…" />
          </div>
          {(
            <Disclosure title="More options">
              {canAssign && (
                <div>
                  <Label>Who owns this lead?</Label>
                  <select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className={selectClass}>
                    <option value="">Nobody yet</option>
                    {bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}
                  </select>
                </div>
              )}
              <div>
                <Label>Date added</Label>
                <input type="date" value={form.dateAdded} onChange={(e) => set("dateAdded", e.target.value)} className={inputClass} />
              </div>
            </Disclosure>
          )}
        </div>
      )}
    </WizardShell>
  );
}
