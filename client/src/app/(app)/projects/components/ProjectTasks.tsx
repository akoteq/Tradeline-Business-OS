"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AlertCircle, CalendarDays, Check, CheckCircle2, CircleDashed, Clock, MoreHorizontal, Paperclip, Pencil, Plus, Eye, Target, XCircle } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isExternal, isGroupOwner, isBusinessCeo, isStaff } from "@/lib/auth";
import { toast } from "@/components/Toast";
import { PriorityBadge } from "@/components/Badges";
import { Menu, MenuItem } from "../../leads/components/Menu";
import { dueText } from "../../dashboard/components/ui";
import { TaskForm } from "../../tasks/components/TaskForm";
import { CollaboratorTaskSheet } from "../../tasks/components/CollaboratorTaskSheet";
import { ReviewModal } from "../../tasks/components/ReviewModal";
import { STATUS_LABEL, isOverdue, type Task, type TaskProject } from "../../tasks/components/task-utils";
import { Avatar, apiError, isClosed, type Project } from "../lib";
import { Empty, FilterBar, GroupSection, PrimaryButton, RowsSkeleton, selectClass, type GroupStyle } from "./ui";

/**
 * Every task in the project, which all its members can see. Whoever runs the project adds work
 * for any member; staff on it add work for themselves; outside collaborators update the tasks
 * they were given. The project company's Business CEO (or the Group Owner) approves finished work.
 */

type GroupKey = "overdue" | "progress" | "todo" | "done" | "cancelled";
const GROUPS: Record<GroupKey, GroupStyle> = {
  overdue: { title: "Overdue", Icon: AlertCircle, head: "bg-red-500/5", icon: "bg-red-500/10 text-red-600", text: "text-red-600" },
  progress: { title: "In progress", Icon: Clock, icon: "bg-sky-500/10 text-sky-600" },
  todo: { title: "To do", Icon: CircleDashed, icon: "bg-foreground/5 text-foreground/70" },
  done: { title: "Done", Icon: CheckCircle2, icon: "bg-emerald-500/10 text-emerald-600" },
  cancelled: { title: "Cancelled", Icon: XCircle, icon: "bg-foreground/5 text-foreground/50" },
};
const groupOf = (t: Task): GroupKey =>
  t.status === "COMPLETED" ? "done" : t.status === "CANCELLED" ? "cancelled" : isOverdue(t) ? "overdue" : t.status === "IN_PROGRESS" ? "progress" : "todo";

export function ProjectTasks({ project }: { project: Project }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const external = isExternal(user);
  const me = user?.bdoId ?? null;
  const closed = isClosed(project);
  const canApprove = isGroupOwner(user) || (isBusinessCeo(user) && user?.bdoCompany === project.company);
  const canAdd = !external && !closed && (project.canManage || !!project.myRole);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [viewing, setViewing] = useState<Task | null>(null);
  const [reviewing, setReviewing] = useState<Task | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [owner, setOwner] = useState("");
  const [search, setSearch] = useState("");

  const { data: tasks = [], isLoading } = useQuery<Task[]>({ queryKey: ["tasks", "project", project.id], queryFn: () => fetcher(`/tasks?projectId=${project.id}`) });

  const refresh = () => {
    for (const k of ["tasks", "projects", "project", "project-kpis", "my-kpis", "alerts"]) qc.invalidateQueries({ queryKey: [k] });
  };

  const ctx: TaskProject = {
    id: project.id, name: project.name, company: project.company, canManage: project.canManage,
    members: project.members.map((m) => ({ bdoId: m.bdoId, name: m.name, external: m.external })),
  };

  // Who may change a task: its owner (outsiders only while the project is open), or whoever runs the project.
  const canChange = (t: Task) => (external ? t.bdoId === me && !closed : project.canManage || t.bdoId === me);
  const open = (t: Task) => { if (!external && canChange(t)) setEditing(t); else setViewing(t); };

  const setStatus = async (t: Task, status: string) => {
    setBusy(t.id);
    try {
      await api.put(`/tasks/${t.id}`, { status });
      if (status === "COMPLETED") toast.success("Marked as done", { description: isStaff(user) ? "It now waits for approval." : t.deliverable });
      refresh();
    } catch (err) {
      toast.error("Couldn't update that task", { description: apiError(err, "Please try again.") });
    } finally {
      setBusy(null);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = tasks.filter((t) => (!owner || (owner === "none" ? !t.bdoId : t.bdoId === owner)) && (!q || [t.deliverable, t.bdo?.name, t.kpi?.metric].some((v) => (v ?? "").toLowerCase().includes(q))));
  const anyFilter = !!(owner || q);
  const isOutsider = (bdoId: string | null) => !!project.members.find((m) => m.bdoId === bdoId)?.external;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Everyone on the project sees its tasks.{project.canManage ? " Finished work is approved by the project company's Business CEO." : ""}</p>
        {canAdd && <PrimaryButton icon={Plus} onClick={() => setAdding(true)}>Add task</PrimaryButton>}
      </div>

      {tasks.length > 0 && (
        <FilterBar search={search} onSearch={setSearch} placeholder="Search tasks" onClear={anyFilter ? () => { setOwner(""); setSearch(""); } : undefined}>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={selectClass} aria-label="Owner">
            <option value="">Everyone</option>
            {me && project.members.some((m) => m.bdoId === me) && <option value={me}>Me</option>}
            {project.members.filter((m) => m.bdoId !== me).map((m) => <option key={m.bdoId} value={m.bdoId}>{m.name}</option>)}
            <option value="none">No owner</option>
          </select>
        </FilterBar>
      )}

      {isLoading ? (
        <RowsSkeleton />
      ) : tasks.length === 0 ? (
        <Empty
          title="No tasks yet"
          body={canAdd ? (project.members.length ? "Add the first piece of work and give it to someone on the project." : "Add people to the project first, then give them work.") : "Nothing has been added to this project yet."}
          action={canAdd && project.members.length ? <button onClick={() => setAdding(true)} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">Add a task</button> : undefined}
        />
      ) : shown.length === 0 ? (
        <Empty title="No tasks match" body="Try a different search, or clear the filters." action={<button onClick={() => { setOwner(""); setSearch(""); }} className="text-sm font-medium text-accent hover:underline">Clear filters</button>} />
      ) : (
        (Object.keys(GROUPS) as GroupKey[]).map((g) => {
          const rows = shown.filter((t) => groupOf(t) === g);
          if (!rows.length) return null;
          return (
            <GroupSection key={g} group={GROUPS[g]} count={rows.length} noun={["task", "tasks"]}>
              {(limit) => (limit ? rows.slice(0, limit) : rows).map((t) => {
                const done = t.status === "COMPLETED";
                const editable = canChange(t) && t.status !== "CANCELLED";
                const meta = [
                  t.kpi && <span key="k" className="inline-flex items-center gap-1"><Target size={11} className="text-accent" />{t.kpi.metric}</span>,
                  t.status === "IN_PROGRESS" && t.progress ? <span key="p">{t.progress}% done</span> : null,
                  t.attachments?.length ? <span key="a" className="inline-flex items-center gap-1"><Paperclip size={11} />{t.attachments.length}</span> : null,
                  t.blocked ? <span key="b" className="text-amber-700">Blocked</span> : null,
                ].filter(Boolean);
                return (
                  <li key={t.id} onClick={() => open(t)} className="group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-subtle/50">
                    <button
                      onClick={(e) => { e.stopPropagation(); setStatus(t, done ? "IN_PROGRESS" : "COMPLETED"); }}
                      disabled={!editable || busy === t.id}
                      aria-label={done ? "Mark as not done" : "Mark as done"}
                      title={editable ? (done ? "Mark as not done" : "Mark as done") : "Only its owner or whoever runs the project can change it"}
                      className={clsx(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors disabled:cursor-not-allowed",
                        done ? "bg-emerald-500/10 text-emerald-600" : clsx(GROUPS[g].icon, editable && "hover:bg-emerald-500/15 hover:text-emerald-600"),
                      )}
                    >
                      {done ? <Check size={16} strokeWidth={2.5} /> : (() => { const I = GROUPS[g].Icon; return <I size={16} />; })()}
                    </button>

                    <div className="min-w-0 flex-[1.6_1_0%]">
                      <span className={clsx("block truncate text-sm font-medium transition-colors group-hover:text-accent", done ? "text-muted line-through decoration-foreground/30" : "text-foreground")}>{t.deliverable}</span>
                      <span className="flex min-w-0 items-center gap-2 truncate text-xs text-muted">{meta.length ? meta : STATUS_LABEL[t.status] ?? t.status}</span>
                    </div>

                    <div className="hidden min-w-[5rem] flex-[0.5_1_0%] md:block">{t.priority ? <PriorityBadge value={t.priority} /> : <span className="text-muted/60">—</span>}</div>

                    <div className="hidden min-w-[8rem] flex-[1_1_0%] items-center gap-2 lg:flex">
                      {t.bdo?.name ? (
                        <><Avatar name={t.bdo.name} size="h-6 w-6 text-[10px]" external={isOutsider(t.bdoId)} /><span className="truncate text-sm text-foreground">{t.bdoId === me ? "You" : t.bdo.name}</span></>
                      ) : <span className="text-sm text-muted">Unassigned</span>}
                    </div>

                    <div className="hidden min-w-[9rem] flex-[1_1_0%] items-center gap-1.5 text-sm sm:flex">
                      <CalendarDays size={14} className="shrink-0 text-muted" />
                      {t.targetDate ? <span className={clsx("whitespace-nowrap", isOverdue(t) ? "font-medium text-red-600" : "text-foreground/80")}>{dueText(t.targetDate, t.status)}</span> : <span className="text-muted">—</span>}
                    </div>

                    <div className="w-32 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {t.approval === "PENDING" ? (
                        canApprove
                          ? <button onClick={() => setReviewing(t)} className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-500/20">Review</button>
                          : <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-700">Awaiting approval</span>
                      ) : t.approval === "REJECTED" && t.rejectedReason ? (
                        <span title={t.rejectedReason} className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-700">Sent back</span>
                      ) : done && t.approval === "APPROVED" ? (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">Approved</span>
                      ) : (
                        <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium text-foreground/70">{STATUS_LABEL[t.status] ?? t.status}</span>
                      )}
                    </div>

                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Menu width={190} trigger={({ toggle }) => (
                        <button onClick={toggle} title="More actions" aria-label="More actions" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-accent/10 hover:text-accent"><MoreHorizontal size={16} /></button>
                      )}>
                        {(close) => (
                          <>
                            <MenuItem icon={editable && !external ? <Pencil size={14} /> : <Eye size={14} />} onClick={() => { close(); open(t); }}>{editable ? (external ? "Update progress" : "Edit task") : "View task"}</MenuItem>
                            {editable && !done && t.status !== "IN_PROGRESS" && <MenuItem icon={<Clock size={14} />} onClick={() => { close(); setStatus(t, "IN_PROGRESS"); }}>Start it</MenuItem>}
                            {editable && !done && <MenuItem icon={<Check size={14} />} onClick={() => { close(); setStatus(t, "COMPLETED"); }}>Mark as done</MenuItem>}
                            {canApprove && t.approval === "PENDING" && <MenuItem icon={<CheckCircle2 size={14} />} onClick={() => { close(); setReviewing(t); }}>Review</MenuItem>}
                          </>
                        )}
                      </Menu>
                    </div>
                  </li>
                );
              })}
            </GroupSection>
          );
        })
      )}

      {(adding || editing) && (
        <TaskForm
          task={editing}
          bdos={[]}
          clients={[]}
          allTasks={tasks}
          isBdo={isStaff(user)}
          oneCompany
          myBdoId={me}
          defaultType="TASK"
          project={ctx}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={(saved) => {
            const was = editing;
            setAdding(false); setEditing(null);
            refresh();
            toast.success(was ? "Task updated" : "Task added", { description: saved.deliverable });
          }}
        />
      )}

      {viewing && (
        <CollaboratorTaskSheet
          task={{ ...viewing, project: viewing.project ?? { id: project.id, name: project.name, status: project.status, company: project.company } }}
          readOnly={!canChange(viewing)}
          onClose={() => setViewing(null)}
          onSaved={(saved) => { setViewing(null); refresh(); toast.success("Update saved", { description: saved.deliverable }); }}
        />
      )}

      {reviewing && (
        <ReviewModal task={reviewing} companyName="" onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); refresh(); }} />
      )}
    </div>
  );
}
