"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { accessLevel, isManager } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { LeadsOverview } from "./components/LeadsOverview";
import { LeadsTable, type Filters } from "./components/LeadsTable";
import { AddLeadSheet } from "./components/AddLeadSheet";
import { LeadDrawer } from "./components/LeadDrawer";
import { PAGE_SIZE, SCOPE_NOTE, apiError, canEditLead, type BdoOption, type Lead } from "./components/lib";

const NO_FILTERS: Filters = { status: "", bdo: "", priority: "", source: "", visibility: "" };

export default function LeadsPage() {
  const { user } = useAuth();
  const level = accessLevel(user?.role);
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);

  const { data: bdos = [] } = useQuery<BdoOption[]>({ queryKey: ["bdos"], queryFn: () => fetcher("/bdo") });
  const { data: stats = {} } = useQuery<Record<string, number>>({ queryKey: ["leads-stats"], queryFn: () => fetcher("/leads/stats") });

  const setFilter = (key: keyof Filters, value: string) => { setFilters((f) => ({ ...f, [key]: value })); setPage(0); };
  const clearFilters = () => { setFilters(NO_FILTERS); setPage(0); };

  const queryParams = new URLSearchParams({
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    limit: String(PAGE_SIZE),
    skip: String(page * PAGE_SIZE),
  });
  const { data: leadsRes, isLoading } = useQuery<{ data: Lead[]; total: number }>({
    queryKey: ["leads", filters, page],
    queryFn: () => fetcher(`/leads?${queryParams}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["leads-stats"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: invalidate,
    onError: (err) => alert(apiError(err, "Couldn't delete this lead. Please try again.")),
  });

  const openAdd = () => { setEditing(null); setShowForm(true); };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <LeadsOverview stats={stats} status={filters.status} onStatus={(s) => setFilter("status", s)} scope={SCOPE_NOTE[level]} onAdd={openAdd} />

      <LeadsTable
        leads={leadsRes?.data ?? []} total={leadsRes?.total ?? 0} isLoading={isLoading}
        page={page} onPage={setPage}
        filters={filters} onFilter={setFilter} onClear={clearFilters}
        bdos={bdos} user={user}
        onAdd={openAdd}
        onEdit={(l) => { setEditing(l); setShowForm(true); }}
        onOpen={setDetail}
        onDelete={(l) => { if (confirm(`Delete "${l.businessName}"? This can't be undone.`)) deleteMutation.mutate(l.id); }}
      />

      {showForm && (
        <AddLeadSheet
          lead={editing} bdos={bdos} canAssign={isManager(user)}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); invalidate(); }}
        />
      )}

      {detail && (
        <LeadDrawer
          lead={detail} canEdit={canEditLead(user, detail)} canShare={isManager(user)}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); setShowForm(true); }}
          onChanged={(updated) => { setDetail(updated); invalidate(); }}
        />
      )}
    </div>
  );
}
