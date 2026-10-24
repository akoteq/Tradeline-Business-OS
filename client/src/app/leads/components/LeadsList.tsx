"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { ArrowRight } from "lucide-react";
import { LeadRow, type RowHandlers } from "./LeadRow";
import { GROUPS, PAGE_SIZE, groupOf, type GroupKey, type Lead } from "./lib";

const PREVIEW = 5;

function Skeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
          <div className="h-9 w-9 animate-pulse rounded-full bg-foreground/5" />
          <div className="flex-1 space-y-1.5"><div className="h-3 w-48 animate-pulse rounded bg-foreground/5" /><div className="h-3 w-28 animate-pulse rounded bg-foreground/5" /></div>
        </div>
      ))}
    </div>
  );
}

export function LeadsList({
  leads, isLoading, total, page, onPage, anyFilter, onClear, onAdd, canEdit, canShare, h,
}: {
  leads: Lead[]; isLoading: boolean; total: number; page: number; onPage: (p: number) => void;
  anyFilter: boolean; onClear: () => void; onAdd: () => void;
  canEdit: (l: Lead) => boolean; canShare: boolean; h: RowHandlers;
}) {
  const [expanded, setExpanded] = useState<Set<GroupKey>>(new Set());
  const toggle = (k: GroupKey) => setExpanded((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (isLoading) return <Skeleton />;

  if (leads.length === 0) {
    const none = total === 0 && !anyFilter;
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
        <p className="text-sm font-semibold text-foreground">{none ? "No leads yet" : "No leads match"}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{none ? "Add your first prospect to start filling the pipeline." : "Try a different search, or clear the filters."}</p>
        <div className="mt-4 flex justify-center">
          {none
            ? <button onClick={onAdd} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">Add a lead</button>
            : <button onClick={onClear} className="text-sm font-medium text-accent hover:underline">Clear filters</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {GROUPS.map((g) => {
        const rows = leads.filter((l) => groupOf(l) === g.key);
        if (!rows.length) return null;
        const open = expanded.has(g.key);
        const shown = open ? rows : rows.slice(0, PREVIEW);
        return (
          <section key={g.key} className="overflow-hidden rounded-xl border border-border bg-surface">
            <header className={clsx("flex items-center gap-3 border-b border-border px-4 py-3", g.head)}>
              <span className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-full", g.icon)}><g.Icon size={15} /></span>
              <h2 className={clsx("text-sm font-semibold", g.text)}>{g.title}</h2>
              <span className="text-xs text-muted">{rows.length} {rows.length === 1 ? "lead" : "leads"}</span>
              {rows.length > PREVIEW && (
                <button onClick={() => toggle(g.key)} className="group ml-auto inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                  {open ? "Show less" : `View all ${rows.length}`}
                  {!open && <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />}
                </button>
              )}
            </header>
            <ul className="divide-y divide-border">
              {shown.map((l) => <LeadRow key={l.id} lead={l} iconTone={g.icon} canEdit={canEdit(l)} canShare={canShare} h={h} />)}
            </ul>
          </section>
        );
      })}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="text-muted">Showing {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => onPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded-lg border border-border px-3 py-1.5 text-foreground transition-colors hover:bg-subtle/50 disabled:opacity-40">Previous</button>
            <span className="px-1 text-muted">Page {page + 1} of {totalPages}</span>
            <button onClick={() => onPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-border px-3 py-1.5 text-foreground transition-colors hover:bg-subtle/50 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
