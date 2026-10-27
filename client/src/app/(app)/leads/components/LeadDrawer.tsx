"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Building2, CalendarClock, Lock, Mail, MessageCircle, Pencil, Phone, UserCheck, Users, X } from "lucide-react";
import { PriorityBadge } from "@/components/Badges";
import { StatusBadge, VisibilityBadge } from "./badges";
import type { LeadActions } from "./useLeadActions";
import { EDITABLE_STATUSES, STAGE_RING, STATUS_COLORS, STATUS_LABEL, apiError, followUpInfo, whatsappLink, type Lead } from "./lib";

/**
 * A lead's details, in a side panel styled like the rest of the app's sheets: the business up
 * top, then what to do next (contact, follow-up, stage), then the record itself. Actions that
 * change the lead sit in a footer that stays put while the panel scrolls.
 */

const TONE = {
  late: { text: "text-red-600", card: "border-red-200 bg-red-500/[0.04]", icon: "bg-red-500/10 text-red-600" },
  soon: { text: "text-amber-700", card: "border-amber-200 bg-amber-500/[0.05]", icon: "bg-amber-500/10 text-amber-700" },
  ok: { text: "text-foreground", card: "border-border bg-background", icon: "bg-accent/10 text-accent" },
};
const pillBtn = "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent/40 hover:text-accent";
const fmtDate = (v: string, opts: Intl.DateTimeFormatOptions) => new Date(v).toLocaleDateString("en-GH", opts);

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function LeadDrawer({ lead, canEdit, canShare, actions, onClose, onEdit, onChanged }: {
  lead: Lead; canEdit: boolean; canShare: boolean; actions: LeadActions;
  onClose: () => void; onEdit: () => void; onChanged: (lead: Lead) => void;
}) {
  const isPublic = lead.visibility === "PUBLIC";
  const closed = !!lead.archivedAt;
  const follow = followUpInfo(lead.followUpDate);
  const tone = TONE[follow?.tone ?? "ok"];
  const wa = whatsappLink(lead.phone);
  const added = lead.dateAdded || lead.createdAt;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (job: () => Promise<Lead | null>, failure: string) => {
    setBusy(true); setError("");
    try { const updated = await job(); if (updated) onChanged(updated); }
    catch (err) { setError(apiError(err, failure)); }
    finally { setBusy(false); }
  };

  const details: [string, ReactNode][] = [
    ["Industry", lead.industry],
    ["Region", lead.region],
    ["Contact", lead.contactPerson],
    ["Role", lead.roleTitle],
    ["Phone", lead.phone && <a href={`tel:${lead.phone}`} className="hover:text-accent hover:underline">{lead.phone}</a>],
    ["Email", lead.email && <a href={`mailto:${lead.email}`} className="break-all hover:text-accent hover:underline">{lead.email}</a>],
    ["Owner", lead.bdo?.name ?? "Unassigned"],
    ["Source", lead.source],
    ["Added", added && fmtDate(added, { day: "numeric", month: "short", year: "numeric" })],
    ["Biz ID", lead.bizId],
  ];
  const showFooter = !closed && (canEdit || canShare);
  const history = lead.stageHistory ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-primary/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={lead.businessName} className="relative flex h-full w-full max-w-lg flex-col border-l border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><Building2 size={20} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-xl leading-tight text-foreground">{lead.businessName}</h2>
              <p className="mt-0.5 truncate text-xs text-muted">
                {[lead.contactPerson, lead.roleTitle].filter(Boolean).join(" · ") || "No contact added yet"}
              </p>
            </div>
            <button onClick={onClose} className="-mr-1 rounded-lg p-1 text-muted transition-colors hover:bg-foreground/5 hover:text-foreground" aria-label="Close"><X size={18} /></button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-14">
            <StatusBadge value={lead.status} />
            {lead.priority && <PriorityBadge value={lead.priority} />}
            <VisibilityBadge value={lead.visibility} />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {closed && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-500/5 px-4 py-3 text-sm text-foreground">
              Converted to a customer on {fmtDate(lead.convertedAt ?? lead.archivedAt!, { day: "numeric", month: "short", year: "numeric" })}. This lead is archived.{" "}
              <Link href="/sme" className="font-medium text-accent hover:underline">View clients</Link>
            </div>
          )}

          {(lead.phone || lead.email) && (
            <div className="flex flex-wrap gap-2">
              {lead.phone && <a href={`tel:${lead.phone}`} className={pillBtn}><Phone size={14} /> Call</a>}
              {wa && <a href={wa} target="_blank" rel="noreferrer" className={pillBtn}><MessageCircle size={14} /> WhatsApp</a>}
              {lead.email && <a href={`mailto:${lead.email}`} className={pillBtn}><Mail size={14} /> Email</a>}
            </div>
          )}

          {!closed && (
            <Section title="Next follow-up">
              <div className={clsx("flex items-center gap-3 rounded-xl border px-4 py-3", tone.card)}>
                <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-lg", tone.icon)}><CalendarClock size={18} /></span>
                <div className="min-w-0 flex-1">
                  {follow ? (
                    <>
                      <p className={clsx("text-sm font-semibold", tone.text)}>{follow.text}</p>
                      <p className="text-xs text-muted">{fmtDate(lead.followUpDate!, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted">No follow-up yet. Set one so this lead doesn&apos;t go cold.</p>
                  )}
                </div>
                {canEdit && (
                  <button onClick={onEdit} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10">
                    {follow ? "Change" : "Set one"}
                  </button>
                )}
              </div>
            </Section>
          )}

          {canEdit && !closed && (
            <Section title="Stage">
              <div className="flex flex-wrap gap-1.5">
                {EDITABLE_STATUSES.map((s) => (
                  <button
                    key={s} onClick={() => lead.status !== s && run(() => actions.stage(lead, s), "Couldn't move this lead to a new stage.")}
                    disabled={busy} aria-pressed={lead.status === s}
                    className={clsx(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                      lead.status === s ? `${STATUS_COLORS[s]} border-transparent` : "border-border text-muted hover:border-foreground/30 hover:text-foreground",
                    )}
                  >{STATUS_LABEL[s]}</button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Stage history">
            {history.length ? (
              <ol className="relative space-y-3 border-l border-border pl-5 ml-1.5">
                {history.map((h, i) => (
                  <li key={`${h.status}-${h.at}-${i}`} className="relative">
                    {/* Dot in the stage's colour (bg-current takes the text colour from STAGE_RING) */}
                    <span className={clsx("absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-current ring-4 ring-surface", STAGE_RING[h.status] ?? "text-zinc-400")} aria-hidden />
                    <p className="text-sm font-medium text-foreground">{STATUS_LABEL[h.status] ?? h.status}</p>
                    <p className="text-xs text-muted">
                      <time dateTime={h.at}>{fmtDate(h.at, { day: "numeric", month: "short", year: "numeric" })}, {new Date(h.at).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}</time>
                      {h.byName && <> · {h.byName}</>}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
                Stage changes are recorded from 27 Oct 2026. The next time this lead moves, the date shows here.
              </p>
            )}
          </Section>

          <Section title="Details">
            <dl className="divide-y divide-border/70 rounded-xl border border-border">
              {details.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-3 px-4 py-2.5 text-sm">
                  <dt className="text-muted">{label}</dt>
                  <dd className={clsx("min-w-0 break-words", value ? "text-foreground" : "text-muted/60")}>{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Notes" aside={canEdit && !closed && <button onClick={onEdit} className="text-xs font-medium text-accent hover:underline">{lead.notes ? "Edit" : "Add notes"}</button>}>
            {lead.notes
              ? <p className="whitespace-pre-wrap rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground">{lead.notes}</p>
              : <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">Nothing written down yet.</p>}
          </Section>

          {!closed && !canEdit && <p className="text-xs text-muted">Shared by your Business CEO. Only its owner can edit or convert it.</p>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-500/5 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer: the actions that change the lead */}
        {showFooter && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-5 py-3">
            {canShare && (
              <button
                onClick={() => run(() => actions.visibility(lead), "Couldn't change who can see this lead.")} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/5 disabled:opacity-50"
              >
                {isPublic ? <Lock size={15} /> : <Users size={15} />}
                {isPublic ? "Make private" : "Share with team"}
              </button>
            )}
            <div className="ml-auto flex gap-2">
              {canEdit && (
                <button
                  onClick={() => run(() => actions.convert(lead), "Couldn't convert this lead.")} disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-500/5 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  <UserCheck size={15} /> Convert
                </button>
              )}
              {canEdit && (
                <button onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90">
                  <Pencil size={14} /> Edit lead
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
