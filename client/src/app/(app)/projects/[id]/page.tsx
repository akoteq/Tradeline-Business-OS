"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowLeft, CalendarDays, Crown, Lock, Pencil, Trash2 } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isGroupOwner } from "@/lib/auth";
import { useCompanies, companyBadgeClass } from "@/lib/companies";
import { BrandLoader } from "@/components/BrandLoader";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { ProjectStatusPill, apiError, dateRange, isClosed, type Project } from "../lib";
import { ProjectFormSheet } from "../components/ProjectFormSheet";
import { ProjectTasks } from "../components/ProjectTasks";
import { ProjectPeople } from "../components/ProjectPeople";
import { ProjectKpis } from "../components/ProjectKpis";
import { Empty, OutlineButton, PageHeader, StatCards, TextTabs, type Stat } from "../components/ui";

type Tab = "tasks" | "people" | "kpis";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const { byKey } = useCompanies();
  const [tab, setTab] = useState<Tab>("tasks");
  const [editing, setEditing] = useState(false);

  // ?tab=people right after starting a project, so the next step is adding its people.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "people" || t === "kpis" || t === "tasks") setTab(t);
  }, []);

  const key = ["project", id];
  const { data: project, isLoading, isError } = useQuery<Project>({ queryKey: key, queryFn: () => fetcher(`/projects/${id}`), enabled: !!user, retry: false });
  const { data: kpiCount } = useQuery<number>({
    queryKey: ["project-kpis", id, "count"],
    queryFn: () => fetcher(`/projects/${id}/kpis`).then((rows: unknown[]) => rows.length),
    enabled: !!project,
  });
  const changed = (p: Project) => { qc.setQueryData(key, p); qc.invalidateQueries({ queryKey: ["projects"] }); };

  if (isLoading || !user) return <BrandLoader />;
  if (isError || !project) {
    return (
      <div className="p-4 md:p-6">
        <Empty title="Project not found" body="It may have been deleted, or you're not on it." action={<Link href="/projects" className="text-sm font-medium text-accent hover:underline">Back to projects</Link>} />
      </div>
    );
  }

  const company = byKey[project.company];
  const range = dateRange(project);
  const t = project.tasks;
  const outsiders = project.members.filter((m) => m.external).length;
  const of = t.total || 1;
  const stats: Stat[] = [
    { key: "done", label: "Done", value: t.done, share: t.done / of, ring: "text-emerald-500", text: "text-emerald-700", note: `of ${t.total} task${t.total === 1 ? "" : "s"}` },
    { key: "open", label: "Open", value: t.open, share: t.open / of, ring: "text-sky-500", text: "text-sky-700" },
    { key: "overdue", label: "Overdue", value: t.overdue, share: t.overdue / of, ring: "text-red-500", text: "text-red-700" },
    { key: "review", label: "Awaiting approval", value: t.awaitingApproval, share: t.awaitingApproval / of, ring: "text-violet-500", text: "text-violet-700" },
  ];

  const remove = async () => {
    const ok = await confirmAction({
      title: `Delete ${project.name}?`,
      body: "The project, its people list and its KPIs go. Its tasks stay, without the project.",
      confirmLabel: "Delete project",
    });
    if (!ok) return;
    try {
      await api.delete(`/projects/${project.id}`);
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted", { description: project.name });
      router.replace("/projects");
    } catch (err) {
      toast.error("Couldn't delete the project", { description: apiError(err, "Please try again.") });
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
        <ArrowLeft size={15} /> Projects
      </Link>

      <PageHeader
        title={project.name}
        sub={
          <div className="space-y-2">
            {project.description && <p>{project.description}</p>}
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <span className={clsx("inline-block rounded-full px-2 py-0.5 text-xs font-medium", companyBadgeClass(company?.color))}>{company?.name ?? (project.company === "SHARED" ? "Shared" : project.company)}</span>
              <ProjectStatusPill status={project.status} />
              <span className="inline-flex items-center gap-1.5"><Crown size={14} className={project.myRole === "LEAD" ? "text-accent" : undefined} />
                {project.myRole === "LEAD" ? "You lead this" : project.lead?.name ? `Led by ${project.lead.name}` : project.leader ? `Led by ${project.leader}` : "No lead yet"}
              </span>
              {range && <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{range}</span>}
            </p>
          </div>
        }
        actions={(project.canManage || project.canDelete) && (
          <>
            {project.canManage && <OutlineButton icon={Pencil} onClick={() => setEditing(true)}>Edit</OutlineButton>}
            {project.canDelete && <OutlineButton icon={Trash2} danger onClick={remove}>Delete</OutlineButton>}
          </>
        )}
      />

      {isClosed(project) && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          <Lock size={15} className="shrink-0" /> This project is {project.status === "COMPLETED" ? "completed" : "cancelled"}. Outside collaborators can still see it, but can&apos;t change anything.
        </div>
      )}

      {project.notes && project.canManage && (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <span className="text-muted">Private notes: </span><span className="whitespace-pre-wrap text-foreground">{project.notes}</span>
        </div>
      )}

      <StatCards stats={stats} />

      <TextTabs
        label="Project sections"
        active={tab}
        onSelect={setTab}
        tabs={[
          { id: "tasks", label: "Tasks", count: t.total, flag: false },
          { id: "people", label: outsiders ? `People (${outsiders} outside)` : "People", count: project.members.length },
          { id: "kpis", label: "KPIs", count: kpiCount },
        ]}
      />

      {tab === "tasks" && <ProjectTasks project={project} />}
      {tab === "people" && <ProjectPeople project={project} onChanged={changed} />}
      {tab === "kpis" && <ProjectKpis project={project} />}

      {editing && (
        <ProjectFormSheet
          project={project}
          canPickCompany={isGroupOwner(user)}
          onClose={() => setEditing(false)}
          onSaved={(saved) => { setEditing(false); changed(saved); toast.success("Project updated"); }}
        />
      )}
    </div>
  );
}
