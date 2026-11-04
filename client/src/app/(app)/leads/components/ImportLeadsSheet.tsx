"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, ChevronDown, FileSpreadsheet, Loader2, Sparkles, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import { INDUSTRIES } from "@/lib/industries";
import { GHANA_REGIONS } from "@/lib/regions";
import { btnGhost, btnPrimary, btnSecondary, selectClass } from "./fields";
import type { DuplicateMatch } from "./DuplicateMatches";
import { EDITABLE_STATUSES, STATUS_LABEL, apiError, inDays, type BdoOption } from "./lib";

/**
 * Bulk import: upload a sheet laid out however it was kept, check what we made of it, then add
 * the rows you keep. The server reads the file and (when OpenAI is set up) has the model fit each
 * row to our fields; phone numbers and emails never go to the model. Nothing is saved until
 * "Import" — and then each row goes through the same checks as adding a lead by hand.
 */

type ImportedLead = {
  businessName: string; contactPerson: string | null; roleTitle: string | null; phone: string | null; email: string | null;
  industry: string | null; region: string | null; priority: string | null; status: string; source: string | null;
  followUpDate: string | null; notes: string | null;
};
type PreviewRow = {
  index: number; lead: ImportedLead;
  issues: { level: "error" | "warning"; text: string }[];
  duplicate: (DuplicateMatch & { blocking: boolean }) | null;
  duplicateInFile: boolean;
};
type Preview = { rows: PreviewRow[]; headers: string[]; mapping: Record<string, string[]>; usedAi: boolean; aiAvailable: boolean };
type Row = PreviewRow & { include: boolean };
type Result = { created: number; skipped: { index: number; name: string; reason: string }[] };

const FIELD_LABEL: Record<string, string> = {
  businessName: "Business name", contactPerson: "Contact person", roleTitle: "Role", phone: "Phone", email: "Email",
  industry: "Industry", region: "Region", priority: "Priority", status: "Stage", source: "Source", followUpDate: "Follow-up", notes: "Notes",
};
const QUICK: [number, string][] = [[1, "Tomorrow"], [3, "In 3 days"], [7, "Next week"]];
const cellInput = "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-foreground hover:border-border focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20";
const cellSelect = cellInput + " pr-6";

const isValid = (l: ImportedLead) => !!l.businessName.trim() && !!l.industry;
// What's wrong with a row now: the missing fields as it stands, plus the server's warnings
// (duplicates), which editing doesn't change.
const issuesOf = (r: PreviewRow) => [
  ...(!r.lead.businessName.trim() ? [{ level: "error" as const, text: "No business name" }] : []),
  ...(!r.lead.industry ? [{ level: "error" as const, text: "Pick an industry" }] : []),
  ...r.issues.filter((x) => x.level === "warning"),
];

export function ImportLeadsSheet({ bdos, canAssign, onClose, onImported }: {
  bdos: BdoOption[]; canAssign: boolean; onClose: () => void; onImported: () => void;
}) {
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [reading, setReading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [followUp, setFollowUp] = useState(inDays(3));
  const [owner, setOwner] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving && !reading) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving, reading]);

  const read = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) { setError("Upload a CSV or Excel file (.csv, .xlsx or .xls)."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("That file is over 5 MB. Split it into smaller sheets."); return; }
    setReading(file.name); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<Preview>("/leads/import/preview", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 180_000 });
      setPreview(data);
      setRows(data.rows.map((r) => ({ ...r, include: isValid(r.lead) && !r.duplicate?.blocking && !r.duplicateInFile })));
      setStep("review");
    } catch (err) {
      setError(apiError(err, "We couldn't read that file. Please try again."));
    } finally {
      setReading(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const edit = (index: number, patch: Partial<ImportedLead>) =>
    setRows((rs) => rs.map((r) => {
      if (r.index !== index) return r;
      const lead = { ...r.lead, ...patch };
      // Fixing the last problem ticks the row; emptying a required field unticks it.
      const include = isValid(lead) ? (isValid(r.lead) ? r.include : !r.duplicate?.blocking && !r.duplicateInFile) : false;
      return { ...r, lead, include };
    }));
  const toggle = (index: number) => setRows((rs) => rs.map((r) => (r.index === index && isValid(r.lead) ? { ...r, include: !r.include } : r)));

  const counts = useMemo(() => ({
    total: rows.length,
    selected: rows.filter((r) => r.include).length,
    broken: rows.filter((r) => !isValid(r.lead)).length,
    dupes: rows.filter((r) => r.duplicate || r.duplicateInFile).length,
  }), [rows]);
  const shown = onlyAttention ? rows.filter((r) => issuesOf(r).length > 0) : rows;
  const allShownOn = shown.filter((r) => isValid(r.lead)).every((r) => r.include);

  const commit = async () => {
    const chosen = rows.filter((r) => r.include && isValid(r.lead));
    if (!chosen.length) return;
    setSaving(true); setError("");
    try {
      const { data } = await api.post<Result>("/leads/import/commit", {
        followUpDate: followUp,
        bdoId: canAssign && owner ? owner : undefined,
        // A duplicate the person ticked means "add it anyway".
        rows: chosen.map((r) => ({ index: r.index, ...r.lead, allowDuplicate: !!r.duplicate?.blocking || r.duplicateInFile })),
      }, { timeout: 180_000 });
      setResult(data);
      setStep("done");
      if (data.created) onImported();
    } catch (err) {
      setError(apiError(err, "The import didn't finish. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || !!reading;
  const mappingList = preview ? Object.entries(preview.mapping).filter(([, cols]) => cols.length) : [];
  const unread = preview ? preview.headers.filter((h) => !mappingList.some(([, cols]) => cols.includes(h))) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={busy ? undefined : onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="Import leads" onClick={(e) => e.stopPropagation()}
        className={clsx("flex max-h-[94vh] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-xl sm:rounded-2xl", step === "review" ? "max-w-6xl" : "max-w-lg")}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-serif text-lg text-foreground">
              {step === "upload" ? "Import leads" : step === "review" ? "Check your leads" : "Import finished"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {step === "upload" && "Upload a spreadsheet. It doesn't need to match our columns. We'll sort that out."}
              {step === "review" && preview && (preview.usedAi
                ? "We fitted each row to our fields. Check the industry and region, fix anything flagged, then import."
                : "We matched your columns by their names. Check the industry and region carefully before importing.")}
              {step === "done" && "Here's what happened."}
            </p>
          </div>
          <button onClick={onClose} disabled={busy} className="shrink-0 rounded-lg p-1 text-muted transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-40" aria-label="Close"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "upload" && (
            <div className="space-y-4">
              <button
                type="button" onClick={() => fileInput.current?.click()} disabled={!!reading}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); read(e.dataTransfer.files?.[0]); }}
                className={clsx(
                  "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                  dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/50 hover:bg-foreground/[0.02]",
                )}
              >
                {reading ? (
                  <>
                    <Loader2 size={28} className="animate-spin text-accent" />
                    <span className="text-sm font-medium text-foreground">Reading {reading}…</span>
                    <span className="text-xs text-muted">Matching columns and tidying each row. A big sheet can take a minute.</span>
                  </>
                ) : (
                  <>
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent"><FileSpreadsheet size={22} /></span>
                    <span className="text-sm font-medium text-foreground">Drop a file here, or click to choose one</span>
                    <span className="text-xs text-muted">CSV or Excel (.csv, .xlsx, .xls) · up to 500 rows · 5 MB</span>
                  </>
                )}
              </button>
              <input ref={fileInput} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => read(e.target.files?.[0])} />
              <ul className="space-y-1.5 text-xs text-muted">
                <li className="flex gap-2"><Sparkles size={14} className="mt-px shrink-0 text-accent" />One lead per row, with a header row. Column names and order can be anything.</li>
                <li className="flex gap-2"><Sparkles size={14} className="mt-px shrink-0 text-accent" />We work out the industry, the region (from a town too) and dates. Columns we can&apos;t place go into the notes.</li>
                <li className="flex gap-2"><Sparkles size={14} className="mt-px shrink-0 text-accent" />Phone numbers and emails stay on our servers. They&apos;re never sent to the AI.</li>
              </ul>
            </div>
          )}

          {step === "review" && preview && (
            <div className="space-y-4">
              {/* Summary + defaults */}
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-background px-4 py-3 text-sm">
                  <span><strong className="tabular-nums text-foreground">{counts.total}</strong> <span className="text-muted">rows read</span></span>
                  <span className="text-emerald-700"><strong className="tabular-nums">{counts.selected}</strong> ready to import</span>
                  {counts.broken > 0 && <span className="text-red-600"><strong className="tabular-nums">{counts.broken}</strong> need fixing</span>}
                  {counts.dupes > 0 && <span className="text-amber-700"><strong className="tabular-nums">{counts.dupes}</strong> possible duplicates (unticked; tick to add anyway)</span>}
                  {!preview.usedAi && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <AlertTriangle size={12} /> {preview.aiAvailable ? "AI clean-up didn't run this time" : "AI clean-up isn't set up"}, so values were matched by rules.
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted">Follow up rows without a date:</span>
                    <button
                      type="button" onClick={() => setFollowUp("")} aria-pressed={!followUp}
                      className={clsx("rounded-full border px-2.5 py-1 text-xs", !followUp ? "border-accent bg-accent/10 font-medium text-foreground" : "border-border text-muted hover:text-foreground")}
                    >Not yet</button>
                    {QUICK.map(([d, label]) => (
                      <button
                        key={d} type="button" onClick={() => setFollowUp(inDays(d))} aria-pressed={followUp === inDays(d)}
                        className={clsx("rounded-full border px-2.5 py-1 text-xs", followUp === inDays(d) ? "border-accent bg-accent/10 font-medium text-foreground" : "border-border text-muted hover:text-foreground")}
                      >{label}</button>
                    ))}
                    <input type="date" value={followUp} min={inDays(0)} onChange={(e) => setFollowUp(e.target.value)} aria-label="Default follow-up date" className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground" />
                  </div>
                  {canAssign && (
                    <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner for imported leads" className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground">
                      <option value="">Owner: nobody yet</option>
                      {bdos.map((b) => <option key={b.id} value={b.id}>Owner: {b.name} ({b.company})</option>)}
                    </select>
                  )}
                </div>
              </div>

              {/* How the columns were read */}
              <div className="rounded-xl border border-border">
                <button type="button" onClick={() => setShowMapping((s) => !s)} aria-expanded={showMapping} className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-muted hover:text-foreground">
                  How we read your columns
                  <ChevronDown size={16} className={clsx("transition-transform", showMapping && "rotate-180")} />
                </button>
                {showMapping && (
                  <div className="grid gap-x-6 gap-y-1.5 border-t border-border px-4 py-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    {mappingList.map(([field, cols]) => (
                      <div key={field} className="flex gap-2">
                        <span className="w-28 shrink-0 text-muted">{FIELD_LABEL[field] ?? field}</span>
                        <span className="min-w-0 text-foreground">{cols.join(", ")}</span>
                      </div>
                    ))}
                    {unread.length > 0 && (
                      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                        <span className="w-28 shrink-0 text-muted">Kept in notes</span>
                        <span className="min-w-0 text-foreground">{unread.join(", ")}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="inline-flex cursor-pointer items-center gap-2 text-muted">
                  <input type="checkbox" checked={onlyAttention} onChange={(e) => setOnlyAttention(e.target.checked)} className="accent-[var(--color-accent)]" />
                  Only show rows that need a look
                </label>
                <span className="text-xs text-muted">Click a cell to edit it.</span>
              </div>

              {/* Rows */}
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-background text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <tr className="border-b border-border">
                      <th className="w-10 px-3 py-2">
                        <input
                          type="checkbox" aria-label="Select all shown rows" checked={allShownOn} className="accent-[var(--color-accent)]"
                          onChange={() => setRows((rs) => rs.map((r) => (shown.includes(r) && isValid(r.lead) ? { ...r, include: !allShownOn } : r)))}
                        />
                      </th>
                      <th className="min-w-[220px] px-2 py-2">Business</th>
                      <th className="min-w-[200px] px-2 py-2">Industry</th>
                      <th className="min-w-[140px] px-2 py-2">Region</th>
                      <th className="min-w-[120px] px-2 py-2">Stage</th>
                      <th className="min-w-[140px] px-2 py-2">Follow-up</th>
                      <th className="min-w-[170px] px-2 py-2">Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {shown.map((r) => {
                      const l = r.lead;
                      const valid = isValid(l);
                      const contact = [l.contactPerson, l.phone, l.email].filter(Boolean).join(" · ");
                      return (
                        <tr key={r.index} className={clsx("align-top", !r.include && "bg-foreground/[0.02]", !valid && "bg-red-500/[0.03]")}>
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox" checked={r.include} disabled={!valid} onChange={() => toggle(r.index)}
                              aria-label={`Import ${l.businessName || `row ${r.index + 1}`}`} className="accent-[var(--color-accent)] disabled:opacity-40"
                              title={!valid ? "Fix this row first" : r.duplicate?.blocking || r.duplicateInFile ? "Tick to add it anyway" : undefined}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input value={l.businessName} onChange={(e) => edit(r.index, { businessName: e.target.value })} placeholder="Business name" className={clsx(cellInput, "font-medium", !l.businessName.trim() && "border-red-300")} />
                            <p className="truncate px-2 text-xs text-muted" title={contact}>{contact || <span className="text-muted/60">No contact details</span>}</p>
                          </td>
                          <td className="px-2 py-1">
                            <select value={l.industry ?? ""} onChange={(e) => edit(r.index, { industry: e.target.value || null })} className={clsx(cellSelect, !l.industry && "border-red-300 text-red-600")}>
                              <option value="">Pick an industry…</option>
                              {INDUSTRIES.map((x) => <option key={x} value={x}>{x}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <select value={l.region ?? ""} onChange={(e) => edit(r.index, { region: e.target.value || null })} className={clsx(cellSelect, !l.region && "text-muted")}>
                              <option value="">Not sure</option>
                              {GHANA_REGIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <select value={l.status} onChange={(e) => edit(r.index, { status: e.target.value })} className={cellSelect}>
                              {EDITABLE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="date" value={l.followUpDate ?? ""} onChange={(e) => edit(r.index, { followUpDate: e.target.value || null })}
                              className={clsx(cellInput, !l.followUpDate && "text-muted")} aria-label="Follow-up date" title={l.followUpDate ? undefined : "Uses the date picked above"}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-1">
                              {issuesOf(r).length === 0 && <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={12} /> Looks good</span>}
                              {issuesOf(r).map((x, i) => (
                                <span key={i} className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", x.level === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800")}>{x.text}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!shown.length && (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">Nothing needs a look. Every row is ready.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-500/5 px-4 py-3">
                <CheckCircle2 size={22} className="shrink-0 text-emerald-600" />
                <p className="text-sm text-foreground">
                  <strong>{result.created}</strong> {result.created === 1 ? "lead" : "leads"} added.
                  {result.skipped.length > 0 && <> {result.skipped.length} skipped.</>}
                </p>
              </div>
              {result.skipped.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Skipped</p>
                  <ul className="max-h-64 divide-y divide-border/70 overflow-y-auto rounded-xl border border-border text-sm">
                    {result.skipped.map((s) => (
                      <li key={s.index} className="flex items-center justify-between gap-3 px-4 py-2">
                        <span className="min-w-0 truncate text-foreground">{s.name}</span>
                        <span className="shrink-0 text-xs text-muted">{s.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-500/5 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          {step === "upload" && <button onClick={onClose} disabled={!!reading} className={btnSecondary}>Cancel</button>}
          {step === "review" && (
            <>
              <span className="mr-auto text-xs text-muted">{counts.selected} of {counts.total} rows selected</span>
              <button onClick={() => { setStep("upload"); setPreview(null); setRows([]); setError(""); }} disabled={saving} className={btnGhost}>
                <Upload size={14} className="mr-1 inline" /> Different file
              </button>
              <button onClick={commit} disabled={saving || counts.selected === 0} className={btnPrimary}>
                {saving ? "Importing…" : `Import ${counts.selected} ${counts.selected === 1 ? "lead" : "leads"}`}
              </button>
            </>
          )}
          {step === "done" && <button onClick={onClose} className={btnPrimary}>Done</button>}
        </div>
      </div>
    </div>
  );
}
