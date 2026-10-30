"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Crown, Mail, MailPlus, MoreHorizontal, UserMinus, UserPlus, UserRoundCog, Users } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useCompanies, companyBadgeClass } from "@/lib/companies";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { KpiSheet } from "@/components/kpi";
import { Menu, MenuItem } from "../../leads/components/Menu";
import { Empty, GroupSection, OutlineButton, PrimaryButton } from "./ui";
import { Avatar, Field, FormError, OutsiderTag, apiError, inputClass, primaryBtn, secondaryBtn, type Person, type Project } from "../lib";

/**
 * Who's on the project. Only they (plus the company's Business CEO and the Group Owner) see it.
 * Whoever runs it adds staff from the project's company, or invites an outside collaborator, who
 * gets a login that opens only the projects they're on.
 */
export function ProjectPeople({ project, onChanged }: { project: Project; onChanged: (p: Project) => void }) {
  const { user } = useAuth();
  const { byKey } = useCompanies();
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const manage = project.canManage;

  const act = async (bdoId: string, job: () => Promise<{ data: Project }>, success: string) => {
    setBusy(bdoId);
    try { const r = await job(); onChanged(r.data); toast.success(success); }
    catch (err) { toast.error("Couldn't change that", { description: apiError(err, "Please try again.") }); }
    finally { setBusy(null); }
  };

  const remove = async (m: Project["members"][number]) => {
    const ok = await confirmAction({
      title: `Take ${m.name} off the project?`,
      body: m.external ? "They'll no longer see this project. Their login stays, for any other projects they're on." : "They'll no longer see this project or its tasks.",
      confirmLabel: "Remove",
    });
    if (ok) act(m.bdoId, () => api.delete(`/projects/${project.id}/members/${m.bdoId}`), `${m.name} removed`);
  };

  const members = [...project.members].sort((a, b) => (a.role === "LEAD" ? -1 : b.role === "LEAD" ? 1 : Number(a.external) - Number(b.external) || a.name.localeCompare(b.name)));

  const staff = members.filter((m) => !m.external);
  const outsiders = members.filter((m) => m.external);

  const row = (m: Project["members"][number]) => (
    <li key={m.bdoId} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-subtle/50">
      <Avatar name={m.name} external={m.external} size="h-9 w-9 text-xs" />
      <div className="min-w-0 flex-[1.6_1_0%]">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
          {m.bdoId === user?.bdoId && <span className="text-xs text-muted">(you)</span>}
          {m.role === "LEAD" && <span title="Runs the project" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"><Crown size={11} /> Lead</span>}
        </div>
        <div className="truncate text-xs text-muted">{m.title || (m.external ? "Outside collaborator" : "Team member")}</div>
      </div>
      <div className="hidden min-w-[8rem] flex-[1_1_0%] md:block">
        {m.external ? <OutsiderTag /> : m.company && (
          <span className={clsx("inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium", companyBadgeClass(byKey[m.company]?.color))}>{byKey[m.company]?.name ?? m.company}</span>
        )}
      </div>
      {manage && (
        <div className="hidden min-w-[10rem] flex-[1.2_1_0%] truncate text-sm text-foreground/80 lg:block">{m.email ?? <span className="text-muted">No email</span>}</div>
      )}
      {manage && (
        <div className="w-36 shrink-0">
          {m.login === "PENDING" ? <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700">Invite not accepted</span>
            : m.login === "NONE" ? <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium text-foreground/70">No login</span>
            : <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">Signed in</span>}
        </div>
      )}
      {manage && (
        <div className="shrink-0">
          <Menu width={190} trigger={({ toggle }) => (
            <button onClick={toggle} disabled={busy === m.bdoId} title="More actions" aria-label="More actions" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-50"><MoreHorizontal size={16} /></button>
          )}>
            {(close) => (
              <>
                {m.role !== "LEAD" && !m.external && (
                  <MenuItem icon={<Crown size={14} />} onClick={() => { close(); act(m.bdoId, () => api.put(`/projects/${project.id}/members/${m.bdoId}`, { role: "LEAD" }), `${m.name} now leads the project`); }}>Make lead</MenuItem>
                )}
                {m.email && <MenuItem icon={<Mail size={14} />} onClick={() => { close(); window.location.href = `mailto:${m.email}`; }}>Email</MenuItem>}
                <MenuItem icon={<UserMinus size={14} />} danger onClick={() => { close(); remove(m); }}>Remove from project</MenuItem>
              </>
            )}
          </Menu>
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">Only the people here can see the project. Staff who aren&apos;t on it, like the rest of the sales team, don&apos;t.</p>
        {manage && (
          <div className="flex flex-wrap gap-2">
            <OutlineButton icon={UserPlus} onClick={() => setAdding(true)}>Add someone</OutlineButton>
            <PrimaryButton icon={MailPlus} onClick={() => setInviting(true)}>Invite an outsider</PrimaryButton>
          </div>
        )}
      </div>

      {members.length === 0 ? (
        <Empty
          title="No one on this project yet"
          body={manage ? "Add staff who'll work on it, and invite anyone from outside the company." : "Nobody has been added yet."}
          action={manage ? <button onClick={() => setAdding(true)} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">Add someone</button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {staff.length > 0 && (
            <GroupSection group={{ title: "Team", Icon: Users, icon: "bg-sky-500/10 text-sky-600" }} count={staff.length} noun={["person", "people"]} preview={50}>
              {() => staff.map(row)}
            </GroupSection>
          )}
          {outsiders.length > 0 && (
            <GroupSection group={{ title: "Outside collaborators", Icon: UserRoundCog, icon: "bg-violet-500/10 text-violet-600", text: "text-violet-700" }} count={outsiders.length} noun={["person", "people"]} preview={50}>
              {() => outsiders.map(row)}
            </GroupSection>
          )}
        </div>
      )}

      {manage && !project.lead && members.length > 0 && (
        <p className="text-xs text-muted">Tip: make someone the lead. They can then add tasks for anyone on the project and log its KPI results.</p>
      )}

      {adding && <AddPersonSheet project={project} onClose={() => setAdding(false)} onAdded={(p) => { setAdding(false); onChanged(p); }} />}
      {inviting && <InviteSheet project={project} onClose={() => setInviting(false)} onInvited={(p) => { setInviting(false); onChanged(p); }} />}
    </div>
  );
}

function AddPersonSheet({ project, onClose, onAdded }: { project: Project; onClose: () => void; onAdded: (p: Project) => void }) {
  const { byKey } = useCompanies();
  const { data: people = [], isLoading } = useQuery<Person[]>({ queryKey: ["project-people", project.id], queryFn: () => fetcher(`/projects/${project.id}/people`) });
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string>("");
  const [lead, setLead] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const choice = people.find((p) => p.id === picked);
  const shown = people.filter((p) => !q.trim() || [p.name, p.title].some((v) => (v ?? "").toLowerCase().includes(q.trim().toLowerCase())));
  const staff = shown.filter((p) => !p.external), outsiders = shown.filter((p) => p.external);

  const save = async () => {
    if (!picked) return;
    setSaving(true); setError("");
    try {
      const r = await api.post(`/projects/${project.id}/members`, { bdoId: picked, role: lead ? "LEAD" : "MEMBER" });
      toast.success(`${choice?.name ?? "They"} added`, { description: project.name });
      onAdded(r.data as Project);
    } catch (err) {
      setError(apiError(err, "We couldn't add them. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const row = (p: Person) => (
    <label key={p.id} className={clsx("flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-primary/[0.03]", picked === p.id && "bg-accent/5")}>
      <input type="radio" name="person" checked={picked === p.id} onChange={() => { setPicked(p.id); if (p.external) setLead(false); }} className="accent-[var(--color-accent)]" />
      <Avatar name={p.name} external={p.external} size="h-7 w-7 text-[10px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{p.name}</span>
        <span className="block truncate text-xs text-muted">{[p.title, p.external ? "Outside collaborator" : byKey[p.company]?.name ?? p.company].filter(Boolean).join(" · ")}</span>
      </span>
    </label>
  );

  return (
    <KpiSheet
      title="Add someone to the project"
      subtitle="Staff from the project's company, or an outside collaborator already working with you."
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button onClick={save} disabled={!picked || saving} className={primaryBtn}>{saving ? "Adding…" : "Add to project"}</button>
        </div>
      }
    >
      <div className="space-y-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or role" aria-label="Search people" className={inputClass} />
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
          {isLoading ? (
            <p className="px-3 py-4 text-sm text-muted">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">{people.length ? "No one matches." : "Everyone you can add is already on the project."}</p>
          ) : (
            <>
              {staff.length > 0 && <p className="bg-subtle px-3 py-1.5 text-xs font-semibold text-muted">Staff</p>}
              <div className="divide-y divide-border/60">{staff.map(row)}</div>
              {outsiders.length > 0 && <p className="bg-subtle px-3 py-1.5 text-xs font-semibold text-muted">Outside collaborators</p>}
              <div className="divide-y divide-border/60">{outsiders.map(row)}</div>
            </>
          )}
        </div>
        {choice && !choice.external && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={lead} onChange={(e) => setLead(e.target.checked)} className="accent-[var(--color-accent)]" />
            Make them the lead {project.lead ? `(instead of ${project.lead.name ?? "the current lead"})` : ""}
          </label>
        )}
        <FormError message={error} />
      </div>
    </KpiSheet>
  );
}

function InviteSheet({ project, onClose, onInvited }: { project: Project; onClose: () => void; onInvited: (p: Project) => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", title: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ project: Project; email: string; tempPassword: string; emailSent: boolean } | null>(null);
  const set = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); if (error) setError(""); };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError("Enter their name and email."); return; }
    setSaving(true); setError("");
    try {
      const r = await api.post(`/projects/${project.id}/invite`, form);
      const data = r.data as { project: Project; email: string; tempPassword: string; emailSent: boolean };
      if (data.emailSent) { toast.success(`Invite sent to ${data.email}`, { description: `${form.name.trim()} can now sign in and see ${project.name}.` }); onInvited(data.project); }
      else setResult(data);
    } catch (err) {
      setError(apiError(err, "We couldn't send the invite. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <KpiSheet title="They're added, but the email didn't go out" onClose={() => onInvited(result.project)} footer={<div className="flex justify-end w-full"><button onClick={() => onInvited(result.project)} className={primaryBtn}>Done</button></div>}>
        <div className="space-y-3 text-sm">
          <p className="text-muted">Send them these details another way. They&apos;ll be asked to choose a new password when they first sign in.</p>
          <div className="rounded-xl bg-background px-3.5 py-3 space-y-1">
            <p><span className="text-muted">Email:</span> <span className="font-medium text-foreground">{result.email}</span></p>
            <p><span className="text-muted">Temporary password:</span> <span className="font-mono font-medium text-foreground">{result.tempPassword}</span></p>
          </div>
        </div>
      </KpiSheet>
    );
  }

  return (
    <KpiSheet
      title="Invite an outside collaborator"
      subtitle={`Someone who isn't staff, like a contract developer. They'll only see the projects they're on, starting with ${project.name}.`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button onClick={onClose} className={secondaryBtn}>Cancel</button>
          <button onClick={save} disabled={saving} className={primaryBtn}>{saving ? "Sending…" : "Send invite"}</button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Name"><input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} /></Field>
        <Field label="Email" hint="(their login)"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Phone" hint="(optional, for SMS reminders)"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="024 123 4567" className={inputClass} /></Field>
          <Field label="What they do" hint="(optional)"><input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. App developer" className={inputClass} /></Field>
        </div>
        <p className="text-xs text-muted">They won&apos;t see leads, clients, deals, money, company KPIs or the team. Only this project&apos;s tasks, its KPIs and the names of the people on it.</p>
        <FormError message={error} />
      </div>
    </KpiSheet>
  );
}
