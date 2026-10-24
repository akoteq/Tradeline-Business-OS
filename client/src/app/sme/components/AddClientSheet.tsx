"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { clsx } from "clsx";
import { AlertTriangle, Building2, ChevronRight } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { INDUSTRIES } from "@/lib/industries";
import { GHANA_REGIONS } from "@/lib/regions";
import { KpiSheet } from "@/components/kpi";
import { Chips, ErrorNote, Label, btnGhost, btnPrimary, btnSecondary, inputClass, selectClass } from "../../kpi-framework/components/fields";
import { Disclosure } from "../../leads/components/fields";
import { useDebounced } from "../../leads/components/DuplicateMatches";
import { apiError, inDays } from "../../leads/components/lib";
import {
  EMPTY_FORM, REVENUE_YEARS, STATUS_LABEL, STATUS_OPTS, TIER_LABEL, TIER_OPTS, formToBody, smeToForm,
  type BdoOption, type ClientForm, type ClientMatch, type SME,
} from "./lib";

// Same three-step flow as adding a KPI on the KPI framework.
const STEPS = [
  { title: "Who's the client?", subtitle: "The business and who you talk to there.", nudge: "Let's start" },
  { title: "What do they do?", subtitle: "Their sector, where they are and what they make or sell.", nudge: "Halfway there" },
  { title: "Last step", subtitle: "Where things stand, and who looks after them.", nudge: "Almost done" },
] as const;

const QUICK_DAYS: [string, string][] = [["", "No follow-up"], ["1", "Tomorrow"], ["7", "Next week"], ["custom", "Pick a date"]];

export function AddClientSheet({ sme, bdos, tradelineView, onClose, onSaved, onOpenExisting }: {
  sme: SME | null; bdos: BdoOption[]; tradelineView: boolean;
  onClose: () => void; onSaved: () => void;
  /** Opens a client from the "may already be a client" list. */
  onOpenExisting: (id: string) => void;
}) {
  const isEdit = !!sme;
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [reached, setReached] = useState(isEdit ? STEPS.length - 1 : 0);
  const [form, setForm] = useState<ClientForm>(sme ? smeToForm(sme) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Set when the full check on save (name, phone and email) found a match.
  const [blocked, setBlocked] = useState<ClientMatch[] | null>(null);
  const [customDate, setCustomDate] = useState(false);
  const set = <K extends keyof ClientForm>(k: K, v: ClientForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Check the name against the whole group as it's typed. When editing, only once the name changes.
  const nameChanged = !isEdit || form.companyName.trim() !== sme.companyName;
  const q = useDebounced(nameChanged ? form.companyName.trim() : "", 350);
  const { data: live = [] } = useQuery<ClientMatch[]>({
    queryKey: ["sme-duplicates", q, sme?.id ?? ""],
    queryFn: () => fetcher(`/sme/duplicates?${new URLSearchParams({ name: q, ...(sme ? { exclude: sme.id } : {}) })}`),
    enabled: q.length >= 3,
    staleTime: 30_000,
  });
  const matches = q.length >= 3 ? live : [];

  const hasName = form.companyName.trim() !== "";
  const last = step === STEPS.length - 1;
  const quick = ["1", "7"].find((n) => inDays(Number(n)) === form.followUpDate);
  const quickValue = customDate || (form.followUpDate && !quick) ? "custom" : quick ?? "";
  const statuses = isEdit ? STATUS_OPTS : STATUS_OPTS.filter((s) => s !== "ARCHIVED");

  const go = (to: number) => { setDir(to > step ? 1 : -1); setStep(to); setReached((r) => Math.max(r, to)); };
  const canContinue = step === 0 ? hasName : true;
  const next = () => { if (canContinue) go(step + 1); };
  // Changing who the business is clears a match found on save.
  const setContact = (k: "companyName" | "phone" | "email", v: string) => { set(k, v); setBlocked(null); };

  const save = async (force = false) => {
    if (!hasName) { setError("Add the business name first."); go(0); return; }
    setSaving(true); setError("");
    // A new client is checked against the whole group first, so nobody adds the same business twice.
    if (!isEdit && !force) {
      try {
        const params = new URLSearchParams({ name: form.companyName, phone: form.phone, email: form.email });
        const found = await fetcher(`/sme/duplicates?${params}`) as ClientMatch[];
        if (found.length) { setBlocked(found); setSaving(false); return; }
      } catch { /* the check is a convenience; carry on */ }
    }
    try {
      const body = formToBody(form, tradelineView);
      if (sme) await api.put(`/sme/${sme.id}`, body); else await api.post("/sme", body);
      onSaved();
    } catch (err) { setError(apiError(err, "Couldn't save this client. Please try again.")); }
    finally { setSaving(false); }
  };

  const primaryLabel = last ? (saving ? "Saving…" : isEdit ? "Save changes" : "Add client") : "Continue";
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
          <button onClick={last ? () => save() : next} disabled={last ? saving || !hasName || !!blocked : !canContinue} className={btnPrimary}>{primaryLabel}</button>
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
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <Label>Business name</Label>
                <input
                  autoFocus value={form.companyName} onChange={(e) => setContact("companyName", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") next(); }}
                  className={inputClass} placeholder="e.g. Asante Foods Ltd"
                  aria-describedby={matches.length ? "client-duplicates" : undefined}
                />
              </div>
              <div id="client-duplicates" aria-live="polite">
                <ClientMatches matches={matches} onOpen={onOpenExisting} />
              </div>
              <div>
                <Label>Who do you talk to?</Label>
                <input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} className={inputClass} placeholder="Contact person" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setContact("phone", e.target.value)} className={inputClass} placeholder="024 000 0000" />
                </div>
                <div>
                  <Label>Email</Label>
                  <input type="email" value={form.email} onChange={(e) => setContact("email", e.target.value)} className={inputClass} placeholder="name@business.com" />
                </div>
              </div>
              <Disclosure title="Add another phone number" defaultOpen={!!form.altPhone}>
                <div>
                  <Label>Alternate phone</Label>
                  <input type="tel" inputMode="tel" value={form.altPhone} onChange={(e) => set("altPhone", e.target.value)} className={inputClass} />
                </div>
              </Disclosure>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label>Sector</Label>
                <select value={form.valueChain} onChange={(e) => set("valueChain", e.target.value)} className={selectClass}>
                  <option value="">Choose a sector…</option>
                  {form.valueChain && !INDUSTRIES.includes(form.valueChain) && <option value={form.valueChain}>{form.valueChain}</option>}
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Region</Label>
                  <select value={form.region} onChange={(e) => set("region", e.target.value)} className={selectClass}>
                    <option value="">Not sure yet</option>
                    {form.region && !GHANA_REGIONS.includes(form.region) && <option value={form.region}>{form.region}</option>}
                    {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Town / district</Label>
                  <input value={form.district} onChange={(e) => set("district", e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <Label hint="(comma-separated)">Activities</Label>
                <input value={form.activities} onChange={(e) => set("activities", e.target.value)} className={inputClass} placeholder="e.g. shea butter processing, export" />
              </div>
              <div>
                <Label hint="(optional)">About the business</Label>
                <textarea value={form.businessDescription} onChange={(e) => set("businessDescription", e.target.value)} rows={3} className={inputClass + " resize-none"} placeholder="What they make or sell, who they sell to…" />
              </div>
              <Disclosure title="Address and business profile" defaultOpen={!!(form.address || form.dateOfIncorporation || form.yearsInOperation)}>
                <div>
                  <Label>Address</Label>
                  <input value={form.address} onChange={(e) => set("address", e.target.value)} className={inputClass} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Incorporated on</Label>
                    <input type="date" value={form.dateOfIncorporation} onChange={(e) => set("dateOfIncorporation", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <Label>Years in operation</Label>
                    <input type="number" inputMode="numeric" min={0} value={form.yearsInOperation} onChange={(e) => set("yearsInOperation", e.target.value)} className={inputClass} />
                  </div>
                </div>
              </Disclosure>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {blocked && (
                <div className="space-y-2.5">
                  <ClientMatches matches={blocked} onOpen={onOpenExisting} title={`${blocked[0].name} may already be a client`} />
                  <p className="text-xs text-muted">Open the existing client to work with them, or, if it really is a different business, add it anyway.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setBlocked(null); go(0); }} className="px-3.5 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-foreground/5">
                      Change the details
                    </button>
                    <button type="button" onClick={() => save(true)} disabled={saving} className="px-3.5 py-2 text-sm font-medium rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-50">
                      {saving ? "Saving…" : "It's a different business, add anyway"}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <Label>Where are things with them?</Label>
                <Chips label="Status" value={form.status} onChange={(v) => set("status", v)} options={statuses.map((s) => [s, STATUS_LABEL[s]] as [string, string])} />
              </div>
              <div>
                <Label>When will you follow up?</Label>
                <Chips
                  label="Follow-up" value={quickValue}
                  onChange={(v) => {
                    if (v === "custom") setCustomDate(true);
                    else { setCustomDate(false); set("followUpDate", v ? inDays(Number(v)) : ""); }
                  }}
                  options={QUICK_DAYS}
                />
                {quickValue === "custom" && (
                  <input type="date" value={form.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} className={inputClass + " mt-2"} aria-label="Follow-up date" />
                )}
              </div>
              <div>
                <Label>Who looks after this client?</Label>
                <select value={form.bdoId} onChange={(e) => set("bdoId", e.target.value)} className={selectClass}>
                  <option value="">Nobody yet</option>
                  {bdos.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.company})</option>)}
                </select>
              </div>
              <div>
                <Label hint="(optional)">Anything worth remembering?</Label>
                <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputClass + " resize-none"} />
              </div>
              {tradelineView && (
                <Disclosure title="Financing (Tradeline only)" defaultOpen={isEdit && form.bankabilityTier !== "UNSCORED"}>
                  <div>
                    <Label>Bankability</Label>
                    <Chips label="Bankability tier" value={form.bankabilityTier} onChange={(v) => set("bankabilityTier", v)} options={TIER_OPTS.map((t) => [t, TIER_LABEL[t]] as [string, string])} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label hint="(0–100)">Investor readiness</Label>
                      <input type="number" inputMode="numeric" min={0} max={100} value={form.investorReadinessScore} onChange={(e) => set("investorReadinessScore", e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <Label>Collateral</Label>
                      <input value={form.collateralStatus} onChange={(e) => set("collateralStatus", e.target.value)} className={inputClass} placeholder="e.g. Land title available" />
                    </div>
                  </div>
                  <div>
                    <Label hint="(GHS)">Revenue by year</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {REVENUE_YEARS.map((y) => {
                        const k = `revenueGhs${y}` as const;
                        return <input key={y} type="number" inputMode="decimal" min={0} value={form[k]} onChange={(e) => set(k, e.target.value)} className={inputClass} placeholder={y} aria-label={`Revenue ${y}`} />;
                      })}
                    </div>
                  </div>
                </Disclosure>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <ErrorNote message={error} />
    </KpiSheet>
  );
}

// Clients across the group that look like the one being added. Each opens the existing record.
function ClientMatches({ matches, onOpen, title }: { matches: ClientMatch[]; onOpen: (id: string) => void; title?: string }) {
  const { byKey } = useCompanies();
  if (!matches.length) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/70 px-3.5 py-3" role={title ? "alert" : undefined}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
        <AlertTriangle size={13} />
        {title ?? "This business may already be a client"}
      </p>
      <ul className="space-y-1.5">
        {matches.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => onOpen(m.id)} className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-surface">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-muted border border-border"><Building2 size={13} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{m.name}</span>
                <span className="block truncate text-xs text-muted">
                  {[m.region, m.servedBy.length ? `served by ${m.servedBy.map((k) => byKey[k]?.name ?? k).join(", ")}` : "not served yet"].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight size={14} className="shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-800">To work with an existing client, open it and start a deal from your pipeline.</p>
    </div>
  );
}
