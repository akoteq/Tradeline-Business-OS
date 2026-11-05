"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowRight, ChevronDown, Columns3, GripVertical, List, ListChecks, Plus, Search } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isExternal, isGroupOwner, isBusinessCeo, isStaff } from "@/lib/auth";
import { toast } from "@/components/Toast";
import { TaskRow } from "../../tasks/components/TaskRow";
import { TaskForm } from "../../tasks/components/TaskForm";
import { TaskBoard, matchesFocus } from "../../tasks/components/TaskBoard";
import { TaskMoneySheet, hasTaskMoney, type moneyBody } from "../../tasks/components/TaskMoney";
import { CollaboratorTaskSheet } from "../../tasks/components/CollaboratorTaskSheet";
import { ReviewModal } from "../../tasks/components/ReviewModal";
import { ResultPrompt } from "../../tasks/components/ResultPrompt";
import { AttachDialog } from "../../tasks/components/AttachDialog";
import { SortableStats } from "../../tasks/components/SortableStats";
import { SortableGroups } from "../../tasks/components/SortableGroups";
import { ConfirmDialog, FilterSelect, RingStat } from "../../tasks/components/TaskBits";
import { FOCUS_LABEL, useTaskFocus, type FocusKey } from "../../tasks/components/useTaskFocus";
import { useQuickAttach } from "../../tasks/components/useQuickAttach";
import {
  COLLAPSED_ROWS, FILTER_STATUSES, PRIORITIES, PRIORITY_LABEL, PRIORITY_RANK, STATUS_LABEL,
  apiError, dueTime, isDueThisWeek, isOverdue, isUpcoming, plural,
  type SortKey, type Task, type TaskProject,
} from "../../tasks/components/task-utils";
import { isClosed, type Project } from "../lib";

/**
 * The project's tasks, laid out exactly like the Tasks page: status rings, tabs, list or board
 * (drag a card to change its status), the same rows and the same forms. Everyone on the project
 * sees every task. Whoever runs the project adds and changes work for any member; everyone else
 * (outside collaborators included) adds and changes their own. The project company's Business CEO
 * (or the Group Owner) approves finished work.
 */

type Tab = "all" | "mine" | "overdue" | "week" | "approvals";
type View = "list" | "board";
const VIEW_KEY = "trunqo.project-tasks.view";
const EMPTY_FILTERS = { priority: "", status: "", bdoId: "" };

export function ProjectTasks({ project }: { project: Project }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const external = isExternal(user);
  const me = user?.bdoId ?? null;
  const closed = isClosed(project);
  const canApprove = isGroupOwner(user) || (isBusinessCeo(user) && user?.bdoCompany === project.company);
  const canAdd = !closed && (project.canManage || !!project.myRole);

  const [tab, setTab] = useState<Tab>("all");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("soonest");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<{ task: Task | null } | null>(null);
  const [sheet, setSheet] = useState<{ task: Task | null } | null>(null);
  const [reviewing, setReviewing] = useState<Task | null>(null);
  const [attaching, setAttaching] = useState<Task | null>(null);
  const [prompt, setPrompt] = useState<Task | null>(null);
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const { focus, toggle: toggleFocus, clear: clearFocus, arrange } = useTaskFocus();

  // List or Board, remembered on this device (separately from the Tasks page).
  const [view, setView] = useState<View | null>(null);
  useEffect(() => {
    try { setView(localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list"); } catch { setView("list"); }
  }, []);
  const changeView = (v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode: the choice just won't stick */ }
  };

  const tasksKey = ["tasks", "project", project.id];
  const { data = [], isLoading, isError, refetch } = useQuery<Task[]>({ queryKey: tasksKey, queryFn: () => fetcher(`/tasks?projectId=${project.id}`) });

  const refresh = () => {
    for (const k of ["tasks", "projects", "project", "project-kpis", "my-kpis", "alerts", "deal-payments"]) qc.invalidateQueries({ queryKey: [k] });
  };
  const quickAttach = useQuickAttach(refresh);

  const ctx: TaskProject = {
    id: project.id, name: project.name, company: project.company, canManage: project.canManage,
    members: project.members.map((m) => ({ bdoId: m.bdoId, name: m.name, external: m.external })),
  };

  // Who may change a task: its owner (outsiders only while the project is open), or whoever runs the project.
  const canChange = (t: Task) => (external ? t.bdoId === me && !closed : project.canManage || t.bdoId === me);
  const openTask = (t: Task) => {
    if (external || !canChange(t)) setSheet({ task: t });
    else setForm({ task: t });
  };
  const openAdd = () => (external ? setSheet({ task: null }) : setForm({ task: null }));

  const toggleMutation = useMutation({
    mutationFn: ({ task, status, completionMoney }: { task: Task; status: string; completionMoney?: ReturnType<typeof moneyBody> }) => {
      if (!canChange(task)) return Promise.reject(new Error("Only its owner or whoever runs the project can change it."));
      return api.put(`/tasks/${task.id}`, { status, ...(completionMoney ? { completionMoney } : {}) });
    },
    onSuccess: (res, { status }) => {
      refresh();
      const saved = res.data as Task;
      if (status === "COMPLETED") toast.success("Marked as done", { description: isStaff(user) ? `${saved.deliverable} · waiting for approval` : saved.deliverable });
      if (status === "COMPLETED" && !external && saved.kpi && saved.kpi.source !== "AUTO") setPrompt(saved);
    },
    onError: (err) => toast.error("Couldn't update that task", { description: err instanceof Error && !("response" in err) ? err.message : apiError(err, "Please try again.") }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => { refresh(); if (toDelete) toast.success("Task deleted", { description: toDelete.deliverable }); setToDelete(null); },
    onError: (err) => { setToDelete(null); toast.error("Couldn't delete that", { description: apiError(err, "Please try again.") }); },
  });

  // A manager's finished task counts at once, so they say what was received and spent first.
  const [finishing, setFinishing] = useState<Task | null>(null);
  const needsMoney = (task: Task, status: string) => (isGroupOwner(user) || isBusinessCeo(user)) && status === "COMPLETED" && task.status !== "COMPLETED" && hasTaskMoney(task);
  const changeStatus = (task: Task, status: string) => {
    if (needsMoney(task, status)) setFinishing(task);
    else toggleMutation.mutate({ task, status });
  };

  // Board drop: the card moves straight away; if the server says no it goes back.
  const moveTask = async (task: Task, to: string) => {
    if (needsMoney(task, to)) { setFinishing(task); return; }
    const setStatus = (status: string) => qc.setQueryData<Task[]>(tasksKey, (old) => old?.map((x) => (x.id === task.id ? { ...x, status } : x)));
    setStatus(to);
    try { await toggleMutation.mutateAsync({ task, status: to }); } catch { setStatus(task.status); }
  };

  /* ---- numbers ---- */
  const total = data.length;
  const completedN = data.filter((t) => t.status === "COMPLETED").length;
  const overdueN = data.filter(isOverdue).length;
  const upcomingN = data.filter((t) => isUpcoming(t, 7)).length;
  const notStartedN = data.filter((t) => t.status === "PENDING").length;
  const blockedN = data.filter((t) => t.blocked).length;
  const mineN = me ? data.filter((t) => t.bdoId === me).length : 0;
  const weekN = data.filter(isDueThisWeek).length;
  const waitingN = data.filter((t) => t.approval === "PENDING").length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  /* ---- filter, tab, sort ---- */
  const q = search.trim().toLowerCase();
  const matches = (t: Task) =>
    (!q || [t.deliverable, t.notes, t.bdo?.name, t.kpi?.metric].some((v) => (v ?? "").toLowerCase().includes(q))) &&
    (!filters.priority || t.priority === filters.priority) &&
    (!filters.bdoId || (filters.bdoId === "none" ? !t.bdoId : t.bdoId === filters.bdoId)) &&
    (!filters.status || (filters.status === "BLOCKED" ? t.blocked : filters.status === "OVERDUE" ? isOverdue(t) : t.status === filters.status)) &&
    (tab === "mine" ? t.bdoId === me : tab === "overdue" ? isOverdue(t) : tab === "week" ? isDueThisWeek(t) : tab === "approvals" ? t.approval === "PENDING" : true);
  const sorter = (a: Task, b: Task) => {
    if (sort === "priority") { const d = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9); if (d) return d; }
    const ta = dueTime(a)?.getTime() ?? Infinity, tb = dueTime(b)?.getTime() ?? Infinity;
    if (ta === tb) return 0;
    if (ta === Infinity) return 1;
    if (tb === Infinity) return -1;
    return sort === "latest" ? tb - ta : ta - tb;
  };
  const visible = data.filter(matches).sort(sorter);
  const groups = arrange(visible);
  const showBoard = view === "board";
  const boardTasks = focus ? visible.filter((t) => matchesFocus(focus, t)) : visible;
  const focusProps = (key: FocusKey) => ({
    onClick: () => toggleFocus(key),
    active: focus === key,
    hint: focus === key ? (showBoard ? "Click to show every task again" : "Click to go back to the normal order") : (showBoard ? "Click to show only these" : "Click to show these first"),
  });
  const filtering = !!q || tab !== "all" || Object.values(filters).some(Boolean);
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setSearch(""); setTab("all"); };

  const gridCols = ["24px", "minmax(0,2.4fr)", "84px", "minmax(0,1.2fr)", "132px", "190px", "28px"].join(" ");

  const tabs: { key: Tab; label: string; count: number; badge: string }[] = [
    { key: "all", label: "All tasks", count: total, badge: "" },
    ...(me && project.myRole ? [{ key: "mine" as Tab, label: "My tasks", count: mineN, badge: "" }] : []),
    { key: "overdue", label: "Overdue", count: overdueN, badge: "bg-red-50 text-red-600" },
    { key: "week", label: "Due this week", count: weekN, badge: "" },
    { key: "approvals", label: "Awaiting approval", count: waitingN, badge: waitingN ? "bg-sky-50 text-sky-700" : "" },
  ];

  return (
    <div className="space-y-4">
      {/* Stat rings: tap one to show those first (list) or only those (board). Drag to reorder. */}
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

      {focus && (
        <div className="-mt-1 flex items-center gap-2 text-sm text-muted">
          <span>Showing <span className="font-medium text-foreground">{FOCUS_LABEL[focus]}</span> {showBoard ? "only" : "first"}.</span>
          <button onClick={clearFocus} className="font-medium text-accent hover:underline">{showBoard ? "Show every task" : "Back to normal order"}</button>
        </div>
      )}

      {/* Tabs + view + sort + add */}
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
                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium tabular-nums", t.badge || (active ? "bg-accent/10 text-accent" : "bg-subtle text-muted"))}>{t.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex w-full sm:w-auto items-center gap-2.5">
          <div className="inline-flex shrink-0 rounded-lg border border-border bg-surface p-0.5">
            {([["list", "List", List], ["board", "Board", Columns3]] as const).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => changeView(k)}
                aria-pressed={view === k}
                title={`${label} view`}
                className={clsx("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors", view === k ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground")}
              >
                <Icon size={14} />
                <span className="max-sm:hidden">{label}</span>
              </button>
            ))}
          </div>
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
          {canAdd && (
            <button onClick={openAdd} className="h-9 shrink-0 flex items-center gap-1.5 bg-accent text-accent-foreground rounded-lg px-3.5 text-sm font-semibold hover:opacity-90 transition-opacity">
              <Plus size={16} /> New task
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-surface border border-border rounded-xl shadow-card p-2.5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
        <FilterSelect label="Filter by priority" value={filters.priority} onChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
          <option value="">All priorities</option>
          {[...PRIORITIES].reverse().map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </FilterSelect>
        <FilterSelect label="Filter by status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
          <option value="">All statuses</option>
          {FILTER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </FilterSelect>
        <FilterSelect label="Filter by owner" value={filters.bdoId} onChange={(v) => setFilters((f) => ({ ...f, bdoId: v }))}>
          <option value="">Everyone</option>
          {project.members.map((m) => <option key={m.bdoId} value={m.bdoId}>{m.bdoId === me ? "Me" : m.name}{m.external ? " (outside)" : ""}</option>)}
          <option value="none">No owner</option>
        </FilterSelect>
        <div className="relative col-span-2 order-first sm:order-none sm:col-auto w-full sm:w-72 sm:ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search tasks"
            placeholder="Search by task, person or KPI"
            className="w-full h-9 bg-surface border border-border rounded-lg pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>
      </div>

      {showBoard && !isLoading && !isError && data.length > 0 && (
        <p className="hidden text-xs text-muted sm:block -mt-1">Drag a card to change its status. Dropping on Done works like ticking the box.</p>
      )}

      {/* Body */}
      {isLoading || view === null ? (
        <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-subtle animate-pulse" />)}</div>
      ) : isError ? (
        <EmptyCard title="We couldn't load the tasks" body="Check your connection and try again." action={<button onClick={() => refetch()} className="text-sm font-medium text-accent hover:underline">Try again</button>} />
      ) : groups.length === 0 ? (
        data.length === 0 && !filtering ? (
          <EmptyCard
            title="No tasks yet"
            body={canAdd ? (project.members.length ? "Add the first piece of work. Give it an owner and a due date and it shows up here." : "Add people to the project first, then give them work.") : "Nothing has been added to this project yet."}
            action={canAdd && project.members.length ? <button onClick={openAdd} className="text-sm font-medium text-accent hover:underline">New task</button> : undefined}
          />
        ) : (
          <EmptyCard title="Nothing matches those filters" body="Try a different search, or clear the filters." action={<button onClick={clearFilters} className="text-sm font-medium text-accent hover:underline">Clear filters</button>} />
        )
      ) : showBoard ? (
        <TaskBoard
          tasks={boardTasks}
          showBdo
          canMove={canChange}
          isUpdating={(t) => toggleMutation.isPending && toggleMutation.variables?.task.id === t.id}
          onOpen={openTask}
          onMove={moveTask}
          onReview={canApprove ? (t) => setReviewing(t) : undefined}
          onLogResult={(t) => setPrompt(t)}
          onAttach={(t) => (canChange(t) ? setAttaching(t) : openTask(t))}
        />
      ) : (
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
                <div {...handle} title={focus ? undefined : "Drag to reorder"} className={clsx("group/hdr relative px-4 py-2.5 flex items-center gap-3 rounded-t-xl", !focus && "cursor-grab select-none", g.header)}>
                  {!focus && <GripVertical size={14} className="absolute left-0.5 top-1/2 -translate-y-1/2 text-muted/60 opacity-0 transition-opacity group-hover/hdr:opacity-100 max-lg:hidden" />}
                  <span className={clsx("h-6 w-6 rounded-full grid place-items-center", g.iconWrap)}><g.Icon size={14} /></span>
                  <h2 className={clsx("text-sm font-semibold", g.titleCls)}>{g.title}</h2>
                  <span className="text-xs text-muted">{plural(g.tasks.length, "task", "tasks")}</span>
                  {g.tasks.length > COLLAPSED_ROWS && (
                    <button onClick={() => setExpanded((e) => ({ ...e, [g.key]: !isOpen }))} className={clsx("ml-auto flex items-center gap-1 text-xs font-medium hover:underline", g.titleCls)}>
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
                      showCompany={false}
                      showBdo
                      companyName=""
                      updating={toggleMutation.isPending && toggleMutation.variables?.task.id === t.id}
                      onToggle={() => changeStatus(t, t.status === "COMPLETED" ? "PENDING" : "COMPLETED")}
                      onChangeStatus={(status) => changeStatus(t, status)}
                      onEdit={() => openTask(t)}
                      onDelete={project.canManage && !external ? () => setToDelete(t) : undefined}
                      onAttach={() => (canChange(t) ? setAttaching(t) : openTask(t))}
                      onDropFiles={(files) => (canChange(t) ? quickAttach.attach(t, files) : undefined)}
                      uploading={quickAttach.busy.has(t.id)}
                      onLogResult={() => setPrompt(t)}
                      onReview={canApprove ? () => setReviewing(t) : undefined}
                    />
                  ))}
                </div>
              </section>
            );
          }}
        />
      )}

      {finishing && (
        <TaskMoneySheet
          task={finishing} title="Finish this task" confirmLabel="Mark as done" busy={toggleMutation.isPending}
          onConfirm={(completionMoney) => toggleMutation.mutate({ task: finishing, status: "COMPLETED", completionMoney }, { onSettled: () => setFinishing(null) })}
          onClose={() => setFinishing(null)}
        />
      )}
      {form && (
        <TaskForm
          task={form.task}
          bdos={[]}
          clients={[]}
          allTasks={data}
          isBdo={isStaff(user)}
          oneCompany
          myBdoId={me}
          defaultType="TASK"
          project={ctx}
          onClose={() => setForm(null)}
          onSaved={(saved, justCompleted) => {
            const was = form.task;
            setForm(null);
            refresh();
            const who = project.members.find((m) => m.bdoId === saved.bdoId)?.name;
            toast.success(was ? "Task updated" : "Task created", { description: was || !who ? saved.deliverable : `${saved.deliverable} · assigned to ${saved.bdoId === me ? "you" : who}` });
            if (justCompleted && saved.kpi && saved.kpi.source !== "AUTO") setPrompt(saved);
          }}
        />
      )}

      {sheet && (
        <CollaboratorTaskSheet
          task={sheet.task}
          project={{ id: project.id, name: project.name }}
          readOnly={!!sheet.task && !canChange(sheet.task)}
          onClose={() => setSheet(null)}
          onSaved={(saved) => { const was = sheet.task; setSheet(null); refresh(); toast.success(was ? "Update saved" : "Task added", { description: saved.deliverable }); }}
        />
      )}

      {reviewing && <ReviewModal task={reviewing} companyName="" onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); refresh(); }} />}

      {attaching && (
        <AttachDialog
          task={data.find((t) => t.id === attaching.id) ?? attaching}
          onClose={() => setAttaching(null)}
          onSaved={refresh}
          onEditInstead={() => { const t = attaching; setAttaching(null); openTask(t); }}
        />
      )}

      {prompt && !external && <ResultPrompt task={prompt} onClose={() => setPrompt(null)} onDone={() => { setPrompt(null); refresh(); }} />}

      {toDelete && (
        <ConfirmDialog
          title="Delete this task?"
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
      <div className="w-10 h-10 rounded-full bg-subtle text-muted flex items-center justify-center mb-1"><ListChecks size={18} strokeWidth={1.75} /></div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted max-w-sm">{body}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
