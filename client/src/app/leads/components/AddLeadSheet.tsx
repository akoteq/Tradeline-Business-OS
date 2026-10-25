"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/components/Toast";
import { INDUSTRIES } from "@/lib/industries";
import { GHANA_REGIONS } from "@/lib/regions";
import { WizardShell, useWizard } from "./WizardShell";
import { Chips, Disclosure, Label, inputClass, selectClass } from "./fields";
import { DuplicateMatches, useDuplicateMatches, type DuplicateMatch } from "./DuplicateMatches";
import {
  EDITABLE_STATUSES, EMPTY_FORM, PRIORITIES, SOURCES, STATUS_LABEL, STATUS_LIST, apiError, formToBody, inDays, leadToForm,
  type BdoOption, type Lead, type LeadForm,
} from "./lib";

const STEPS = [
  { title: "Who's the lead?", subtitle: "Start with the business. The rest can wait.", nudge: "Let's start" },
  { title: "What happens next?", subtitle: "Set a follow-up so this lead doesn't go cold.", nudge: "Last step" },
] as const;

const QUICK_DAYS: [string, string][] = [["1", "Tomorrow"], ["3", "In 3 days"], ["7", "Next week"], ["custom", "Pick a date"]];

export function AddLeadSheet({ lead, bdos, canAssign, onClose, onSaved, onOpenLead }: {
  lead: Lead | null; bdos: BdoOption[]; canAssign: boolean; onClose: () => void; onSaved: () => void;
  /** Opens an existing lead from the "may already be a lead" list. */
  onOpenLead?: (id: string) => void;
}) {
  const isEdit = !!lead;
  const [form, setForm] = useState<LeadForm>(lead ? leadToForm(lead) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Set when the server refused the save because the business is already a lead.
  const [blocked, setBlocked] = useState<DuplicateMatch[] | null>(null);
  const [customDate, setCustomDate] = useState(false);
  const { step, dir, reached, go, last } = useWizard(STEPS.length, isEdit ? STEPS.length - 1 : 0);
  const set = <K extends keyof LeadForm>(k: K, v: LeadForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Check the name against existing leads and clients as it's typed. When editing, only once
  // the name is changed: the lead always matches itself otherwise.
  const nameChanged = !isEdit || form.businessName.trim() !== lead.businessName;
  const { matches } = useDuplicateMatches(nameChanged ? form.businessName : "", lead?.id);

  const hasName = form.businessName.trim() !== "";
  // A new lead needs its industry; region stays optional.
  const needsIndustry = !isEdit && !form.industry;
  // A new lead must have a follow-up date so it doesn't go cold.
  const needsFollowUp = !isEdit && !form.followUpDate;
  const quick = ["1", "3", "7"].find((n) => inDays(Number(n)) === form.followUpDate);
  const quickValue = customDate || (form.followUpDate && !quick) ? "custom" : quick ?? "";
  const stages = form.status === "CONVERTED" ? STATUS_LIST : EDITABLE_STATUSES;

  const save = async (allowDuplicate = false) => {
    if (!hasName) { setError("Add the business name first."); go(0); return; }
    if (needsIndustry) { setError("Pick the industry this business is in."); go(0); return; }
    if (needsFollowUp) { setError("Pick when you'll follow up with this lead."); return; }
    setSaving(true); setError(""); setBlocked(null);
    try {
      const body = { ...formToBody(form, canAssign), ...(allowDuplicate ? { allowDuplicate: true } : {}) };
      if (lead) await api.put(`/leads/${lead.id}`, body); else await api.post("/leads", body);
      toast.success(isEdit ? "Lead updated" : "Lead added", { description: form.businessName.trim() });
      onSaved();
    } catch (err) {
      const dups = (err as { response?: { status?: number; data?: { duplicates?: DuplicateMatch[] } } })?.response;
      if (dups?.status === 409 && dups.data?.duplicates?.length) setBlocked(dups.data.duplicates);
      else setError(apiError(err, "Couldn't save this lead. Please try again."));
    }
    finally { setSaving(false); }
  };

  return (
    <WizardShell
      steps={STEPS} step={step} dir={dir} reached={reached} onGo={go} onClose={onClose} error={error}
      primary={last
        ? { label: saving ? "Saving…" : isEdit ? "Save changes" : "Add lead", disabled: saving || !hasName || needsIndustry || needsFollowUp || !!blocked, onClick: () => save() }
        : { label: "Continue", disabled: !hasName || needsIndustry, onClick: () => go(step + 1) }}
    >
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <Label>Business name</Label>
            <input
              autoFocus value={form.businessName} onChange={(e) => { set("businessName", e.target.value); setBlocked(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && hasName && !needsIndustry) go(1); }}
              className={inputClass} placeholder="e.g. Asante Foods Ltd"
              aria-describedby={matches.length ? "lead-duplicates" : undefined}
            />
          </div>
          <div id="lead-duplicates" aria-live="polite">
            <DuplicateMatches matches={matches} onOpenLead={onOpenLead} />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label hint={isEdit ? undefined : "(required)"}>Industry</Label>
              <select value={form.industry} onChange={(e) => { set("industry", e.target.value); setError(""); }} className={selectClass} aria-required={!isEdit}>
                <option value="">Choose an industry…</option>
                {form.industry && !INDUSTRIES.includes(form.industry) && <option value={form.industry}>{form.industry}</option>}
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <Label hint="(optional)">Region</Label>
              <select value={form.region} onChange={(e) => set("region", e.target.value)} className={selectClass}>
                <option value="">Not sure yet</option>
                {form.region && !GHANA_REGIONS.includes(form.region) && <option value={form.region}>{form.region}</option>}
                {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
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
          {blocked && (
            <div className="space-y-2.5" role="alert">
              <DuplicateMatches matches={blocked} onOpenLead={onOpenLead} title={`${blocked[0].name} is already a lead`} />
              <p className="text-xs text-muted">Open the existing lead to add your notes there, or, if it really is a different business, add it anyway.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setBlocked(null); go(0); }} className="px-3.5 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-foreground/5">
                  Change the name
                </button>
                <button type="button" onClick={() => save(true)} disabled={saving} className="px-3.5 py-2 text-sm font-medium rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-50">
                  {saving ? "Saving…" : "It's a different business, add anyway"}
                </button>
              </div>
            </div>
          )}
          <div>
            <Label>How promising is it?</Label>
            <Chips label="Priority" value={form.priority} onChange={(v) => set("priority", v)} options={PRIORITIES} />
          </div>
          <div>
            <Label>Where is it now?</Label>
            <Chips label="Stage" value={form.status} onChange={(v) => set("status", v)} options={stages.map((s) => [s, STATUS_LABEL[s]] as [string, string])} />
          </div>
          <div>
            <Label hint={isEdit ? undefined : "(required)"}>When will you follow up?</Label>
            <Chips
              label="Follow-up" value={quickValue}
              onChange={(v) => { setError(""); if (v === "custom") setCustomDate(true); else { setCustomDate(false); set("followUpDate", inDays(Number(v))); } }}
              options={QUICK_DAYS}
            />
            {quickValue === "custom" && (
              <input
                type="date" value={form.followUpDate} required={!isEdit} min={isEdit ? undefined : inDays(0)}
                onChange={(e) => { set("followUpDate", e.target.value); setError(""); }}
                className={inputClass + " mt-2"} aria-label="Follow-up date"
              />
            )}
            {needsFollowUp && <p className="mt-1.5 text-xs text-muted">Pick a day to add the lead.</p>}
          </div>
          <div>
            <Label>Where did it come from?</Label>
            <Chips label="Source" value={form.source} onChange={(v) => set("source", v)} options={[...SOURCES.map((s) => [s, s] as [string, string]), ["", "Not sure"] as [string, string]]} />
          </div>
          <div>
            <Label hint="(optional)">Anything worth remembering?</Label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputClass + " resize-none"} placeholder="What they need, what you promised, who referred them…" />
          </div>
          {canAssign && (
            <Disclosure title="More options">
              <div>
                <Label>Who owns this lead?</Label>
                <select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className={selectClass}>
                  <option value="">Nobody yet</option>
                  {bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}
                </select>
              </div>
            </Disclosure>
          )}
          {/* The date added is set automatically when the lead is created. */}
          {isEdit && (lead.dateAdded || lead.createdAt) && (
            <p className="text-xs text-muted">Added on {new Date((lead.dateAdded || lead.createdAt)!).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}</p>
          )}
        </div>
      )}
    </WizardShell>
  );
}
