"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { accessLevel, isManager } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { LeadsHeader, LeadsStats } from "./components/LeadsStats";
import { LeadsToolbar } from "./components/LeadsToolbar";
import { LeadsList } from "./components/LeadsList";
import { AddLeadSheet } from "./components/AddLeadSheet";
import { LeadDrawer } from "./components/LeadDrawer";
import { useLeadActions } from "./components/useLeadActions";
import {
  PAGE_SIZE, SCOPE_NOTE, apiError, canEditLead, exportLeads, groupOf, sortLeads,
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
  const [detail, setDetail] = useState<Lead | null>(null);

  const { data: bdos = [] } = useQuery<BdoOption[]>({ queryKey: ["bdos"], queryFn: () => fetcher("/bdo") });
  const { data: stats = {} } = useQuery<Record<string, number>>({ queryKey: ["leads-stats"], queryFn: () => fetcher("/leads/stats") });
  const myName = bdos.find((b) => b.id === user?.bdoId)?.name ?? "";

  const setFilter = (key: keyof Filters, value: string) => { setFilters((f) => ({ ...f, [key]: value })); setPage(0); };
  const clearFilters = () => { setFilters((f) => ({ ...NO_FILTERS, status: f.status })); setPage(0); };
  const changeScope = (s: Scope) => { setScope(s); setPage(0); };

  // "My leads" and "Shared" go to the server; Overdue and Due this week are worked out below.
  const server: Record<string, string> = {
    ...filters,
    ...(scope === "mine" && myName ? { bdo: myName } : {}),
    ...(scope === "shared" ? { visibility: "PUBLIC" } : {}),
  };
  const queryParams = new URLSearchParams({
    ...Object.fromEntries(Object.entries(server).filter(([, v]) => v)),
    limit: String(PAGE_SIZE),
    skip: String(page * PAGE_SIZE),
  });
  const { data: leadsRes, isLoading } = useQuery<{ data: Lead[]; total: number }>({
    queryKey: ["leads", server, page],
    queryFn: () => fetcher(`/leads?${queryParams}`),
  });

  const loaded = leadsRes?.data ?? [];
  const total = leadsRes?.total ?? 0;
  const q = search.trim().toLowerCase();
  const searched = q ? loaded.filter((l) => [l.businessName, l.contactPerson, l.email, l.phone, l.bizId].some((v) => (v ?? "").toLowerCase().includes(q))) : loaded;
  const visible = sortLeads(scope === "overdue" ? searched.filter((l) => groupOf(l) === "overdue") : scope === "week" ? searched.filter((l) => groupOf(l) === "soon") : searched, sort);

  const counts = {
    all: Object.values(stats).reduce((a, b) => a + b, 0),
    overdue: loaded.filter((l) => groupOf(l) === "overdue").length,
    week: loaded.filter((l) => groupOf(l) === "soon").length,
  };

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["leads-stats"] }); };
  const canShare = isManager(user);
  const actions = useLeadActions(canShare, invalidate);

  const guard = async (job: () => Promise<void>, fallback: string) => {
    try { await job(); } catch (err) { alert(apiError(err, fallback)); }
  };
  const keepDetail = (u: Lead | null) => { if (u && detail?.id === u.id) setDetail(u); };

  const handlers = {
    onOpen: setDetail,
    onEdit: (l: Lead) => { setEditing(l); setDetail(null); setShowForm(true); },
    onStage: (l: Lead, s: string) => guard(async () => keepDetail(await actions.stage(l, s)), "Couldn't move this lead to a new stage."),
    onConvert: (l: Lead) => guard(async () => keepDetail(await actions.convert(l)), "Couldn't convert this lead."),
    onShare: (l: Lead) => guard(async () => keepDetail(await actions.visibility(l)), "Couldn't change who can see this lead."),
    onDelete: (l: Lead) => guard(async () => { if (await actions.remove(l) && detail?.id === l.id) setDetail(null); }, "Couldn't delete this lead. Please try again."),
  };

  const openAdd = () => { setEditing(null); setShowForm(true); };
  // From the "may already be a lead" list: close the form and open the existing lead.
  const openExisting = (id: string) => {
    fetcher(`/leads/${id}`).then((l: Lead) => { setShowForm(false); setDetail(l); }).catch(() => {});
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <LeadsHeader scope={SCOPE_NOTE[level]} sort={sort} onSort={setSort} onAdd={openAdd} />
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
