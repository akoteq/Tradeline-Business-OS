"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { accessLevel, isManager } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/components/Toast";
import { LeadsHeader, LeadsStats } from "./components/LeadsStats";
import { LeadsToolbar } from "./components/LeadsToolbar";
import { LeadsList } from "./components/LeadsList";
import { AddLeadSheet } from "./components/AddLeadSheet";
import { ImportLeadsSheet } from "./components/ImportLeadsSheet";
import { LeadDrawer } from "./components/LeadDrawer";
import { useLeadActions } from "./components/useLeadActions";
import {
  PAGE_SIZE, SCOPE_NOTE, STATUS_LABEL, apiError, canEditLead, exportLeads, sortLeads,
  type BdoOption, type Filters, type Lead, type Scope, type SortKey,
} from "./components/lib";

const NO_FILTERS: Filters = { status: "", bdo: "", priority: "", source: "" };

export default function LeadsPage() {
  const { user } = useAuth();
  const level = accessLevel(user?.role);
  const qc = useQueryClient();

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("soonest");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);

  const { data: bdos = [] } = useQuery<BdoOption[]>({ queryKey: ["bdos"], queryFn: () => fetcher("/bdo") });
  const { data: stats = {} } = useQuery<Record<string, number>>({ queryKey: ["leads-stats"], queryFn: () => fetcher("/leads/stats") });
  const myName = bdos.find((b) => b.id === user?.bdoId)?.name ?? "";

  // Search runs on the server so it reaches every page, a moment after typing stops.
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(search.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const setFilter = (key: keyof Filters, value: string) => { setFilters((f) => ({ ...f, [key]: value })); setPage(0); };
  const clearFilters = () => { setFilters((f) => ({ ...NO_FILTERS, status: f.status })); setPage(0); };
  const changeScope = (s: Scope) => { setScope(s); setPage(0); };

  // Every filter, the tabs and the search go to the server, so they work across all pages.
  const server: Record<string, string> = {
    ...filters,
    search: searchTerm,
    ...(scope === "mine" && user?.bdoId ? { bdoId: user.bdoId } : {}),
    ...(scope === "shared" ? { visibility: "PUBLIC" } : {}),
    ...(scope === "overdue" || scope === "week" ? { followUp: scope } : {}),
  };
  const queryParams = new URLSearchParams({
    ...Object.fromEntries(Object.entries(server).filter(([, v]) => v)),
    limit: String(PAGE_SIZE),
    skip: String(page * PAGE_SIZE),
  });
  const { data: leadsRes, isLoading } = useQuery<{ data: Lead[]; total: number; counts?: { overdue: number; week: number } }>({
    queryKey: ["leads", server, page],
    queryFn: () => fetcher(`/leads?${queryParams}`),
  });

  const total = leadsRes?.total ?? 0;
  const visible = sortLeads(leadsRes?.data ?? [], sort);

  const counts = {
    all: Object.values(stats).reduce((a, b) => a + b, 0),
    overdue: leadsRes?.counts?.overdue ?? 0,
    week: leadsRes?.counts?.week ?? 0,
  };

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["leads-stats"] }); };
  const canShare = isManager(user);
  const actions = useLeadActions(canShare, invalidate);

  const guard = async (job: () => Promise<void>, fallback: string) => {
    try { await job(); } catch (err) { toast.error(fallback, { description: apiError(err, "Please try again.") }); }
  };
  const keepDetail = (u: Lead | null) => { if (u && detail?.id === u.id) setDetail(u); };

  const handlers = {
    onOpen: setDetail,
    onEdit: (l: Lead) => { setEditing(l); setDetail(null); setShowForm(true); },
    onStage: (l: Lead, s: string) => guard(async () => {
      keepDetail(await actions.stage(l, s));
      toast.success(`Moved to ${STATUS_LABEL[s] ?? s}`, { description: l.businessName });
    }, "Couldn't move this lead to a new stage."),
    onConvert: (l: Lead) => guard(async () => {
      const u = await actions.convert(l);
      if (!u) return;
      keepDetail(u);
      toast.success("Converted to a client", { description: `${l.businessName} is now in your clients.` });
    }, "Couldn't convert this lead."),
    onShare: (l: Lead) => guard(async () => {
      const u = await actions.visibility(l);
      keepDetail(u);
      toast.success(u?.visibility === "PUBLIC" ? "Shared with your team" : "Made private", { description: l.businessName });
    }, "Couldn't change who can see this lead."),
    onDelete: (l: Lead) => guard(async () => {
      if (!(await actions.remove(l))) return;
      if (detail?.id === l.id) setDetail(null);
      toast.success("Lead deleted", { description: l.businessName });
    }, "Couldn't delete this lead."),
  };

  const openAdd = () => { setEditing(null); setShowForm(true); };
  // From the "may already be a lead" list: close the form and open the existing lead.
  const openExisting = (id: string) => {
    fetcher(`/leads/${id}`).then((l: Lead) => { setShowForm(false); setDetail(l); }).catch(() => {});
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <LeadsHeader scope={SCOPE_NOTE[level]} sort={sort} onSort={setSort} onAdd={openAdd} onImport={() => setShowImport(true)} />
      <LeadsStats stats={stats} status={filters.status} onStatus={(s) => setFilter("status", s)} />
      <LeadsToolbar
        scope={scope} onScope={changeScope} counts={counts} showMine={!!myName}
        filters={{ bdo: filters.bdo, priority: filters.priority, source: filters.source }} onFilter={setFilter} onClear={clearFilters}
        bdos={bdos} search={search} onSearch={setSearch} onExport={() => exportLeads(visible)} canExport={visible.length > 0}
      />
      <LeadsList
        leads={visible} isLoading={isLoading} total={total} page={page} onPage={setPage}
        anyFilter={!!(filters.bdo || filters.priority || filters.source || filters.status || search)}
        onClear={() => { clearFilters(); setFilter("status", ""); setSearch(""); }} onAdd={openAdd}
        canEdit={(l) => canEditLead(user, l)} canShare={canShare} h={handlers}
      />

      {showForm && (
        <AddLeadSheet
          lead={editing} bdos={bdos} canAssign={canShare}
          onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); invalidate(); }} onOpenLead={openExisting}
        />
      )}
      {showImport && (
        <ImportLeadsSheet bdos={bdos} canAssign={canShare} onClose={() => setShowImport(false)} onImported={invalidate} />
      )}
      {detail && (
        <LeadDrawer
          lead={detail} canEdit={canEditLead(user, detail)} canShare={canShare} actions={actions}
          onClose={() => setDetail(null)} onEdit={() => handlers.onEdit(detail)}
          onChanged={(updated) => { setDetail(updated); invalidate(); }}
        />
      )}
    </div>
  );
}
