"use client";

import { clsx } from "clsx";
import { Building2, CalendarDays, ChevronDown, Lock, MessageCircle, MoreHorizontal, Pencil, Phone, Trash2, UserCheck, Users, Eye } from "lucide-react";
import { PriorityBadge } from "@/components/Badges";
import { Menu, MenuItem } from "./Menu";
import { StatusBadge } from "./badges";
import { EDITABLE_STATUSES, STATUS_COLORS, STATUS_LABEL, followUpInfo, initials, whatsappLink, type Lead } from "./lib";

const TONE = { late: "text-red-600 font-medium", soon: "text-amber-700 font-medium", ok: "text-foreground/80" };

export type RowHandlers = {
  onOpen: (l: Lead) => void; onEdit: (l: Lead) => void; onStage: (l: Lead, s: string) => void;
  onConvert: (l: Lead) => void; onShare: (l: Lead) => void; onDelete: (l: Lead) => void;
};

export function LeadRow({ lead: l, iconTone, canEdit, canShare, h }: { lead: Lead; iconTone: string; canEdit: boolean; canShare: boolean; h: RowHandlers }) {
  const f = followUpInfo(l.followUpDate);
  const wa = whatsappLink(l.phone);
  const sub = [l.contactPerson, l.roleTitle].filter(Boolean).join(" · ") || l.phone || l.email || "No contact yet";
  const closed = !!l.archivedAt;

  return (
    <li onClick={() => h.onOpen(l)} className="group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-subtle/50">
      <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full", iconTone)}><Building2 size={16} /></span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <button onClick={(e) => { e.stopPropagation(); h.onOpen(l); }} className="truncate text-left text-sm font-medium text-foreground transition-colors group-hover:text-accent">
            {l.businessName}
          </button>
          {l.visibility === "PUBLIC"
            ? <span title="Shared with the team" className="shrink-0 text-sky-600"><Users size={12} /></span>
            : <span title="Private" className="shrink-0 text-muted/60"><Lock size={11} /></span>}
        </div>
        <div className="truncate text-xs text-muted">
          {sub}
          {f && <span className={clsx("sm:hidden", TONE[f.tone])}> · {f.text}</span>}
        </div>
      </div>

      <div className="hidden w-20 shrink-0 md:block">{l.priority ? <PriorityBadge value={l.priority} /> : <span className="text-muted/60">—</span>}</div>

      <div className="hidden w-32 shrink-0 items-center gap-2 lg:flex">
        {l.bdo ? (
          <>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-xs font-medium text-foreground/70">{initials(l.bdo.name)}</span>
            <span className="truncate text-sm text-foreground">{l.bdo.name}</span>
          </>
        ) : <span className="text-sm text-muted">Unassigned</span>}
      </div>

      <div className="hidden w-36 shrink-0 items-center gap-1.5 text-sm sm:flex">
        <CalendarDays size={14} className="shrink-0 text-muted" />
        {f ? <span className={clsx("truncate", TONE[f.tone])}>{f.text}</span> : <span className="text-muted">—</span>}
      </div>

      <div className="w-32 shrink-0" onClick={(e) => e.stopPropagation()}>
        {canEdit && !closed ? (
          <Menu width={170} trigger={({ toggle }) => (
            <button onClick={toggle} title="Change stage" className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", STATUS_COLORS[l.status])}>
              {STATUS_LABEL[l.status] ?? l.status} <ChevronDown size={12} />
            </button>
          )}>
            {(close) => EDITABLE_STATUSES.map((s) => (
              <MenuItem key={s} active={l.status === s} onClick={() => { close(); if (s !== l.status) h.onStage(l, s); }}>{STATUS_LABEL[s]}</MenuItem>
            ))}
          </Menu>
        ) : <StatusBadge value={l.status} />}
      </div>

      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <Menu width={210} trigger={({ toggle }) => (
          <button onClick={toggle} title="More actions" aria-label="More actions" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-accent/10 hover:text-accent"><MoreHorizontal size={16} /></button>
        )}>
          {(close) => (
            <>
              <MenuItem icon={<Eye size={14} />} onClick={() => { close(); h.onOpen(l); }}>View details</MenuItem>
              {canEdit && <MenuItem icon={<Pencil size={14} />} onClick={() => { close(); h.onEdit(l); }}>Edit lead</MenuItem>}
              {l.phone && <MenuItem icon={<Phone size={14} />} onClick={() => { close(); window.location.href = `tel:${l.phone}`; }}>Call</MenuItem>}
              {wa && <MenuItem icon={<MessageCircle size={14} />} onClick={() => { close(); window.open(wa, "_blank", "noopener"); }}>WhatsApp</MenuItem>}
              {canEdit && !closed && <MenuItem icon={<UserCheck size={14} />} onClick={() => { close(); h.onConvert(l); }}>Convert to customer</MenuItem>}
              {canShare && !closed && (
                <MenuItem icon={l.visibility === "PUBLIC" ? <Lock size={14} /> : <Users size={14} />} onClick={() => { close(); h.onShare(l); }}>
                  {l.visibility === "PUBLIC" ? "Make private" : "Share with team"}
                </MenuItem>
              )}
              {canEdit && <MenuItem icon={<Trash2 size={14} />} danger onClick={() => { close(); h.onDelete(l); }}>Delete</MenuItem>}
            </>
          )}
        </Menu>
      </div>
    </li>
  );
}
