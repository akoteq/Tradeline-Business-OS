"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { X, Lock, Users, UserCheck, Phone, Mail, MessageCircle, CalendarClock } from "lucide-react";
import { api } from "@/lib/api";
import { PriorityBadge } from "@/components/Badges";
import { StatusBadge, VisibilityBadge } from "./badges";
import {
  EDITABLE_STATUSES, STATUS_COLORS, STATUS_LABEL, apiError, followUpInfo, formToBody, leadToForm, whatsappLink, type Lead,
} from "./lib";

const TONE = { late: "text-red-600", soon: "text-amber-700", ok: "text-foreground" };
const actionBtn = "inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-primary/5 transition-colors";

export function LeadDrawer({ lead, canEdit, canShare, onClose, onEdit, onChanged }: {
  lead: Lead; canEdit: boolean; canShare: boolean; onClose: () => void; onEdit: () => void; onChanged: (lead: Lead) => void;
}) {
  const isPublic = lead.visibility === "PUBLIC";
  const follow = followUpInfo(lead.followUpDate);
  const wa = whatsappLink(lead.phone);
  const [busy, setBusy] = useState<"" | "share" | "convert" | "stage">("");
  const [error, setError] = useState("");

  const run = async (kind: "share" | "convert" | "stage", job: () => Promise<Lead>, failure: string) => {
    setBusy(kind); setError("");
    try { onChanged(await job()); } catch (err) { setError(apiError(err, failure)); } finally { setBusy(""); }
  };

  const toggleShare = () => run("share", async () => {
    const { data } = await api.put(`/leads/${lead.id}/visibility`, { visibility: isPublic ? "PRIVATE" : "PUBLIC" });
    return data;
  }, "Couldn't change who can see this lead.");

  const convert = () => {
    if (!confirm(`Convert "${lead.businessName}" to a customer? It moves to your clients and this lead is archived.`)) return;
    run("convert", async () => (await api.post(`/leads/${lead.id}/convert`)).data.lead, "Couldn't convert this lead.");
  };

  const setStage = (status: string) => {
    if (status === lead.status) return;
    run("stage", async () => {
      const { data } = await api.put(`/leads/${lead.id}`, formToBody({ ...leadToForm(lead), status }, canShare));
      return { ...lead, ...(data?.id ? data : {}), status };
    }, "Couldn't move this lead to a new stage.");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-primary/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={lead.businessName} className="relative bg-surface w-full max-w-md h-full overflow-y-auto shadow-2xl border-l border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-serif text-xl text-foreground truncate">{lead.businessName}</h2>
            <p className="text-xs text-muted mt-0.5">{[lead.bizId, lead.contactPerson, lead.roleTitle].filter(Boolean).join(" · ") || "No contact added yet"}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity">Edit</button>}
            <button onClick={onClose} className="text-muted hover:text-foreground transition-colors" aria-label="Close"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
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
            <div className="rounded-xl border border-border bg-background px-3.5 py-3 flex items-center gap-3">
              <CalendarClock size={18} className="text-muted shrink-0" />
              <div className="min-w-0 flex-1">
                {follow ? (
                  <>
                    <div className={clsx("text-sm font-medium", TONE[follow.tone])}>Follow up: {follow.text}</div>
                    <div className="text-xs text-muted">{new Date(lead.followUpDate!).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</div>
                  </>
                ) : (
                  <div className="text-sm text-muted">No follow-up yet. Set one so this lead doesn&apos;t go cold.</div>
                )}
              </div>
              {canEdit && <button onClick={onEdit} className="text-xs font-medium text-accent hover:underline shrink-0">{follow ? "Change" : "Set one"}</button>}
            </div>
          )}

          {canEdit && !lead.archivedAt && (
            <div>
              <p className="text-xs font-medium text-muted mb-1.5">Move to</p>
              <div className="flex flex-wrap gap-1.5">
                {EDITABLE_STATUSES.map((s) => (
                  <button
                    key={s} onClick={() => setStage(s)} disabled={!!busy} aria-pressed={lead.status === s}
                    className={clsx(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors disabled:opacity-50",
                      lead.status === s ? `${STATUS_COLORS[s]} border-transparent` : "border-border text-muted hover:text-foreground hover:border-foreground/30",
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
            <div className="flex flex-col sm:flex-row gap-2">
              {canEdit && (
                <button onClick={convert} disabled={!!busy} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                  <UserCheck size={15} /> {busy === "convert" ? "Converting…" : "Convert to customer"}
                </button>
              )}
              {canShare && (
                <button onClick={toggleShare} disabled={!!busy} className={clsx(actionBtn, "disabled:opacity-50")}>
                  {isPublic ? <Lock size={15} /> : <Users size={15} />}
                  {busy === "share" ? "Saving…" : isPublic ? "Make private" : "Share with team"}
                </button>
              )}
            </div>
          )}
          {!lead.archivedAt && !canEdit && <p className="text-xs text-muted">Shared by your Business CEO. Only its owner can edit or convert it.</p>}
          {error && <p role="alert" className="text-red-600 text-sm bg-red-500/5 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Item label="Email" value={lead.email} />
            <Item label="Phone" value={lead.phone} />
            <Item label="Owner" value={lead.bdo?.name} />
            <Item label="Source" value={lead.source} />
            <Item label="Added" value={lead.dateAdded ? new Date(lead.dateAdded).toLocaleDateString() : null} />
          </dl>

          {lead.notes && (
            <div>
              <p className="text-xs font-medium text-muted mb-1.5">Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-background rounded-lg p-3 border border-border">{lead.notes}</p>
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
      <dt className="text-xs text-muted font-medium">{label}</dt>
      <dd className="text-foreground mt-0.5 break-words">{value ?? "—"}</dd>
    </div>
  );
}
