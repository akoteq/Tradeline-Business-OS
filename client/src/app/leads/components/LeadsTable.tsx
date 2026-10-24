"use client";

import { clsx } from "clsx";
import { DataTable } from "@/components/DataTable";
import { PriorityBadge } from "@/components/Badges";
import type { AuthUser } from "@/lib/auth";
import { StatusBadge, VisibilityBadge } from "./badges";
import { PAGE_SIZE, SOURCES, canEditLead, followUpInfo, type BdoOption, type Lead } from "./lib";

export type Filters = { status: string; bdo: string; priority: string; source: string; visibility: string };

const selectClass = "text-sm bg-surface border border-border rounded-full px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40";
const TONE = { late: "text-red-600 font-medium", soon: "text-amber-700 font-medium", ok: "text-foreground" };

export function LeadsTable({
  leads, total, isLoading, page, onPage, filters, onFilter, onClear, bdos, user, onAdd, onEdit, onOpen, onDelete,
}: {
  leads: Lead[]; total: number; isLoading: boolean; page: number; onPage: (p: number) => void;
  filters: Filters; onFilter: (key: keyof Filters, value: string) => void; onClear: () => void;
  bdos: BdoOption[]; user: AuthUser | null;
  onAdd: () => void; onEdit: (l: Lead) => void; onOpen: (l: Lead) => void; onDelete: (l: Lead) => void;
}) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const anyFilter = Object.values(filters).some(Boolean);

  const columns = [
    {
      key: "businessName", label: "Business", sortable: true,
      render: (r: Lead) => (
        <button onClick={() => onOpen(r)} className="text-left group max-w-[200px] block">
          <span className="block font-medium text-foreground group-hover:text-accent transition-colors truncate">{r.businessName}</span>
          {r.bizId && <span className="block text-[11px] text-muted">{r.bizId}</span>}
        </button>
      ),
      exportValue: (r: Lead) => r.businessName,
    },
    { key: "contactPerson", label: "Contact", render: (r: Lead) => r.contactPerson ?? "—" },
    { key: "roleTitle", label: "Role", render: (r: Lead) => r.roleTitle ?? "—" },
    { key: "email", label: "Email", render: (r: Lead) => r.email ?? "—" },
    { key: "phone", label: "Phone", render: (r: Lead) => r.phone ? <span className="whitespace-nowrap">{r.phone}</span> : "—" },
    { key: "status", label: "Stage", render: (r: Lead) => <StatusBadge value={r.status} />, sortable: true },
    {
      key: "followUpDate", label: "Follow up",
      render: (r: Lead) => {
        const f = followUpInfo(r.followUpDate);
        return f ? <span className={clsx("whitespace-nowrap", TONE[f.tone])}>{f.text}</span> : <span className="text-muted">—</span>;
      },
      exportValue: (r: Lead) => (r.followUpDate ? new Date(r.followUpDate).toLocaleDateString() : ""),
    },
    {
      key: "priority", label: "Priority", sortable: true,
      render: (r: Lead) => r.priority ? <PriorityBadge value={r.priority} /> : <span className="text-muted">—</span>,
    },
    { key: "bdo", label: "Owner", render: (r: Lead) => r.bdo?.name ?? "—" },
    {
      key: "visibility", label: "Visibility", render: (r: Lead) => <VisibilityBadge value={r.visibility} />,
      exportValue: (r: Lead) => (r.visibility === "PUBLIC" ? "Shared" : "Private"),
    },
    { key: "source", label: "Source", render: (r: Lead) => r.source ?? "—" },
    {
      key: "notes", label: "Notes",
      render: (r: Lead) => r.notes ? <span title={r.notes} className="text-muted text-xs truncate max-w-[180px] block">{r.notes}</span> : <span className="text-muted">—</span>,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={leads}
        isLoading={isLoading}
        title={`${total.toLocaleString()} ${total === 1 ? "lead" : "leads"}`}
        onAdd={onAdd}
        onEdit={onEdit}
        canEditRow={(row: Lead) => canEditLead(user, row)}
        onDelete={onDelete}
        filterBar={
          <div className="flex gap-2 flex-wrap items-center">
            <select value={filters.priority} onChange={(e) => onFilter("priority", e.target.value)} className={selectClass} aria-label="Priority">
              <option value="">Any priority</option>
              <option value="HIGH">High priority</option>
              <option value="MEDIUM">Medium priority</option>
              <option value="LOW">Low priority</option>
            </select>
            <select value={filters.visibility} onChange={(e) => onFilter("visibility", e.target.value)} className={selectClass} aria-label="Visibility">
              <option value="">Private and shared</option>
              <option value="PRIVATE">Private only</option>
              <option value="PUBLIC">Shared only</option>
            </select>
            <select value={filters.bdo} onChange={(e) => onFilter("bdo", e.target.value)} className={selectClass} aria-label="Owner">
              <option value="">Any owner</option>
              {bdos.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
            <select value={filters.source} onChange={(e) => onFilter("source", e.target.value)} className={selectClass} aria-label="Source">
              <option value="">Any source</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {anyFilter && <button onClick={onClear} className="text-sm text-muted hover:text-accent transition-colors px-1">Clear filters</button>}
          </div>
        }
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 mt-4">
          <span className="text-sm text-muted">
            Showing {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}
          </span>
          <div className="flex gap-2 items-center">
            <button onClick={() => onPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 text-foreground hover:bg-primary/5 transition-colors">Previous</button>
            <span className="px-2 text-sm text-muted">Page {page + 1} of {totalPages}</span>
            <button onClick={() => onPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 text-foreground hover:bg-primary/5 transition-colors">Next</button>
          </div>
        </div>
      )}
    </>
  );
}
