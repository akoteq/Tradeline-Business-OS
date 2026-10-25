"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { DataTable, type Column } from "@/components/DataTable";
import { useAuth } from "@/components/AuthProvider";
import { accessLevel } from "@/lib/auth";
import { X, Contact as ContactIcon, Lock } from "lucide-react";

// The group's shared contact book. Everyone sees who we know; phone and email show only to the
// relationship owner and leaders (others ask the owner for an introduction).

type ContactRow = {
  id: string; name: string; organisation: string; role: string; sector: string; interests: string[]; phone?: string; email?: string;
  contactDetailsHidden?: boolean; howMet: string; howMetDetails: string; introducedBy: string; ownerBdoId: string | null; ownerName: string | null;
  company: string | null; stage: string; nextFollowUpDate: string | null; smeIds: string[]; consentNote: string; privateNotes?: string;
  lastInteractionAt: string | null; canEdit: boolean;
};
type Full = ContactRow & {
  clients: { id: string; name: string }[];
  interactions: { id: string; date: string; type: string; summary: string; attendees: string; loggedByName: string | null }[];
  commitments: { id: string; description: string; owedBy: string; ownerName: string | null; dueDate: string | null; status: string }[];
};

const STAGES = ["NEW", "DEVELOPING", "ACTIVE", "STRONG", "DORMANT"];
const MET = ["MEETING", "REFERRAL", "EVENT", "PARTNERSHIP", "OTHER"];
const t = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
const showDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : "—");
const errText = (e: unknown, f: string) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? f;
const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
const STAGE_STYLE: Record<string, string> = { NEW: "bg-gray-100 text-gray-600", DEVELOPING: "bg-blue-100 text-blue-700", ACTIVE: "bg-green-100 text-green-700", STRONG: "bg-emerald-100 text-emerald-800", DORMANT: "bg-slate-100 text-slate-500" };

export default function ContactsPage() {
  const qc = useQueryClient();
  const [stage, setStage] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContactRow | "new" | null>(null);
  const { data: rows = [], isLoading } = useQuery<ContactRow[]>({ queryKey: ["contacts"], queryFn: () => fetcher("/contacts") });
  const refresh = () => qc.invalidateQueries({ queryKey: ["contacts"] });
  const filtered = rows.filter((r) => (!stage || r.stage === stage) && (!dueOnly || (r.nextFollowUpDate && new Date(r.nextFollowUpDate) <= new Date())));

  const columns: Column<ContactRow>[] = [
    { key: "name", label: "Name", sortable: true, render: (r) => <button onClick={() => setOpenId(r.id)} className="text-left font-semibold text-accent hover:underline">{r.name}</button>, exportValue: (r) => r.name },
    { key: "organisation", label: "Organisation", sortable: true, render: (r) => [r.role, r.organisation].filter(Boolean).join(", ") || "—" },
    { key: "sector", label: "Sector", render: (r) => r.sector || "—" },
    { key: "ownerName", label: "Relationship owner", render: (r) => r.ownerName ?? "—" },
    { key: "stage", label: "Stage", sortable: true, render: (r) => <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_STYLE[r.stage]}`}>{t(r.stage)}</span> },
    { key: "nextFollowUpDate", label: "Next follow-up", sortable: true, render: (r) => r.nextFollowUpDate ? <span className={new Date(r.nextFollowUpDate) < new Date() ? "text-red-600 font-medium" : ""}>{showDate(r.nextFollowUpDate)}</span> : "—", exportValue: (r) => r.nextFollowUpDate?.slice(0, 10) ?? "" },
    { key: "lastInteractionAt", label: "Last contact", sortable: true, render: (r) => showDate(r.lastInteractionAt) },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><ContactIcon size={22} /> Strategic contacts</h1>
        <p className="text-sm text-gray-500">Shared across the group. Phone numbers and emails are visible to the relationship owner and leaders; ask the owner for an introduction.</p>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        title={`${filtered.length} contacts`}
        onAdd={() => setEditing("new")}
        onEdit={(r) => setEditing(r)}
        canEditRow={(r) => r.canEdit}
        onDelete={(r) => confirmAction({ title: `Delete ${r.name}?`, body: "Their interactions and commitments go with them.", confirmLabel: "Delete contact" }).then((ok) => { if (ok) api.delete(`/contacts/${r.id}`).then(() => { toast.success("Contact deleted", { description: r.name }); refresh(); }, (e) => toast.failed("Couldn't delete the contact", e)); })}
        filterBar={
          <div className="flex gap-3 flex-wrap items-center">
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"><option value="">All stages</option>{STAGES.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select>
            <label className="flex items-center gap-1.5 text-sm text-gray-600"><input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} /> Follow-up due</label>
          </div>
        }
      />
      {openId && <ContactDrawer id={openId} onClose={() => setOpenId(null)} onEdit={(c) => { setOpenId(null); setEditing(c); }} />}
      {editing && <ContactModal contact={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} onOpen={(id) => { setEditing(null); setOpenId(id); }} />}
    </div>
  );
}

function ContactDrawer({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (c: ContactRow) => void }) {
  const qc = useQueryClient();
  const { data: c } = useQuery<Full>({ queryKey: ["contacts", id], queryFn: () => fetcher(`/contacts/${id}`) });
  const [note, setNote] = useState({ summary: "", type: "MEETING", date: new Date().toISOString().slice(0, 10) });
  const [commit, setCommit] = useState({ description: "", owedBy: "US", dueDate: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["contacts"] });
  const add = async (path: string, body: unknown, reset: () => void) => {
    try {
      await api.post(`/contacts/${id}/${path}`, body);
      toast.success(path === "commitments" ? "Commitment added" : "Interaction logged");
      reset(); refresh();
    } catch (e) { toast.failed("Couldn't save that", e); }
  };
  const setStatus = async (cid: string, status: string) => {
    try { await api.put(`/contacts/commitments/${cid}`, { status }); toast.success("Commitment updated"); refresh(); }
    catch (e) { toast.failed("Couldn't update the commitment", e); }
  };
  if (!c) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div><h2 className="font-semibold text-gray-900">{c.name}</h2><p className="text-xs text-gray-500">{[c.role, c.organisation].filter(Boolean).join(", ")}</p></div>
          <div className="flex items-center gap-2">
            {c.canEdit && <button onClick={() => onEdit(c)} className="px-3 py-1.5 text-xs font-medium bg-accent text-accent-foreground rounded-lg">Edit</button>}
            <button onClick={onClose} className="text-gray-400"><X size={18} /></button>
          </div>
        </div>
        <div className="p-5 space-y-5 text-sm">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            {c.contactDetailsHidden ? (
              <div className="col-span-2 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2"><Lock size={12} /> Phone and email are visible to {c.ownerName ?? "the relationship owner"} and leaders. Ask them for an introduction.</div>
            ) : <><Item l="Phone" v={c.phone} /><Item l="Email" v={c.email} /></>}
            <Item l="Sector" v={c.sector} /><Item l="Interests" v={c.interests.join(", ")} />
            <Item l="Relationship owner" v={c.ownerName} /><Item l="Stage" v={t(c.stage)} />
            <Item l="How we met" v={`${t(c.howMet)}${c.howMetDetails ? ` — ${c.howMetDetails}` : ""}`} /><Item l="Introduced by" v={c.introducedBy} />
            <Item l="Next follow-up" v={showDate(c.nextFollowUpDate)} /><Item l="Linked clients" v={c.clients.map((x) => x.name).join(", ")} />
            {c.consentNote && <div className="col-span-2"><Item l="Consent (Data Protection Act)" v={c.consentNote} /></div>}
            {c.privateNotes !== undefined && <div className="col-span-2"><Item l="Private notes" v={c.privateNotes} /></div>}
          </dl>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">Commitments</p>
            {c.commitments.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 border-l-2 border-accent/30 pl-3 py-1">
                <div><p className={m.status === "DONE" ? "line-through text-gray-400" : "text-gray-800"}>{m.description}</p>
                  <p className="text-xs text-gray-400">{m.owedBy === "US" ? `We owe it${m.ownerName ? ` (${m.ownerName})` : ""}` : "They owe it"}{m.dueDate ? ` · by ${showDate(m.dueDate)}` : ""}{m.status === "OPEN" && m.dueDate && new Date(m.dueDate) < new Date() ? " · overdue" : ""}</p></div>
                <select value={m.status} onChange={(e) => setStatus(m.id, e.target.value)} className="text-xs border border-gray-200 rounded px-1 py-1">{["OPEN", "DONE", "CANCELLED"].map((s) => <option key={s} value={s}>{t(s)}</option>)}</select>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 mt-2">
              <input value={commit.description} onChange={(e) => setCommit({ ...commit, description: e.target.value })} placeholder="Something agreed…" className={`${inputCls} flex-1 min-w-40`} />
              <select value={commit.owedBy} onChange={(e) => setCommit({ ...commit, owedBy: e.target.value })} className="text-sm border border-gray-200 rounded-lg px-2"><option value="US">We owe</option><option value="THEM">They owe</option></select>
              <input type="date" value={commit.dueDate} onChange={(e) => setCommit({ ...commit, dueDate: e.target.value })} className="text-sm border border-gray-200 rounded-lg px-2" />
              <button disabled={!commit.description.trim()} onClick={() => add("commitments", { ...commit, dueDate: commit.dueDate || null }, () => setCommit({ description: "", owedBy: "US", dueDate: "" }))} className="px-3 py-1.5 text-sm bg-accent text-accent-foreground rounded-lg disabled:opacity-50">Add</button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">Conversations</p>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 mb-3">
              <textarea value={note.summary} onChange={(e) => setNote({ ...note, summary: e.target.value })} rows={2} placeholder="What was discussed?" className={`${inputCls} bg-white resize-none`} />
              <div className="flex gap-2">
                <select value={note.type} onChange={(e) => setNote({ ...note, type: e.target.value })} className="text-sm border border-gray-200 rounded-lg px-2 bg-white">{["MEETING", "CALL", "EMAIL", "EVENT", "OTHER"].map((s) => <option key={s} value={s}>{t(s)}</option>)}</select>
                <input type="date" value={note.date} onChange={(e) => setNote({ ...note, date: e.target.value })} className="text-sm border border-gray-200 rounded-lg px-2 bg-white" />
                <button disabled={!note.summary.trim()} onClick={() => add("interactions", note, () => setNote({ ...note, summary: "" }))} className="ml-auto px-3 py-1.5 text-sm bg-accent text-accent-foreground rounded-lg disabled:opacity-50">Log</button>
              </div>
            </div>
            {c.interactions.map((i) => (
              <div key={i.id} className="border-l-2 border-gray-200 pl-3 py-1 mb-2">
                <p className="text-xs text-gray-400">{t(i.type)} · {showDate(i.date)}{i.loggedByName ? ` · ${i.loggedByName}` : ""}</p>
                <p className="text-gray-700 whitespace-pre-wrap">{i.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Item({ l, v }: { l: string; v?: string | null }) {
  return <div><dt className="text-xs text-gray-400">{l}</dt><dd className="text-gray-800 mt-0.5 whitespace-pre-wrap">{v || "—"}</dd></div>;
}

function ContactModal({ contact, onClose, onSaved, onOpen }: { contact: ContactRow | null; onClose: () => void; onSaved: () => void; onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const { data: bdos = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["bdos"], queryFn: () => fetcher("/bdo") });
  const { data: clientRes } = useQuery<{ data: { id: string; companyName: string }[] }>({ queryKey: ["sme-options"], queryFn: () => fetcher("/sme") });
  const clients = clientRes?.data ?? [];
  const [form, setForm] = useState({
    name: contact?.name ?? "", organisation: contact?.organisation ?? "", role: contact?.role ?? "", sector: contact?.sector ?? "",
    interests: (contact?.interests ?? []).join(", "), phone: contact?.phone ?? "", email: contact?.email ?? "", howMet: contact?.howMet ?? "MEETING",
    howMetDetails: contact?.howMetDetails ?? "", introducedBy: contact?.introducedBy ?? "", ownerBdoId: contact?.ownerBdoId ?? user?.bdoId ?? "",
    stage: contact?.stage ?? "NEW", nextFollowUpDate: contact?.nextFollowUpDate?.slice(0, 10) ?? "", smeIds: contact?.smeIds ?? [] as string[],
    consentNote: contact?.consentNote ?? "", privateNotes: contact?.privateNotes ?? "",
  });
  const [dups, setDups] = useState<{ id: string; name: string; organisation: string }[] | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const staff = !!user && accessLevel(user.role) === "STAFF";
  const canSeePrivate = !contact || contact.privateNotes !== undefined;

  const save = async () => {
    setSaving(true); setError("");
    if (!contact && !dups) {
      try {
        const found = await fetcher(`/contacts/similar?name=${encodeURIComponent(form.name)}&organisation=${encodeURIComponent(form.organisation)}`) as { id: string; name: string; organisation: string }[];
        if (found.length) { setDups(found); setSaving(false); return; }
      } catch { /* carry on */ }
    }
    const body: Record<string, unknown> = { ...form, interests: form.interests.split(",").map((x) => x.trim()).filter(Boolean), nextFollowUpDate: form.nextFollowUpDate || null, ownerBdoId: form.ownerBdoId || null };
    if (contact?.contactDetailsHidden) { delete body.phone; delete body.email; }
    if (!canSeePrivate) delete body.privateNotes;
    try {
      contact ? await api.put(`/contacts/${contact.id}`, body) : await api.post("/contacts", body);
      toast.success(contact ? "Contact updated" : "Contact added", { description: form.name.trim() });
      onSaved();
    }
    catch (e) { setError(errText(e, "Failed to save.")); } finally { setSaving(false); }
  };

  const F = (label: string, k: keyof typeof form, type = "text") => (
    <div><label className="text-xs font-medium text-gray-600 block mb-1">{label}</label><input type={type} value={form[k] as string} onChange={(e) => set(k, e.target.value)} className={inputCls} /></div>
  );
  const matches = clientSearch.trim() ? clients.filter((c) => c.companyName.toLowerCase().includes(clientSearch.toLowerCase()) && !form.smeIds.includes(c.id)).slice(0, 6) : [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between"><h2 className="font-semibold">{contact ? `Edit ${contact.name}` : "New contact"}</h2><button onClick={onClose} className="text-gray-400"><X size={18} /></button></div>
        <div className="p-5 space-y-3 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {error && <div className="bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
          {dups && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-amber-900">Similar contacts already exist:</p>
              {dups.map((d) => <p key={d.id} className="flex justify-between mt-1"><span>{d.name}{d.organisation ? ` · ${d.organisation}` : ""}</span><button onClick={() => onOpen(d.id)} className="text-xs font-semibold text-accent">Open</button></p>)}
              <p className="text-xs text-amber-800 mt-1">If this is a different person, save anyway.</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {F("Name *", "name")}{F("Organisation", "organisation")}{F("Role", "role")}{F("Sector", "sector")}
            <div className="sm:col-span-2">{F("Interests (comma-separated)", "interests")}</div>
            {!contact?.contactDetailsHidden && <>{F("Phone", "phone")}{F("Email", "email", "email")}</>}
            <div><label className="text-xs font-medium text-gray-600 block mb-1">How we met</label><select value={form.howMet} onChange={(e) => set("howMet", e.target.value)} className={inputCls}>{MET.map((m) => <option key={m} value={m}>{t(m)}</option>)}</select></div>
            {F("Details (event, who referred…)", "howMetDetails")}
            {F("Introduced by", "introducedBy")}
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Relationship owner</label>
              <select value={form.ownerBdoId} disabled={staff} onChange={(e) => set("ownerBdoId", e.target.value)} className={inputCls}><option value="">—</option>{bdos.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Stage</label><select value={form.stage} onChange={(e) => set("stage", e.target.value)} className={inputCls}>{STAGES.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></div>
            {F("Next follow-up", "nextFollowUpDate", "date")}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Linked clients</label>
              <div className="flex flex-wrap gap-1 mb-1">{form.smeIds.map((id) => <span key={id} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded flex items-center gap-1">{clients.find((c) => c.id === id)?.companyName ?? "Client"}<button onClick={() => set("smeIds", form.smeIds.filter((x) => x !== id))}><X size={10} /></button></span>)}</div>
              <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Search clients to link…" className={inputCls} />
              {matches.map((c) => <button key={c.id} onClick={() => { set("smeIds", [...form.smeIds, c.id]); setClientSearch(""); }} className="block w-full text-left text-sm px-2 py-1 hover:bg-gray-50">{c.companyName}</button>)}
            </div>
            <div className="sm:col-span-2">{F("Consent note (Data Protection Act, 2012)", "consentNote")}</div>
            {canSeePrivate && <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600 block mb-1">Private notes (you and the Group Owner only)</label><textarea value={form.privateNotes} onChange={(e) => set("privateNotes", e.target.value)} rows={2} className={`${inputCls} resize-none`} /></div>}
          </div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving || !form.name.trim()} className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg disabled:opacity-50">{saving ? "Saving…" : dups ? "Save anyway" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
