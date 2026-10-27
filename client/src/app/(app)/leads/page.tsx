"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Columns3, List } from "lucide-react";
import { fetcher } from "@/lib/api";
import { accessLevel, isManager } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/components/Toast";
import { LeadsHeader, LeadsStats } from "./components/LeadsStats";
import { LeadsToolbar } from "./components/LeadsToolbar";
import { LeadsList } from "./components/LeadsList";
import { LeadsBoard, fetchAllLeads } from "./components/LeadsBoard";
import { AddLeadSheet } from "./components/AddLeadSheet";
import { ImportLeadsSheet } from "./components/ImportLeadsSheet";
import { LeadDrawer } from "./components/LeadDrawer";
import { useLeadActions } from "./components/useLeadActions";
import {
  PAGE_SIZE, SCOPE_NOTE, STATUS_LABEL, apiError, canEditLead, exportLeads, groupOf, sortLeads,
  type BdoOption, type Filters, type Lead, type Scope, type SortKey,
} from "./components/lib";

const NO_FILTERS: Filters = { status: "", bdo: "", priority: "", source: "" };
const VIEW_KEY = "trunqo.leads.view";

type View = "list" | "board";
type LeadsRes = { data: Lead[]; total: number };

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

  // List or Board, remembered on this device. null until we've read it (localStorage doesn't exist
  // on the server), so we never fire the wrong query first.
  const [view, setView] = useState<View | null>(null);
  useEffect(() => {
    try { setView(localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list"); } catch { setView("list"); }
  }, []);
  const changeView = (v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode: the choice just won't stick */ }
  };

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

  // List view: one page at a time.
  const { data: leadsRes, isLoading: listLoading } = useQuery<LeadsRes>({
    queryKey: ["leads", server, page],
    queryFn: () => fetcher(`/leads?${queryParams}`),
    enabled: view === "list",
  });
  // Board view: every lead, so no column is cut off. Its key starts with "leads" so the same
  // invalidate() that refreshes the list refreshes the board too.
  const boardKey = ["leads", "board", server] as const;
  const { data: boardRes, isLoading: boardLoading } = useQuery<LeadsRes>({
    queryKey: boardKey,
    queryFn: () => fetchAllLeads(server),
    enabled: view === "board",
  });

  const isLoading = view === null || (view === "board" ? boardLoading : listLoading);
  const source = view === "board" ? boardRes : leadsRes;
  const loaded = source?.data ?? [];
  const total = source?.total ?? 0;
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

  // Runs a job and shows a toast if it throws. Resolves true if it worked, false if it failed or
  // the person backed out (the job returns false), so the board knows when to snap a card back.
  const guard = async (job: () => Promise<boolean | void>, fallback: string): Promise<boolean> => {
    try { return (await job()) !== false; } catch (err) { toast.error(fallback, { description: apiError(err, "Please try again.") }); return false; }
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
      if (!u) return false;
      keepDetail(u);
      toast.success("Converted to a client", { description: `${l.businessName} is now in your clients.` });
      return true;
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

  // Board drop: the card jumps to the new column straight away, then the server catches up. If the
  // server says no (or you cancel the Convert confirmation) the card goes back where it was.
  // A lead only becomes CONVERTED through the Convert flow, so a drop there asks you to confirm.
  const moveLead = async (l: Lead, to: string) => {
    const setStatus = (status: string) =>
      qc.setQueryData<LeadsRes>(boardKey, (old) => old && { ...old, data: old.data.map((x) => (x.id === l.id ? { ...x, status } : x)) });
    setStatus(to);
    const ok = to === "CONVERTED" ? await handlers.onConvert(l) : await handlers.onStage(l, to);
    if (!ok) setStatus(l.status);
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

      <div className="flex items-center justify-between gap-3">
        <p className="hidden text-xs text-muted sm:block">
          {view === "board" ? "Drag a card to change its stage. Dropping on Converted asks you to confirm." : ""}
        </p>
        <div className="ml-auto inline-flex rounded-lg border border-border bg-surface p-0.5">
          {([["list", "List", List], ["board", "Board", Columns3]] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => changeView(k)}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === k ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground",
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "board" ? (
        <LeadsBoard
          leads={visible} isLoading={isLoading} statusFilter={filters.status}
          canEdit={(l) => canEditLead(user, l)} onOpen={setDetail} onMove={moveLead}
        />
      ) : (
        <LeadsList
          leads={visible} isLoading={isLoading} total={total} page={page} onPage={setPage}
          anyFilter={!!(filters.bdo || filters.priority || filters.source || filters.status || search)}
          onClear={() => { clearFilters(); setFilter("status", ""); setSearch(""); }} onAdd={openAdd}
          canEdit={(l) => canEditLead(user, l)} canShare={canShare} h={handlers}
        />
      )}

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