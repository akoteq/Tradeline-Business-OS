"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AlertCircle, CalendarDays, CheckCircle2, Crown, Eye, FolderKanban, MoreHorizontal, PauseCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isExternal, isGroupOwner, isManager } from "@/lib/auth";
import { useCompanies, companyBadgeClass } from "@/lib/companies";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { Menu, MenuItem } from "../leads/components/Menu";
import { Avatar, ProjectStatusPill, apiError, fmtDay, isClosed, type Project } from "./lib";
import { ProjectFormSheet } from "./components/ProjectFormSheet";
import {
  Empty, FilterBar, GroupSection, PageHeader, PrimaryButton, RowsSkeleton, StatCards, TextTabs, selectClass,
  type GroupStyle, type Stat, type TabDef,
} from "./components/ui";

/**
 * Projects: small teams of chosen people, staff or outside collaborators, each with its own tasks
 * and KPIs. Managers see every project in their reach; everyone else sees the ones they're on.
 * Laid out like Leads: stat cards, tabs, a filter bar, then the projects grouped by what needs doing.
 */

type View = "all" | "mine" | "lead" | "attention";
type GroupKey = "attention" | "active" | "hold" | "done";
type Sort = "name" | "ending" | "newest";

const GROUPS: Record<GroupKey, GroupStyle> = {
  attention: { title: "Needs attention", Icon: AlertCircle, head: "bg-red-500/5", icon: "bg-red-500/10 text-red-600", text: "text-red-600" },
  active: { title: "Active", Icon: FolderKanban, icon: "bg-emerald-500/10 text-emerald-600" },
  hold: { title: "On hold", Icon: PauseCircle, icon: "bg-amber-500/10 text-amber-600" },
  done: { title: "Finished", Icon: CheckCircle2, icon: "bg-foreground/5 text-foreground/70" },
};
const groupOf = (p: Project): GroupKey =>
  isClosed(p) ? "done" : p.tasks.overdue > 0 ? "attention" : p.status === "ON_HOLD" ? "hold" : "active";

export default function ProjectsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const { companies, byKey } = useCompanies();
  const owner = isGroupOwner(user);
  const manager = isManager(user);
  const external = isExternal(user);

  const [view, setView] = useState<View>("all");
  const [stat, setStat] = useState("");
  const [company, setCompany] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [form, setForm] = useState<{ project: Project | null } | null>(null);

  const { data: projects = [], isLoading, isError, refetch } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetcher("/projects"),
    enabled: !!user,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["projects"] });

  const total = projects.length || 1;
  const n = (f: (p: Project) => boolean) => projects.filter(f).length;
  const stats: Stat[] = [
    { key: "ACTIVE", label: "Active", value: n((p) => p.status === "ACTIVE"), share: n((p) => p.status === "ACTIVE") / total, ring: "text-emerald-500", text: "text-emerald-700" },
    { key: "OVERDUE", label: "With overdue work", value: n((p) => !isClosed(p) && p.tasks.overdue > 0), share: n((p) => !isClosed(p) && p.tasks.overdue > 0) / total, ring: "text-red-500", text: "text-red-700" },
    { key: "ON_HOLD", label: "On hold", value: n((p) => p.status === "ON_HOLD"), share: n((p) => p.status === "ON_HOLD") / total, ring: "text-amber-500", text: "text-amber-700" },
    { key: "FINISHED", label: "Finished", value: n(isClosed), share: n(isClosed) / total, ring: "text-zinc-400", text: "text-foreground/70", note: "Completed · Cancelled" },
  ];
  const matchesStat = (p: Project) =>
    !stat || (stat === "OVERDUE" ? !isClosed(p) && p.tasks.overdue > 0 : stat === "FINISHED" ? isClosed(p) : p.status === stat);

  const memberOf = n((p) => !!p.myRole);
  const tabs: TabDef<View>[] = [
    { id: "all", label: manager ? "All projects" : "My projects", count: projects.length },
    ...(manager && memberOf ? [{ id: "mine" as const, label: "I'm on", count: memberOf }] : []),
    ...(n((p) => p.myRole === "LEAD") ? [{ id: "lead" as const, label: "I lead", count: n((p) => p.myRole === "LEAD") }] : []),
    { id: "attention", label: "Overdue work", count: n((p) => !isClosed(p) && p.tasks.overdue > 0), flag: true },
  ];
  const matchesView = (p: Project) =>
    view === "mine" ? !!p.myRole : view === "lead" ? p.myRole === "LEAD" : view === "attention" ? !isClosed(p) && p.tasks.overdue > 0 : true;

  const q = search.trim().toLowerCase();
  const sorter = (a: Project, b: Project) =>
    sort === "ending" ? (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999")
    : sort === "newest" ? b.id.localeCompare(a.id)
    : a.name.localeCompare(b.name);
  const shown = projects
    .filter((p) => matchesView(p) && matchesStat(p) && (!company || p.company === company))
    .filter((p) => !q || [p.name, p.description, p.lead?.name, byKey[p.company]?.name, ...p.members.map((m) => m.name)].some((v) => (v ?? "").toLowerCase().includes(q)))
    .sort(sorter);
  const anyFilter = !!(stat || company || q || view !== "all");
  const clear = () => { setStat(""); setCompany(""); setSearch(""); setView("all"); };

  const remove = async (p: Project) => {
    const ok = await confirmAction({ title: `Delete ${p.name}?`, body: "The project, its people list and its KPIs go. Its tasks stay, without the project.", confirmLabel: "Delete project" });
    if (!ok) return;
    try { await api.delete(`/projects/${p.id}`); refresh(); toast.success("Project deleted", { description: p.name }); }
    catch (err) { toast.error("Couldn't delete the project", { description: apiError(err, "Please try again.") }); }
  };

  const sub = external
    ? "The projects you've been brought in to work on."
    : manager
    ? "Each project has its own people, tasks and KPIs. Only the people on a project see it."
    : "Projects you're on. Only the people on a project see it.";

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title={manager ? "Projects" : "My projects"}
        sub={sub}
        actions={
          <>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort projects" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40">
              <option value="name">Name A–Z</option>
              <option value="ending">Ending soonest</option>
              <option value="newest">Newest first</option>
            </select>
            {manager && <PrimaryButton icon={Plus} onClick={() => setForm({ project: null })}>New project</PrimaryButton>}
          </>
        }
      />

      {projects.length > 0 && <StatCards stats={stats} active={stat} onSelect={setStat} />}

      {projects.length > 0 && (
        <div className="space-y-3">
          <TextTabs label="Project views" tabs={tabs} active={view} onSelect={setView} />
          <FilterBar search={search} onSearch={setSearch} placeholder="Search by project or person" onClear={anyFilter ? clear : undefined}>
            {owner && (
              <select value={company} onChange={(e) => setCompany(e.target.value)} className={selectClass} aria-label="Company">
                <option value="">All companies</option>
                {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                <option value="SHARED">Shared</option>
              </select>
            )}
          </FilterBar>
        </div>
      )}

      {isLoading ? (
        <RowsSkeleton />
      ) : isError ? (
        <Empty title="We couldn't load projects" body="Check your connection and try again." action={<button onClick={() => refetch()} className="text-sm font-medium text-accent hover:underline">Try again</button>} />
      ) : projects.length === 0 ? (
        <Empty
          title={manager ? "No projects yet" : "You're not on any projects yet"}
          body={manager ? "Start one, add the people working on it (staff or outside collaborators), then give them tasks." : "When someone adds you to a project it shows up here."}
          action={manager ? <button onClick={() => setForm({ project: null })} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">Start a project</button> : undefined}
        />
      ) : shown.length === 0 ? (
        <Empty title="No projects match" body="Try a different search, or clear the filters." action={<button onClick={clear} className="text-sm font-medium text-accent hover:underline">Clear filters</button>} />
      ) : (
        <div className="space-y-3">
          {(Object.keys(GROUPS) as GroupKey[]).map((g) => {
            const rows = shown.filter((p) => groupOf(p) === g);
            if (!rows.length) return null;
            return (
              <GroupSection key={g} group={GROUPS[g]} count={rows.length} noun={["project", "projects"]}>
                {(limit) => (limit ? rows.slice(0, limit) : rows).map((p) => (
                  <ProjectRow
                    key={p.id} p={p} iconTone={GROUPS[g].icon} showCompany={owner}
                    companyName={byKey[p.company]?.name ?? (p.company === "SHARED" ? "Shared" : p.company)} companyColor={byKey[p.company]?.color}
                    onOpen={() => router.push(`/projects/${p.id}`)}
                    onEdit={p.canManage ? () => setForm({ project: p }) : undefined}
                    onDelete={p.canDelete ? () => remove(p) : undefined}
                  />
                ))}
              </GroupSection>
            );
          })}
        </div>
      )}

      {form && (
        <ProjectFormSheet
          project={form.project}
          canPickCompany={owner}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            const wasNew = !form.project;
            setForm(null);
            refresh();
            if (wasNew) {
              toast.success("Project started", { description: "Now add the people working on it." });
              router.push(`/projects/${saved.id}?tab=people`);
            } else toast.success("Project updated", { description: saved.name });
          }}
        />
      )}
    </div>
  );
}

function ProjectRow({ p, iconTone, showCompany, companyName, companyColor, onOpen, onEdit, onDelete }: {
  p: Project; iconTone: string; showCompany: boolean; companyName: string; companyColor?: string;
  onOpen: () => void; onEdit?: () => void; onDelete?: () => void;
}) {
  const pct = p.tasks.total ? Math.round((p.tasks.done / p.tasks.total) * 100) : 0;
  const outsiders = p.members.filter((m) => m.external).length;
  const sub = p.description || (p.members.length ? `${p.members.length} ${p.members.length === 1 ? "person" : "people"}${outsiders ? `, ${outsiders} from outside` : ""}` : "No one added yet");
  const ends = fmtDay(p.endDate);
  return (
    <li onClick={onOpen} className="group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-subtle/50">
      <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full", iconTone)}><FolderKanban size={16} /></span>

      <div className="min-w-0 flex-[1.6_1_0%]">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-accent">{p.name}</span>
          {p.myRole === "LEAD" && <span title="You lead this" className="shrink-0 text-accent"><Crown size={12} /></span>}
        </div>
        <div className="truncate text-xs text-muted">{sub}</div>
      </div>

      {showCompany && (
        <div className="hidden min-w-[7rem] flex-[0.7_1_0%] md:block">
          <span className={clsx("inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium", companyBadgeClass(companyColor))}>{companyName}</span>
        </div>
      )}

      <div className="hidden min-w-[8rem] flex-[1_1_0%] items-center gap-2 lg:flex">
        {p.lead?.name ? (
          <><Avatar name={p.lead.name} size="h-6 w-6 text-[10px]" /><span className="truncate text-sm text-foreground">{p.lead.name}</span></>
        ) : <span className="text-sm text-muted">{p.leader || "No lead"}</span>}
      </div>

      <div className="hidden min-w-[9rem] flex-[1_1_0%] sm:block">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{p.tasks.total ? `${p.tasks.done}/${p.tasks.total} done` : "No tasks"}</span>
          {p.tasks.overdue > 0 && !isClosed(p) && <span className="font-medium text-red-600">{p.tasks.overdue} overdue</span>}
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-foreground/5"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="hidden min-w-[7.5rem] items-center gap-1.5 text-sm xl:flex">
        <CalendarDays size={14} className="shrink-0 text-muted" />
        {ends ? <span className="whitespace-nowrap text-foreground/80">{ends}</span> : <span className="text-muted">—</span>}
      </div>

      <div className="w-24 shrink-0"><ProjectStatusPill status={p.status} /></div>

      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <Menu width={190} trigger={({ toggle }) => (
          <button onClick={toggle} title="More actions" aria-label="More actions" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-accent/10 hover:text-accent"><MoreHorizontal size={16} /></button>
        )}>
          {(close) => (
            <>
              <MenuItem icon={<Eye size={14} />} onClick={() => { close(); onOpen(); }}>Open project</MenuItem>
              {onEdit && <MenuItem icon={<Pencil size={14} />} onClick={() => { close(); onEdit(); }}>Edit details</MenuItem>}
              {onDelete && <MenuItem icon={<Trash2 size={14} />} danger onClick={() => { close(); onDelete(); }}>Delete</MenuItem>}
            </>
          )}
        </Menu>
      </div>
    </li>
  );
}
