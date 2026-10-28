"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowRight, ChevronDown, Columns3, GripVertical, List, ListChecks, Plus, Search } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { DataTable, type Column } from "@/components/DataTable";
import { PriorityBadge, TaskStatusBadge } from "@/components/Badges";
import { type ClientOption } from "@/components/ClientSelect";
import { useAuth } from "@/components/AuthProvider";
import { isStaff, isGroupOwner } from "@/lib/auth";
import { useCompanies } from "@/lib/companies";
import { toast } from "@/components/Toast";
import { TaskRow } from "./components/TaskRow";
import { TaskForm } from "./components/TaskForm";
import { ResultPrompt } from "./components/ResultPrompt";
import { ApprovalsList } from "./components/ApprovalsList";
import { ReviewModal } from "./components/ReviewModal";
import { ConfirmDialog, FilterSelect, OutcomeBadge, RingStat, Stat } from "./components/TaskBits";
import { AttachDialog } from "./components/AttachDialog";
import { SortableStats } from "./components/SortableStats";
import { SortableGroups } from "./components/SortableGroups";
import { FOCUS_LABEL, useTaskFocus, type FocusKey } from "./components/useTaskFocus";
import { useQuickAttach } from "./components/useQuickAttach";
import {
  COLLAPSED_ROWS,
  FILTER_STATUSES,
  PRIORITIES,
  PRIORITY_LABEL,
  PRIORITY_RANK,
  STATUS_LABEL,
  apiError,
  dueTime,
  fmt,
  fmtDate,
  isDueThisWeek,
  isOverdue,
  isUpcoming,
  plural,
  type ApprovalTask,
  type Bdo,
  type SortKey,
  type TabKey,
  type Task,
} from "./components/task-utils";
import { matchesFocus, TaskBoard } from "./components/TaskBoard";

/**
 * Assign tasks. The page keeps the data and the filters; the pieces live in components/tasks:
 *   task-utils.ts   types, labels and date helpers
 *   TaskBits.tsx    pills, stat rings, filter select, row menu, confirm dialog
 *   TaskRow.tsx     one task in the list
 *   TaskBoard.tsx   the drag-and-drop board (To do, In progress, Done, Cancelled)
 *   TaskForm.tsx    the three-step add / edit flow
 *   ResultPrompt.tsx  "Did this move the KPI?" after finishing linked work
 *   SortableStats.tsx the status cards, draggable into any order
 *   SortableGroups.tsx the task sections, draggable by their header
 */


const EMPTY_FILTERS = { priority: "", status: "", company: "", bdoId: "" };
const VIEW_KEY = "trunqo.tasks.view";

type View = "list" | "board";

export default function TasksPage() {
  const { user } = useAuth();
  const isBdo = isStaff(user);
  // Staff and Business CEOs only ever work inside one company, so company pickers and
  // the company column are for the Group Owner alone.
  const oneCompany = !isGroupOwner(user);
  const myBdoId = user?.bdoId ?? null;

  const { companies, byKey } = useCompanies();
  const scopeName = oneCompany && user?.bdoCompany ? (byKey[user.bdoCompany]?.name ?? user.bdoCompany) : "all your companies";

  const [tab, setTab] = useState<TabKey>("all");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("soonest");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [prompt, setPrompt] = useState<Task | null>(null);
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const [reviewing, setReviewing] = useState<Task | null>(null);
  const [attaching, setAttaching] = useState<Task | null>(null);
  // Which group the person asked to see first (clicking a status card), remembered on this device.
  const { focus, toggle: toggleFocus, clear: clearFocus, arrange } = useTaskFocus();
  const qc = useQueryClient();

  // List or Board, remembered on this device. null until we've read it (localStorage doesn't exist
  // on the server), so the page doesn't flash the wrong view first.
  const [view, setView] = useState<View | null>(null);
  useEffect(() => {
    try { setView(localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list"); } catch { setView("list"); }
  }, []);
  const changeView = (v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode: the choice just won't stick */ }
  };

  // Managers approve the work staff finish; the alerts link here with ?view=approvals.
  const { data: approvals = [] } = useQuery<ApprovalTask[]>({
    queryKey: ["tasks", "approvals"],
    queryFn: () => fetcher("/tasks/approvals"),
    enabled: !!user && !isBdo,
  });
  useEffect(() => {
    if (!isBdo && new URLSearchParams(window.location.search).get("view") === "approvals") setTab("approvals");
  }, [isBdo]);

  const isProposalView = tab === "proposals";
  const isApprovalView = tab === "approvals";
  // The board is for tasks; proposals and approvals keep their own screens.
  const showBoard = view === "board" && !isProposalView && !isApprovalView;

  // Staff are always scoped to their own tasks; everyone else uses the filter bar.
  // Blocked isn't a stored status: the server works it out from "Can't start until".
  const { status: statusFilter, ...rest } = filters;
  const effective = {
    ...rest,
    ...(statusFilter === "BLOCKED" ? { blocked: "1" } : { status: statusFilter }),
    type: isProposalView ? "PROPOSAL" : "TASK",
    ...(isBdo ? { bdoId: myBdoId ?? "" } : {}),
  };
  const params = new URLSearchParams(Object.fromEntries(Object.entries(effective).filter(([, v]) => v)));
  const tasksKey = ["tasks", effective];

  const { data = [], isLoading, isError, refetch } = useQuery<Task[]>({
    queryKey: tasksKey,
    queryFn: () => fetcher(`/tasks?${params}`),
    enabled: !!user && (!isBdo || !!myBdoId),
  });

  const { data: bdos = [] } = useQuery<Bdo[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
    enabled: !isBdo,
  });

  const { data: smeRes } = useQuery<{ data: ClientOption[]; total: number }>({
    queryKey: ["sme-options"],
    queryFn: () => fetcher("/sme?limit=500"),
  });
  const clients = smeRes?.data ?? [];

  // Tasks feed KPI work and results, so the KPI screens refresh with them.
  // Money brought in on a linked task is a payment on its deal, so the deal screens refresh too.
  const refresh = () => {
    for (const key of ["tasks", "my-kpis", "kpi-board", "kpi-cascade", "deal-payments", "tradeline", "bapx", "company-deals", "task-deal-options", "alerts"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };

  // Files dropped on a row: upload them and save them on that task.
  const quickAttach = useQuickAttach(refresh);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      refresh();
      if (toDelete) toast.success(`${toDelete.type === "PROPOSAL" ? "Proposal" : "Task"} deleted`, { description: toDelete.deliverable });
      setToDelete(null);
    },
    onError: (err) => { setToDelete(null); toast.error("Couldn't delete that", { description: apiError(err, "Please try again.") }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: string }) => api.put(`/tasks/${task.id}`, { status }),
    onSuccess: (res, { status }) => {
      refresh();
      const saved = res.data as Task;
      if (status === "COMPLETED") toast.success("Marked as done", { description: saved.deliverable });
      // Finishing work that is linked to a manual KPI: ask whether it produced a result.
      if (status === "COMPLETED" && saved.kpi && saved.kpi.source !== "AUTO") setPrompt(saved);
    },
    onError: (err) => {
      const msg = apiError(err, "We couldn't update that task. Please try again.");
      // Older tasks may have no start date, which the API now requires on every save.
      toast.error("Couldn't update that task", {
        description: /start date/i.test(msg) ? "This task has no start date yet. Open Edit details, add one, then try again." : msg,
      });
    },
  });

  // Board drop: the card jumps to the new column straight away, then the server catches up. If the
  // server says no (the mutation's own toast explains why) the card goes back where it was.
  // Finishing a task this way behaves exactly like ticking its checkbox, including the result prompt.
  const moveTask = async (task: Task, to: string) => {
    const setStatus = (status: string) =>
      qc.setQueryData<Task[]>(tasksKey, (old) => old?.map((x) => (x.id === task.id ? { ...x, status } : x)));
    setStatus(to);
    try { await toggleMutation.mutateAsync({ task, status: to }); } catch { setStatus(task.status); }
  };

  /* ---- derived numbers ---- */
  const total = data.length;
  const completedN = data.filter((t) => t.status === "COMPLETED").length;
  const overdueN = data.filter(isOverdue).length;
  const upcomingN = data.filter((t) => isUpcoming(t, 7)).length;
  const notStartedN = data.filter((t) => t.status === "PENDING").length;
  const blockedN = data.filter((t) => t.blocked).length;
  const mineN = myBdoId ? data.filter((t) => t.bdoId === myBdoId).length : 0;
  const weekN = data.filter(isDueThisWeek).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  // Proposal reporting
  const proposalValue = data.reduce((s, t) => s + (t.proposalValueGhs ?? 0), 0);
  const accepted = data.filter((t) => t.outcome === "ACCEPTED").length;
  const decided = data.filter((t) => ["ACCEPTED", "REJECTED", "NO_RESPONSE"].includes(t.outcome ?? "")).length;
  const winRate = decided > 0 ? Math.round((accepted / decided) * 100) : null;

  /* ---- search + tab + sort ---- */
  const q = search.trim().toLowerCase();
  const matchesSearch = (t: Task) =>
    !q ||
    [t.deliverable, t.notes, t.clientName, t.bdo?.name, t.company ? (byKey[t.company]?.name ?? t.company) : ""].some((v) =>
      (v ?? "").toLowerCase().includes(q),
    );
  const matchesTab = (t: Task) =>
    tab === "mine" ? !!myBdoId && t.bdoId === myBdoId
    : tab === "overdue" ? isOverdue(t)
    : tab === "week" ? isDueThisWeek(t)
    : true;
  const sorter = (a: Task, b: Task) => {
    if (sort === "priority") {
      const d = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (d) return d;
    }
    const ta = dueTime(a)?.getTime() ?? Infinity;
    const tb = dueTime(b)?.getTime() ?? Infinity;
    if (ta === tb) return 0;
    if (ta === Infinity) return 1;
    if (tb === Infinity) return -1;
    return sort === "latest" ? tb - ta : ta - tb;
  };
  const visible = data.filter((t) => matchesSearch(t) && matchesTab(t)).sort(sorter);
  // The approvals feed isn't filtered by the server, so the filter bar applies here. Status is
  // left out: everything waiting is done. Kept in the server's order, oldest submitted first.
  const shownApprovals = approvals.filter((t) =>
    matchesSearch(t) &&
    (!filters.priority || t.priority === filters.priority) &&
    (!filters.company || t.company === filters.company) &&
    (!filters.bdoId || t.bdoId === filters.bdoId),
  );
  const groups = arrange(visible);
  // On the board a status card narrows the cards to what it counts, instead of pinning a group first.
  const boardTasks = focus ? visible.filter((t) => matchesFocus(focus, t)) : visible;
  const focusProps = (key: FocusKey) => ({
    onClick: () => toggleFocus(key),
    active: focus === key,
    hint: focus === key ? (showBoard ? "Click to show every task again" : "Click to go back to the normal order") : (showBoard ? "Click to show only these" : "Click to show these first"),
  });

  const filtering = !!q || tab !== "all" || Object.values(filters).some(Boolean);
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setSearch(""); setTab("all"); };
  const clearApprovalFilters = () => { setFilters(EMPTY_FILTERS); setSearch(""); };

  const gridCols = [
    "24px",
    "minmax(0,2.4fr)",
    "84px",
    ...(oneCompany ? [] : ["minmax(0,1.3fr)"]),
    ...(isBdo ? [] : ["minmax(0,1.2fr)"]),
    "132px",
    // Status, plus "Review" or "Awaiting approval" beside it
    "190px",
    "28px",
  ].join(" ");

  const openEdit = (row: Task) => { setEditing(row); setShowForm(true); };
  const openAdd = () => { setEditing(null); setShowForm(true); };

  const proposalColumns: Column<Task>[] = [
    { key: "year", label: "Year", sortable: true, width: "60px" },
    { key: "priority", label: "Priority", render: (r) => <PriorityBadge value={r.priority} />, sortable: true },
    { key: "deliverable", label: "Proposal", sortable: true },
    { key: "clientName", label: "Client", render: (r: Task) => r.clientName ?? "—" },
    { key: "proposalValueGhs", label: "Value", sortable: true, render: (r: Task) => (r.proposalValueGhs ? fmt(r.proposalValueGhs) : "—") },
    { key: "outcome", label: "Outcome", render: (r: Task) => (r.outcome ? <OutcomeBadge value={r.outcome} /> : "—") },
    {
      key: "targetDate", label: "Due or sent", sortable: true,
      render: (r: Task) => <span className={isOverdue(r) ? "text-red-600 font-medium" : ""}>{fmtDate(r.targetDate)}</span>,
      exportValue: (r: Task) => r.targetDate ?? "",
    },
    ...(isBdo ? [] : [{ key: "bdo", label: "Owner", render: (r: Task) => r.bdo?.name ?? "—" }]),
    ...(oneCompany ? [] : [{ key: "company", label: "Company", render: (r: Task) => (r.company ? (byKey[r.company]?.name ?? r.company) : "—") }]),
    { key: "status", label: "Status", render: (r: Task) => <TaskStatusBadge value={r.status} />, sortable: true },
    { key: "notes", label: "Notes" },
  ];

  const pageTitle = isBdo ? "My tasks" : "Assign tasks";

  if (isBdo && !myBdoId) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="font-serif text-2xl md:text-3xl text-foreground mb-3">{pageTitle}</h1>
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
          Your account isn't linked to a team profile yet, so there's nothing to show. Ask your Group Owner to link it in Team &amp; access.
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; count: number | null; badge: string }[] = [
    { key: "all", label: "All tasks", count: isProposalView ? null : total, badge: "" },
    // "Mine" only means something to someone who assigns work to others.
    ...(!isBdo && myBdoId ? [{ key: "mine" as TabKey, label: "My tasks", count: isProposalView ? null : mineN, badge: "" }] : []),
    { key: "overdue", label: "Overdue", count: isProposalView ? null : overdueN, badge: "bg-red-50 text-red-600" },
    { key: "week", label: "Due this week", count: isProposalView ? null : weekN, badge: "" },
    { key: "proposals", label: "Proposals", count: isProposalView ? total : null, badge: "" },
    ...(isBdo ? [] : [{ key: "approvals" as TabKey, label: "Awaiting approval", count: shownApprovals.length, badge: shownApprovals.length ? "bg-sky-50 text-sky-700" : "" }]),
  ];

  return (
    // pb-24 keeps the floating "Ask Trunqo" button from covering the last row
    <div className="p-4 md:p-6 pb-24 md:pb-24 space-y-4">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl md:text-3xl text-foreground">{pageTitle}</h1>
        <p className="text-sm text-muted mt-1">
          {isProposalView
            ? isBdo ? "Your client proposals and how they turned out." : `Client proposals and how they turned out across ${scopeName}.`
            : isBdo ? "Everything assigned to you, in one place." : `Give work to your team and follow it through to done across ${scopeName}.`}
        </p>
      </div>

      {/* Stat cards */}
      {isProposalView ? (
        <div className="flex flex-wrap gap-3">
          <Stat label="Proposals" value={String(total)} tone="blue" />
          <Stat label="Total value" value={fmt(proposalValue)} tone="blue" />
          <Stat label="Win rate" value={winRate === null ? "—" : `${winRate}%`} tone="green" />
        </div>
      ) : (
        // A swipeable strip on phones, a grid from tablet up. Drag a card to reorder; the order is remembered.
        <SortableStats
          className="no-scrollbar flex gap-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:grid sm:grid-cols-3 xl:grid-cols-5"
          cards={[
            { key: "done", node: <RingStat value={`${completedN} / ${total}`} label="Done" pct={pct(completedN)} ringClass="stroke-green-600" trackClass="stroke-green-100" labelClass="text-green-600" {...focusProps("done")} /> },
            { key: "overdue", node: <RingStat value={String(overdueN)} label="Overdue" pct={pct(overdueN)} ringClass="stroke-red-500" trackClass="stroke-red-100" labelClass="text-red-500" {...focusProps("overdue")} /> },
            { key: "blocked", node: <RingStat value={String(blockedN)} label="Blocked" pct={pct(blockedN)} ringClass="stroke-amber-500" trackClass="stroke-amber-100" labelClass="text-amber-600" {...focusProps("blocked")} /> },
            { key: "upcoming", node: <RingStat value={String(upcomingN)} label="Due in 7 days" pct={pct(upcomingN)} ringClass="stroke-blue-500" trackClass="stroke-blue-100" labelClass="text-muted" {...focusProps("upcoming")} /> },
            { key: "todo", node: <RingStat value={String(notStartedN)} label="Not started" pct={pct(notStartedN)} ringClass="stroke-gray-400" trackClass="stroke-gray-200" labelClass="text-muted" {...focusProps("todo")} /> },
          ]}
        />
      )}

      {focus && !isProposalView && (
        <div className="-mt-1 flex items-center gap-2 text-sm text-muted">
          <span>Showing <span className="font-medium text-foreground">{FOCUS_LABEL[focus]}</span> {showBoard ? "only" : "first"}.</span>
          <button onClick={clearFocus} className="font-medium text-accent hover:underline">{showBoard ? "Show every task" : "Back to normal order"}</button>
        </div>
      )}

      {/* Tabs + sort + add */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="no-scrollbar flex w-full sm:w-auto items-center gap-x-6 overflow-x-auto">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-pressed={active}
                className={clsx(
                  "shrink-0 flex items-center gap-2 pb-2.5 -mb-px text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                  active ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground",
                )}
              >
                {t.label}
                {t.count !== null && (
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded-full text-xs font-medium tabular-nums",
                      t.badge || (active ? "bg-accent/10 text-accent" : "bg-subtle text-muted"),
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex w-full sm:w-auto items-center gap-2.5">
          {!isProposalView && !isApprovalView && (
            <div className="inline-flex shrink-0 rounded-lg border border-border bg-surface p-0.5">
              {([["list", "List", List], ["board", "Board", Columns3]] as const).map(([k, label, Icon]) => (
                <button
                  key={k}
                  onClick={() => changeView(k)}
                  aria-pressed={view === k}
                  title={`${label} view`}
                  className={clsx(
                    "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                    view === k ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground",
                  )}
                >
                  <Icon size={14} />
                  <span className="max-sm:hidden">{label}</span>
                </button>
              ))}
            </div>
          )}
          {!isProposalView && (
            <div className="relative flex-1 sm:flex-none">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort tasks"
                className="appearance-none h-9 w-full sm:w-auto bg-surface border border-border rounded-lg pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                <option value="soonest">Soonest deadline</option>
                <option value="latest">Latest deadline</option>
                <option value="priority">Highest priority</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
            </div>
          )}
          <button
            onClick={openAdd}
            className="h-9 shrink-0 flex items-center gap-1.5 bg-accent text-accent-foreground rounded-lg px-3.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> {isProposalView ? "New proposal" : "New task"}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-surface border border-border rounded-xl shadow-card p-2.5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
        <FilterSelect label="Filter by priority" value={filters.priority} onChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
          <option value="">All priorities</option>
          {[...PRIORITIES].reverse().map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </FilterSelect>
        {!isApprovalView && (
          <FilterSelect label="Filter by status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
            <option value="">All statuses</option>
            {FILTER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </FilterSelect>
        )}
        {!oneCompany && (
          <FilterSelect label="Filter by company" value={filters.company} onChange={(v) => setFilters((f) => ({ ...f, company: v }))}>
            <option value="">All companies</option>
            {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </FilterSelect>
        )}
        {!isBdo && (
          <FilterSelect label="Filter by owner" value={filters.bdoId} onChange={(v) => setFilters((f) => ({ ...f, bdoId: v }))}>
            <option value="">Everyone</option>
            {bdos.map((b) => <option key={b.id} value={b.id}>{b.name}{oneCompany ? "" : ` (${b.company})`}</option>)}
          </FilterSelect>
        )}
        <div className="relative col-span-2 order-first sm:order-none sm:col-auto w-full sm:w-72 sm:ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={isProposalView ? "Search proposals" : "Search tasks"}
            placeholder={isProposalView ? "Search proposals" : "Search by task, person or client"}
            className="w-full h-9 bg-surface border border-border rounded-lg pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>
      </div>

      {showBoard && !isLoading && !isError && (
        <p className="hidden text-xs text-muted sm:block -mt-1">
          Drag a card to change its status. Dropping on Done works like ticking the box. Order inside a column follows your sort.
        </p>
      )}

      {/* Body */}
      {isApprovalView ? (
        approvals.length > 0 && shownApprovals.length === 0 ? (
          <EmptyCard
            title="Nothing matches those filters"
            body={`${plural(approvals.length, "task is", "tasks are")} waiting for approval. Try a different search, or clear the filters.`}
            action={<button onClick={clearApprovalFilters} className="text-sm font-medium text-accent hover:underline">Clear filters</button>}
          />
        ) : (
          <ApprovalsList tasks={shownApprovals} oneCompany={oneCompany} companyName={(k) => byKey[k]?.name ?? k} onChanged={refresh} />
        )
      ) : isProposalView ? (
        <DataTable
          columns={proposalColumns}
          data={visible}
          isLoading={isLoading}
          title={plural(visible.length, "proposal", "proposals")}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={(row: Task) => setToDelete(row)}
          filterBar={null}
        />
      ) : isLoading || view === null ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-subtle animate-pulse" />)}
        </div>
      ) : isError ? (
        <EmptyCard
          title="We couldn't load your tasks"
          body="Check your connection and try again."
          action={<button onClick={() => refetch()} className="text-sm font-medium text-accent hover:underline">Try again</button>}
        />
      ) : groups.length === 0 ? (
        data.length === 0 && !filtering ? (
          <EmptyCard
            title="No tasks yet"
            body={isBdo ? "Nothing has been assigned to you yet." : "Add the first one. Give it an owner and a due date and it shows up here."}
            action={!isBdo ? <button onClick={openAdd} className="text-sm font-medium text-accent hover:underline">New task</button> : undefined}
          />
        ) : (
          <EmptyCard
            title="Nothing matches those filters"
            body="Try a different search, or clear the filters."
            action={<button onClick={clearFilters} className="text-sm font-medium text-accent hover:underline">Clear filters</button>}
          />
        )
      ) : showBoard ? (
        <TaskBoard
          tasks={boardTasks}
          showBdo={!isBdo}
          // Staff only ever see their own tasks; this keeps it that way if that scoping ever loosens.
          canMove={(t) => !isBdo || t.bdoId === myBdoId}
          isUpdating={(t) => toggleMutation.isPending && toggleMutation.variables?.task.id === t.id}
          onOpen={openEdit}
          onMove={moveTask}
          onReview={isBdo ? undefined : (t) => setReviewing(t)}
          onLogResult={(t) => setPrompt(t)}
          onAttach={(t) => setAttaching(t)}
        />
      ) : (
        // Drag a section by its header to reorder. A status card pinned first (focus) wins over this.
        <SortableGroups
          className="space-y-3"
          keys={groups.map((g) => g.key)}
          disabled={!!focus}
          renderItem={(key, handle) => {
            const g = groups.find((x) => x.key === key);
            if (!g) return null;
            const isOpen = !!expanded[g.key];
            const shown = isOpen ? g.tasks : g.tasks.slice(0, COLLAPSED_ROWS);
            return (
              <section className="bg-surface border border-border rounded-xl shadow-card">
                <div
                  {...handle}
                  title={focus ? undefined : "Drag to reorder"}
                  className={clsx("group/hdr relative px-4 py-2.5 flex items-center gap-3 rounded-t-xl", !focus && "cursor-grab select-none", g.header)}
                >
                  {!focus && (
                    <GripVertical size={14} className="absolute left-0.5 top-1/2 -translate-y-1/2 text-muted/60 opacity-0 transition-opacity group-hover/hdr:opacity-100 max-lg:hidden" />
                  )}
                  <span className={clsx("h-6 w-6 rounded-full grid place-items-center", g.iconWrap)}>
                    <g.Icon size={14} />
                  </span>
                  <h2 className={clsx("text-sm font-semibold", g.titleCls)}>{g.title}</h2>
                  <span className="text-xs text-muted">{plural(g.tasks.length, "task", "tasks")}</span>
                  {g.tasks.length > COLLAPSED_ROWS && (
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [g.key]: !isOpen }))}
                      className={clsx("ml-auto flex items-center gap-1 text-xs font-medium hover:underline", g.titleCls)}
                    >
                      {isOpen ? "Show fewer" : `View all ${g.tasks.length}`} <ArrowRight size={13} className={isOpen ? "-rotate-90" : ""} />
                    </button>
                  )}
                </div>
                <div className="divide-y divide-border/70 border-t border-border">
                  {shown.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      group={g}
                      gridCols={gridCols}
                      showCompany={!oneCompany}
                      showBdo={!isBdo}
                      companyName={t.company ? (byKey[t.company]?.name ?? t.company) : ""}
                      updating={toggleMutation.isPending && toggleMutation.variables?.task.id === t.id}
                      onToggle={() => toggleMutation.mutate({ task: t, status: t.status === "COMPLETED" ? "PENDING" : "COMPLETED" })}
                      onChangeStatus={(status) => toggleMutation.mutate({ task: t, status })}
                      onEdit={() => openEdit(t)}
                      onDelete={() => setToDelete(t)}
                      onAttach={() => setAttaching(t)}
                      onDropFiles={(files) => quickAttach.attach(t, files)}
                      uploading={quickAttach.busy.has(t.id)}
                      onLogResult={() => setPrompt(t)}
                      onReview={isBdo ? undefined : () => setReviewing(t)}
                    />
                  ))}
                </div>
              </section>
            );
          }}
        />
      )}

      {showForm && (
        <TaskForm
          task={editing}
          bdos={bdos}
          clients={clients}
          allTasks={data}
          isBdo={!!isBdo}
          oneCompany={oneCompany}
          myBdoId={myBdoId}
          defaultType={isProposalView ? "PROPOSAL" : "TASK"}
          onClose={() => setShowForm(false)}
          onSaved={(saved, justCompleted) => {
            setShowForm(false);
            refresh();
            const noun = saved.type === "PROPOSAL" ? "Proposal" : "Task";
            const who = saved.bdo?.name ?? bdos.find((b) => b.id === saved.bdoId)?.name;
            toast.success(editing ? `${noun} updated` : `${noun} created`, {
              description: editing || !who ? saved.deliverable : `${saved.deliverable} · assigned to ${saved.bdoId === myBdoId ? "you" : who}`,
            });
            // Finishing work that is linked to a manual KPI: ask whether it produced a result.
            if (justCompleted && saved.kpi && saved.kpi.source !== "AUTO") setPrompt(saved);
          }}
        />
      )}

      {reviewing && (
        <ReviewModal
          // The approvals feed carries the results logged with the task; use it when it has this one.
          task={approvals.find((a) => a.id === reviewing.id) ?? reviewing}
          companyName={oneCompany || !reviewing.company ? "" : (byKey[reviewing.company]?.name ?? reviewing.company)}
          onClose={() => setReviewing(null)}
          onDone={() => { setReviewing(null); refresh(); }}
        />
      )}

      {attaching && (
        <AttachDialog
          task={data.find((t) => t.id === attaching.id) ?? attaching}
          onClose={() => setAttaching(null)}
          onSaved={refresh}
          onEditInstead={() => { const t = attaching; setAttaching(null); openEdit(t); }}
        />
      )}

      {prompt && <ResultPrompt task={prompt} onClose={() => setPrompt(null)} onDone={() => { setPrompt(null); refresh(); }} />}

      {toDelete && (
        <ConfirmDialog
          title={`Delete this ${toDelete.type === "PROPOSAL" ? "proposal" : "task"}?`}
          body={`“${toDelete.deliverable}” will be removed for everyone. This can't be undone.`}
          confirmLabel="Delete"
          busy={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(toDelete.id)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

function EmptyCard({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl shadow-card px-5 py-12 flex flex-col items-center text-center gap-1.5">
      <div className="w-10 h-10 rounded-full bg-subtle text-muted flex items-center justify-center mb-1">
        <ListChecks size={18} strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted max-w-sm">{body}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}