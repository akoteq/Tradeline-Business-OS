"use client";

import { useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { ClientSelect, type ClientOption } from "@/components/ClientSelect";
import { useAuth } from "@/components/AuthProvider";
import { useCompanies } from "@/lib/companies";
import { KpiSheet } from "@/components/kpi";
import {
  CURRENCIES,
  OUTCOME_LABEL,
  OUTCOME_OPTS,
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  apiError,
  fmtDate,
  inDays,
  type Bdo,
  type DealOption,
  type Linkable,
  type Task,
  type TaskAttachment,
  type TaskKpi,
} from "./task-utils";
import { AttachmentsField, discardUploads } from "./Attachments";

/**
 * Add / edit a task in three short steps, the same flow as "Add KPI":
 *   1. What is it?   2. When, and how urgent?   3. Who owns it, and what is it for?
 * Everything optional lives behind "More options" so the default path is fast.
 */

/* ------------------------------------------------------------------ */
/* Look and feel (shared with the Add KPI sheet)                       */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full bg-background border border-transparent rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors";
const primaryBtn =
  "px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity";
const secondaryBtn =
  "px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-foreground hover:bg-primary/5 transition-colors";
const ghostBtn = "px-3 py-2.5 rounded-xl text-sm text-muted hover:text-foreground transition-colors";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}
        {hint && <span className="font-normal text-muted"> {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([key, label]) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={selected}
            className={clsx(
              "h-9 px-4 rounded-full border text-sm transition-colors",
              selected
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border bg-surface text-muted hover:text-foreground hover:border-foreground/30"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function StepProgress({ step, reachable, onGo }: { step: number; reachable: number; onGo: (n: number) => void }) {
  const captions = ["Let's start", "Halfway there", "Almost done"];
  return (
    <div>
      <div className="flex gap-2">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            disabled={n > reachable}
            onClick={() => onGo(n)}
            aria-label={`Go to step ${n}`}
            aria-current={n === step ? "step" : undefined}
            className={clsx("h-1 flex-1 rounded-full transition-colors", n <= step ? "bg-accent" : "bg-border", n <= reachable && n !== step && "hover:opacity-70")}
          />
        ))}
      </div>
      <p className="text-xs text-muted mt-2">{step} of 3 · {captions[step - 1]}</p>
    </div>
  );
}

function MoreOptions({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="border-t border-border pt-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-2.5 text-sm text-muted hover:text-foreground transition-colors"
      >
        More options
        <ChevronDown size={16} className={clsx("transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-4 pb-1 pt-1.5">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The form                                                            */
/* ------------------------------------------------------------------ */

export function TaskForm({ task, bdos, clients, allTasks, isBdo, oneCompany, myBdoId, defaultType, onClose, onSaved }: {
  task: Task | null;
  bdos: Bdo[];
  clients: ClientOption[];
  allTasks: Task[];
  isBdo: boolean;
  oneCompany: boolean;
  myBdoId: string | null;
  defaultType: "TASK" | "PROPOSAL";
  onClose: () => void;
  onSaved: (saved: Task, justCompleted: boolean) => void;
}) {
  const { companies } = useCompanies();
  const { user } = useAuth();
  const ownCompany = oneCompany ? (user?.bdoCompany ?? null) : null;
  const editing = !!task;

  const [form, setForm] = useState({
    priority: task?.priority ?? "MEDIUM",
    deliverable: task?.deliverable ?? "",
    targetDate: task?.targetDate ? task.targetDate.slice(0, 10) : "",
    // The API now requires a start date. New tasks start today unless you change it; an older
    // task with no start date stays empty so nothing is filled in behind your back.
    startDate: task ? (task.startDate ? task.startDate.slice(0, 10) : "") : inDays(0),
    status: task?.status === "OVERDUE" ? "PENDING" : task?.status ?? "PENDING",
    company: task?.company ?? ownCompany ?? "TRADELINE",
    bdoId: task?.bdoId ?? "",
    notes: task?.notes ?? "",
    type: task?.type ?? defaultType,
    smeId: task?.smeId ?? "",
    clientName: task?.clientName ?? "",
    proposalValueGhs: task?.proposalValueGhs != null ? String(task.proposalValueGhs) : "",
    outcome: task?.outcome ?? "DRAFT",
    kpiId: task?.kpiId ?? "",
    completionCriteria: task?.completionCriteria ?? "",
    dependsOn: task?.dependsOn ?? ([] as string[]),
    expenseActual: task?.expenseActual != null ? String(task.expenseActual) : "",
    revenueActual: task?.revenueActual != null ? String(task.revenueActual) : "",
    currency: task?.currency ?? "GHS",
    exchangeRate: task?.exchangeRate && task.exchangeRate !== 1 ? String(task.exchangeRate) : "",
    dealId: task?.dealId ?? "",
    attachments: task?.attachments ?? ([] as TaskAttachment[]),
  });
  // Files uploaded while this form is open. Any that don't end up saved on the task (removed
  // again, or the form is cancelled) are thrown away so they don't sit in Cloudinary.
  const uploads = useRef<TaskAttachment[]>([]);
  const unsaved = (kept: TaskAttachment[]) => uploads.current.filter((u) => !kept.some((k) => k.publicId === u.publicId));
  const close = () => { discardUploads(uploads.current); onClose(); };
  const [step, setStep] = useState(1);
  // New tasks unlock steps as you go; when editing, every step is open from the start.
  const [reachable, setReachable] = useState(editing ? 3 : 1);
  const [more2, setMore2] = useState(editing);
  const [more3, setMore3] = useState(
    !!(task && (task.completionCriteria || task.dealId || task.dependsOn.length || task.notes || task.expenseActual || task.revenueActual))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isProposal = form.type === "PROPOSAL";
  const assignee = isBdo ? myBdoId : (form.bdoId || null);
  const hasName = form.deliverable.trim().length > 0;

  // KPIs this work can serve: the assignee's own, their scorecard, and their company's.
  const { data: linkable = [] } = useQuery<Linkable[]>({
    queryKey: ["kpi-linkable", assignee ?? "", form.company],
    queryFn: () => fetcher(`/kpi-framework/linkable?${new URLSearchParams({ ...(assignee ? { bdoId: assignee } : {}), company: form.company })}`),
  });
  const kpiGroups: [string, Linkable[]][] = [
    ["Their KPIs", linkable.filter((k) => k.kind === "PERSONAL")],
    ["Company KPIs", linkable.filter((k) => k.kind === "COMPANY")],
    ["Scorecard", linkable.filter((k) => k.kind === "SCORECARD")],
  ];

  // Deals in the task's company this work can be for (the ones the person can see).
  const { data: dealOpts = [] } = useQuery<DealOption[]>({
    queryKey: ["task-deal-options", form.company],
    queryFn: () => fetcher(`/tasks/deal-options?company=${encodeURIComponent(form.company)}`),
    enabled: !!form.company,
  });
  const linkedDeal = dealOpts.find((d) => d.id === form.dealId) ?? (task?.deal && task.deal.id === form.dealId ? task.deal : null);
  const depChoices = allTasks.filter((t) => t.id !== task?.id && t.type === "TASK" && t.status !== "CANCELLED");

  // Dates are checked here, on the step where you can fix them, not after the server says no.
  // A task needs both dates (the server requires them); a proposal's due / sent date is optional.
  const dateError = () =>
    !form.startDate
      ? "Pick a start date."
      : !isProposal && !form.targetDate
      ? "Pick a due date."
      : form.targetDate &&form.targetDate < form.startDate
      ? "The due date can't be before the start date."
      : "";

  const go = (n: number) => {
    if (n > 1 && !hasName) { setError(isProposal ? "Name the proposal to continue." : "Name the task to continue."); setStep(1); return; }
    if (n >= 3) {
      const dErr = dateError();
      if (dErr) { setError(dErr); setStep(2); return; }
    }
    setError("");
    setStep(n);
    setReachable((r) => Math.max(r, n));
  };

  const save = async () => {
    if (!hasName) { go(1); return; }
    const dErr = dateError();
    if (dErr) { setError(dErr); setStep(2); return; }
    setSaving(true);
    setError("");
    // The year follows the due date, so it never needs asking.
    const yearOf = (d: string) => (d ? parseInt(d.slice(0, 4), 10) : NaN);
    const year = yearOf(form.targetDate) || yearOf(form.startDate) || task?.year || new Date().getFullYear();
    const body = {
      year,
      priority: form.priority,
      deliverable: form.deliverable.trim(),
      status: form.status,
      company: form.company,
      notes: form.notes || null,
      targetDate: form.targetDate || null,
      startDate: form.startDate || null,
      bdoId: assignee,
      type: form.type,
      smeId: isProposal ? (form.smeId || null) : null,
      clientName: isProposal ? (form.clientName || null) : null,
      proposalValueGhs: isProposal && form.proposalValueGhs ? Number(form.proposalValueGhs) : null,
      outcome: isProposal ? form.outcome : null,
      kpiId: form.kpiId || null,
      completionCriteria: form.completionCriteria || null,
      dependsOn: form.dependsOn,
      expenseActual: form.expenseActual === "" ? null : Number(form.expenseActual),
      revenueActual: form.revenueActual === "" ? null : Number(form.revenueActual),
      currency: form.currency,
      exchangeRate: form.currency === "GHS" ? 1 : Number(form.exchangeRate) || null,
      dealId: form.dealId || null,
      attachments: form.attachments,
    };
    try {
      const res = task ? await api.put(`/tasks/${task.id}`, body) : await api.post("/tasks", body);
      const saved = res.data as Task;
      discardUploads(unsaved(saved.attachments ?? form.attachments));
      const match = linkable.find((k) => k.id === saved.kpiId);
      const kpi = saved.kpi ?? (match ? ({ ...match, aggregation: null } as TaskKpi) : null);
      onSaved({ ...saved, kpi, bdoId: saved.bdoId ?? assignee }, form.status === "COMPLETED" && task?.status !== "COMPLETED");
    } catch (err) {
      const msg = apiError(err, `We couldn't save this ${isProposal ? "proposal" : "task"}. Please try again.`);
      setError(msg);
      // Take the person to the step that owns the problem, so the message sits next to the field.
      if (/start|due|deadline|date/i.test(msg)) setStep(2);
      else if (/name|title|deliverable/i.test(msg)) setStep(1);
    } finally {
      setSaving(false);
    }
  };

  /* ---- copy per step ---- */
  const heading =
    step === 1
      ? { title: isProposal ? "What are you proposing?" : "What needs to get done?", sub: isProposal ? "Name it and say who it's for." : "Give it a short name everyone will understand." }
      : step === 2
      ? { title: "When does it need to happen?", sub: "Set the deadline and how urgent it is." }
      : { title: "Last step", sub: "Who owns it, and what it's for." };

  const dueLabel = isProposal ? "When is it due or sent?" : "When is it due?";
  const summaryBits = [
    PRIORITY_LABEL[form.priority] + " priority",
    form.targetDate ? `Due ${fmtDate(form.targetDate)}` : "No due date",
  ];

  /* ---- footer per step ---- */
  const footer = (
    <div className="flex items-center justify-end gap-2 w-full">
      {step === 1 ? (
        <button type="button" onClick={close} className={secondaryBtn}>Cancel</button>
      ) : (
        <button type="button" onClick={() => go(step - 1)} className={ghostBtn}>Back</button>
      )}
      {step === 1 && (
        <button type="button" onClick={() => go(2)} disabled={!hasName} className={primaryBtn}>Continue</button>
      )}
      {step === 2 && (
        <button type="button" onClick={() => go(3)} className={primaryBtn}>
          {form.targetDate || !isProposal ? "Continue" : "Skip for now"}
        </button>
      )}
      {step === 3 && (
        <button type="button" onClick={save} disabled={saving || !hasName} className={primaryBtn}>
          {saving ? "Saving…" : editing ? "Save changes" : isProposal ? "Add proposal" : "Add task"}
        </button>
      )}
    </div>
  );

  return (
    <KpiSheet title={heading.title} subtitle={heading.sub} onClose={close} footer={footer}>
      <div className="space-y-5">
        <StepProgress step={step} reachable={reachable} onGo={go} />

        {/* ---------------- Step 1: what is it? ---------------- */}
        {step === 1 && (
          <>
            <Field label={isProposal ? "Proposal name" : "Task name"}>
              <input
                autoFocus
                value={form.deliverable}
                onChange={(e) => { set("deliverable", e.target.value); if (error) setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && hasName) go(2); }}
                placeholder={isProposal ? "e.g. Website proposal for Acme Ltd" : "e.g. Send the Q4 report to the board"}
                className={inputClass}
              />
            </Field>

            {/* No "task or proposal?" question. A proposal is just a task with a client and a value,
                so the type follows where you started: "New task" makes a task, "New proposal" on the
                Proposals tab makes a proposal, and editing keeps whatever it already is. */}

            {isProposal && (
              <>
                <ClientSelect
                  label="Who is it for?"
                  value={form.smeId}
                  options={clients}
                  fallbackLabel={form.clientName || undefined}
                  onChange={(id) => {
                    const c = clients.find((o) => o.id === id);
                    setForm((f) => ({ ...f, smeId: id, clientName: c?.companyName ?? f.clientName }));
                  }}
                />
                <Field label="How much is it worth?" hint="(GHS, optional)">
                  <input
                    type="number"
                    min="0"
                    value={form.proposalValueGhs}
                    onChange={(e) => set("proposalValueGhs", e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </Field>
              </>
            )}

            <Field label="Links and files" hint="(optional)">
              <AttachmentsField
                value={form.attachments}
                onChange={(next) => set("attachments", next)}
                onUploaded={(file) => { uploads.current.push(file); }}
              />
            </Field>
          </>
        )}

        {/* ---------------- Step 2: when, and how urgent? ---------------- */}
        {step === 2 && (
          <>
            {isProposal && (
              <Field label="Where does it stand?">
                <Chips
                  value={form.outcome}
                  options={OUTCOME_OPTS.map((o) => [o, OUTCOME_LABEL[o]] as const)}
                  onChange={(v) => set("outcome", v)}
                />
              </Field>
            )}

            <Field label="How urgent is it?">
              <Chips
                value={form.priority}
                options={PRIORITIES.map((p) => [p, PRIORITY_LABEL[p]] as const)}
                onChange={(v) => set("priority", v)}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="When does it start?">
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => { set("startDate", e.target.value); if (error) setError(""); }}
                className={inputClass}
              />
            </Field>
            <Field label={dueLabel} hint={isProposal ? "(optional)" : undefined}>
              <input
                type="date"
                value={form.targetDate}
                min={form.startDate || undefined}
                onChange={(e) => { set("targetDate", e.target.value); if (error) setError(""); }}
                className={inputClass}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {([["Today", 0], ["Tomorrow", 1], ["In a week", 7]] as const).map(([label, n]) => {
                  const d = inDays(n);
                  const selected = form.targetDate === d;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => { set("targetDate", d); if (error) setError(""); }}
                      aria-pressed={selected}
                      className={clsx(
                        "h-7 px-3 rounded-full border text-xs transition-colors",
                        selected ? "border-accent bg-accent/10 text-foreground" : "border-border bg-surface text-muted hover:text-foreground hover:border-foreground/30"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
            </div>
            <p className="text-xs text-muted -mt-2">It turns red once the due date passes and the work is still open.</p>

            <MoreOptions open={more2} onToggle={() => setMore2((o) => !o)}>
              <Field label="Where is it at?">
                <Chips
                  value={form.status}
                  options={STATUSES.map((s) => [s, STATUS_LABEL[s]] as const)}
                  onChange={(v) => set("status", v)}
                />
              </Field>
            </MoreOptions>
          </>
        )}

        {/* ---------------- Step 3: owner and purpose ---------------- */}
        {step === 3 && (
          <>
            <div className="rounded-xl bg-background px-3.5 py-2.5 text-sm truncate">
              <span className="font-medium text-foreground">{form.deliverable.trim() || "Untitled"}</span>
              <span className="text-muted"> · {summaryBits.join(" · ")}</span>
            </div>

            {!oneCompany && (
              <Field label="Which company is it for?">
                <select
                  value={form.company}
                  onChange={(e) => {
                    const company = e.target.value;
                    // The owner has to work at the chosen company; clear one who doesn't.
                    setForm((f) => ({
                      ...f, company, kpiId: "", dealId: "",
                      bdoId: bdos.find((b) => b.id === f.bdoId)?.company === company ? f.bdoId : "",
                    }));
                  }}
                  className={inputClass}
                >
                  {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
              </Field>
            )}

            {!isBdo && (
              <Field label="Who's responsible for it?" hint="(you can pick later)">
                <select
                  value={form.bdoId}
                  onChange={(e) => setForm((f) => ({ ...f, bdoId: e.target.value, kpiId: "" }))}
                  className={inputClass}
                >
                  <option value="">Nobody yet</option>
                  {/* Only people at the chosen company. An older task filed under another company keeps its owner listed. */}
                  {bdos
                    .filter((b) => oneCompany || b.company === form.company || b.id === task?.bdoId)
                    .map((b) => <option key={b.id} value={b.id}>{b.name}{!oneCompany && b.company !== form.company ? ` (${b.company})` : ""}</option>)}
                </select>
              </Field>
            )}

            <Field label="Which KPI does it move?" hint="(optional)">
              <select value={form.kpiId} onChange={(e) => set("kpiId", e.target.value)} className={inputClass}>
                <option value="">None. It's a standalone task</option>
                {kpiGroups.filter(([, ks]) => ks.length).map(([label, ks]) => (
                  <optgroup key={label} label={label}>
                    {ks.map((k) => <option key={k.id} value={k.id}>{k.metric}{k.source === "AUTO" ? " (auto)" : ""}</option>)}
                  </optgroup>
                ))}
              </select>
              <p className="text-xs text-muted mt-1.5">
                {form.kpiId
                  ? "When it's done, we'll ask if it produced a result for this KPI."
                  : "Link one so finished work counts toward a goal."}
              </p>
            </Field>

            <MoreOptions open={more3} onToggle={() => setMore3((o) => !o)}>
              <Field label="How will we know it's done?" hint="(optional)">
                <input
                  value={form.completionCriteria}
                  onChange={(e) => set("completionCriteria", e.target.value)}
                  placeholder="e.g. Sent, and the client has confirmed they got it"
                  className={inputClass}
                />
              </Field>

              <Field label="Which deal is it for?" hint="(optional)">
                <select value={form.dealId} onChange={(e) => set("dealId", e.target.value)} className={inputClass}>
                  <option value="">None</option>
                  {linkedDeal && !dealOpts.some((d) => d.id === linkedDeal.id) && <option value={linkedDeal.id}>{linkedDeal.name}</option>}
                  {dealOpts.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.stage.replace(/_/g, " ").toLowerCase()}</option>)}
                </select>
              </Field>

              {depChoices.length > 0 && (
                <Field label="Can't start until…" hint="(it shows as Blocked until these are done)">
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-border divide-y divide-border/60">
                    {depChoices.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-primary/[0.03]">
                        <input
                          type="checkbox"
                          checked={form.dependsOn.includes(t.id)}
                          className="accent-[var(--color-accent)]"
                          onChange={(e) => set("dependsOn", e.target.checked ? [...form.dependsOn, t.id] : form.dependsOn.filter((x) => x !== t.id))}
                        />
                        <span className="flex-1 truncate text-foreground">{t.deliverable}</span>
                        <span className="text-xs text-muted">{t.status === "COMPLETED" ? "done" : t.bdo?.name ?? ""}</span>
                      </label>
                    ))}
                  </div>
                </Field>
              )}

              <div className="space-y-2">
                <div className={clsx("grid gap-3", form.currency === "GHS" ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
                  <Field label="Money spent">
                    <input type="number" min="0" value={form.expenseActual} onChange={(e) => set("expenseActual", e.target.value)} placeholder="0" className={inputClass} />
                  </Field>
                  <Field label="Money brought in">
                    <input
                      type="number"
                      min="0"
                      value={form.revenueActual}
                      onChange={(e) => set("revenueActual", e.target.value)}
                      disabled={!form.dealId && !form.revenueActual}
                      placeholder="0"
                      className={clsx(inputClass, "disabled:opacity-50")}
                    />
                  </Field>
                  <Field label="Currency">
                    <select value={form.currency} onChange={(e) => set("currency", e.target.value)} className={inputClass}>
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  {form.currency !== "GHS" && (
                    <Field label="Rate to GHS">
                      <input type="number" min="0" step="any" value={form.exchangeRate} onChange={(e) => set("exchangeRate", e.target.value)} placeholder="e.g. 15.2" className={inputClass} />
                    </Field>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {form.dealId
                    ? `When you mark this done${isBdo ? " and your Business CEO approves it" : ""}, the money brought in is added as a payment on ${linkedDeal?.name ?? "the deal"}. It counts toward revenue for the deal, the people on it, the company and the group. Reopen the task and it comes off again.`
                    : "To record money brought in, pick the deal it came from above."}
                </p>
              </div>

              <Field label="Notes" hint="(optional)">
                <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={clsx(inputClass, "resize-none")} />
              </Field>
            </MoreOptions>
          </>
        )}

        {error && (
          <p role="alert" className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-xl">
            {error}
          </p>
        )}
      </div>
    </KpiSheet>
  );
}