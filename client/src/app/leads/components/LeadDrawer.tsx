"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { X, Lock, Users, UserCheck, Phone, Mail, MessageCircle, CalendarClock } from "lucide-react";
import { PriorityBadge } from "@/components/Badges";
import { StatusBadge, VisibilityBadge } from "./badges";
import type { LeadActions } from "./useLeadActions";
import { EDITABLE_STATUSES, STATUS_COLORS, STATUS_LABEL, apiError, followUpInfo, whatsappLink, type Lead } from "./lib";

const TONE = { late: "text-red-600", soon: "text-amber-700", ok: "text-foreground" };
const actionBtn = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-subtle/50";

export function LeadDrawer({ lead, canEdit, canShare, actions, onClose, onEdit, onChanged }: {
  lead: Lead; canEdit: boolean; canShare: boolean; actions: LeadActions;
  onClose: () => void; onEdit: () => void; onChanged: (lead: Lead) => void;
}) {
  const isPublic = lead.visibility === "PUBLIC";
  const follow = followUpInfo(lead.followUpDate);
  const wa = whatsappLink(lead.phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (job: () => Promise<Lead | null>, failure: string) => {
    setBusy(true); setError("");
    try { const updated = await job(); if (updated) onChanged(updated); }
    catch (err) { setError(apiError(err, failure)); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-primary/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={lead.businessName} className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">{lead.businessName}</h2>
            <p className="mt-0.5 text-xs text-muted">{[lead.bizId, lead.contactPerson, lead.roleTitle].filter(Boolean).join(" · ") || "No contact added yet"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canEdit && <button onClick={onEdit} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90">Edit</button>}
            <button onClick={onClose} className="text-muted transition-colors hover:text-foreground" aria-label="Close"><X size={18} /></button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={lead.status} />
            <VisibilityBadge value={lead.visibility} />
            {lead.priority && <PriorityBadge value={lead.priority} />}
          </div>

          {(lead.phone || lead.email) && (
            <div className="flex flex-wrap gap-2">
              {lead.phone && <a href={`tel:${lead.phone}`} className={actionBtn}><Phone size={15} /> Call</a>}
              {wa && <a href={wa} target="_blank" rel="noreferrer" className={actionBtn}><MessageCircle size={15} /> WhatsApp</a>}
              {lead.email && <a href={`mailto:${lead.email}`} className={actionBtn}><Mail size={15} /> Email</a>}
            </div>
          )}

          {!lead.archivedAt && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
              <CalendarClock size={18} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                {follow ? (
                  <>
                    <div className={clsx("text-sm font-medium", TONE[follow.tone])}>Follow up: {follow.text}</div>
                    <div className="text-xs text-muted">{new Date(lead.followUpDate!).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</div>
                  </>
                ) : <div className="text-sm text-muted">No follow-up yet. Set one so this lead doesn&apos;t go cold.</div>}
              </div>
              {canEdit && <button onClick={onEdit} className="shrink-0 text-xs font-medium text-accent hover:underline">{follow ? "Change" : "Set one"}</button>}
            </div>
          )}

          {canEdit && !lead.archivedAt && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Move to</p>
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
            </div>
          )}

          {lead.archivedAt ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-500/5 px-3 py-2.5 text-sm text-foreground">
              Converted to a customer on {new Date(lead.convertedAt ?? lead.archivedAt).toLocaleDateString()}. This lead is archived.{" "}
              <Link href="/sme" className="font-medium text-accent hover:underline">View clients</Link>
            </div>
          ) : (canEdit || canShare) && (
            <div className="flex flex-col gap-2 sm:flex-row">
              {canEdit && (
                <button onClick={() => run(() => actions.convert(lead), "Couldn't convert this lead.")} disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                  <UserCheck size={15} /> Convert to customer
                </button>
              )}
              {canShare && (
                <button onClick={() => run(() => actions.visibility(lead), "Couldn't change who can see this lead.")} disabled={busy} className={clsx(actionBtn, "disabled:opacity-50")}>
                  {isPublic ? <Lock size={15} /> : <Users size={15} />}
                  {isPublic ? "Make private" : "Share with team"}
                </button>
              )}
            </div>
          )}
          {!lead.archivedAt && !canEdit && <p className="text-xs text-muted">Shared by your Business CEO. Only its owner can edit or convert it.</p>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-500/5 px-3 py-2 text-sm text-red-600">{error}</p>}

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Item label="Email" value={lead.email} />
            <Item label="Phone" value={lead.phone} />
            <Item label="Owner" value={lead.bdo?.name} />
            <Item label="Source" value={lead.source} />
            <Item label="Added" value={lead.dateAdded ? new Date(lead.dateAdded).toLocaleDateString() : null} />
          </dl>

          {lead.notes && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Notes</p>
              <p className="whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-relaxed text-foreground">{lead.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-foreground">{value ?? "—"}</dd>
    </div>
  );
}
