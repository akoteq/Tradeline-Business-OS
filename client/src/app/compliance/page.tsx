"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { toast } from "@/components/Toast";
import { confirmAction } from "@/components/Confirm";
import { DataTable, type Column } from "@/components/DataTable";
import { ClientSelect, type ClientOption } from "@/components/ClientSelect";
import { useComplianceCompanies, STATE_LABEL, STATE_STYLE } from "@/components/ClientModules";
import { useAuth } from "@/components/AuthProvider";
import { accessLevel } from "@/lib/auth";
import { useCompanies, companyHref } from "@/lib/companies";
import { X, ShieldCheck, Phone, Briefcase, History } from "lucide-react";
import Link from "next/link";

// Regulatory compliance (GRA, FDA, GSA, EPA, ORC...) for companies that have the module on.
// Verified always starts as No; whoever can edit a record may verify it, and every change is logged.

type Rec = {
  id: string; smeId: string; clientName: string; company: string; requirementTypeId: string; regulator: string; requirementName: string; subject: string;
  applicability: string; notApplicableReason?: string; status: string; referenceNumber?: string; issueDate?: string | null; expiryDate?: string | null;
  nextRenewalDate?: string | null; evidenceDocIds: string[]; verified: boolean; verifiedByName?: string | null; verifiedAt?: string | null;
  responsibleBdoId?: string | null; responsibleName?: string | null; nextAction?: string; nextActionDate?: string | null;
  opportunityDealId?: string | null; state: string; renewalDue: boolean; dueDate: string | null; daysToDue: number | null; lastOutreachAt?: string | null;
};
type ReqType = { id: string; code: string; regulator: string; name: string; perSubject: boolean; renewal: { kind: string; intervalMonths?: number | null } };
type Bdo = { id: string; name: string; company: string };

const FILTERS: [string, string][] = [["", "All"], ["VERIFIED", "Verified"], ["AWAITING_VERIFICATION", "Awaiting verification"], ["NOT_REGISTERED", "Not registered"], ["UNASSESSED", "Not assessed"], ["RENEWAL", "Renewal due"], ["EXPIRED", "Expired"], ["NOT_APPLICABLE", "Not applicable"]];
const d10 = (s?: string | null) => (s ? s.slice(0, 10) : "");
const showDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : "—");
const errText = (e: unknown, f: string) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? f;

export default function CompliancePage() {
  const companies = useComplianceCompanies();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [state, setState] = useState("");
  const [regulator, setRegulator] = useState("");
  const [company, setCompany] = useState("");
  const [editing, setEditing] = useState<Rec | "new" | null>(null);
  const [outreach, setOutreach] = useState<Rec | null>(null);
  const [opportunity, setOpportunity] = useState<Rec | null>(null);

  useEffect(() => { const s = new URLSearchParams(window.location.search).get("state"); if (s) setState(s); }, []);

  const { data: rows = [], isLoading } = useQuery<Rec[]>({ queryKey: ["compliance", "all"], queryFn: () => fetcher("/compliance"), enabled: companies.length > 0 });
  const { data: types = [] } = useQuery<ReqType[]>({ queryKey: ["compliance-types"], queryFn: () => fetcher("/compliance/types") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["compliance"] }); };

  const filtered = rows.filter((r) =>
    (!state || (state === "RENEWAL" ? r.renewalDue : r.state === state)) && (!regulator || r.regulator === regulator) && (!company || r.company === company));
  const count = (s: string) => rows.filter((r) => (s === "RENEWAL" ? r.renewalDue : !s || r.state === s)).length;
  const regulators = [...new Set(types.map((t) => t.regulator))].sort();

  const verify = async (r: Rec, verified: boolean) => {
    try {
      await api.post(`/compliance/${r.id}/verify`, { verified });
      toast.success(verified ? "Marked as verified" : "Verification removed", { description: `${r.requirementName} · ${r.clientName}` });
      refresh();
    } catch (e) { toast.failed("Couldn't change verification", e); }
  };

  if (!user) return null;
  if (!companies.length) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
        <p className="mt-2 text-sm text-gray-500">Compliance tracking is switched off for your company. The Group Owner can switch it on under Add a Company.</p>
      </div>
    );
  }

  const columns: Column<Rec>[] = [
    { key: "clientName", label: "Client", sortable: true, render: (r) => <button onClick={() => setEditing(r)} className="text-left font-semibold text-accent hover:underline">{r.clientName}</button>, exportValue: (r) => r.clientName },
    { key: "requirementName", label: "Requirement", render: (r) => <span><span className="font-medium text-gray-700">{r.regulator}</span> · {r.requirementName}{r.subject ? <span className="text-gray-500"> ({r.subject})</span> : null}</span>, exportValue: (r) => `${r.regulator} ${r.requirementName} ${r.subject}` },
    { key: "state", label: "State", sortable: true, render: (r) => <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATE_STYLE[r.state]}`}>{STATE_LABEL[r.state]}</span>, exportValue: (r) => STATE_LABEL[r.state] },
    { key: "referenceNumber", label: "Reference", render: (r) => r.referenceNumber || "—" },
    {
      key: "daysToDue", label: "Expires / renews", sortable: true,
      render: (r) => r.dueDate ? <span className={r.daysToDue != null && r.daysToDue < 0 ? "text-red-600 font-medium" : r.renewalDue ? "text-amber-700 font-medium" : "text-gray-600"}>{showDate(r.dueDate)}{r.daysToDue != null && r.daysToDue <= 90 ? ` (${r.daysToDue < 0 ? `${-r.daysToDue}d ago` : `${r.daysToDue}d`})` : ""}</span> : "—",
      exportValue: (r) => d10(r.dueDate),
    },
    { key: "responsibleName", label: "Responsible", render: (r) => r.responsibleName ?? "—" },
    { key: "nextAction", label: "Next action", render: (r) => r.nextAction ? `${r.nextAction}${r.nextActionDate ? ` · ${showDate(r.nextActionDate)}` : ""}` : "—" },
    {
      key: "actions", label: "",
      render: (r) => (
        <div className="flex items-center gap-2 text-xs whitespace-nowrap">
          {r.state === "AWAITING_VERIFICATION" && <button onClick={() => verify(r, true)} className="font-semibold text-green-700 hover:underline">Verify</button>}
          {r.state === "VERIFIED" && <button onClick={() => confirmAction({ title: "Mark as not verified?", body: `${r.requirementName} for ${r.clientName} goes back to awaiting verification.`, confirmLabel: "Unverify", danger: false }).then((ok) => { if (ok) verify(r, false); })} className="text-gray-500 hover:underline">Unverify</button>}
          <button onClick={() => setOutreach(r)} className="text-accent hover:underline flex items-center gap-1"><Phone size={11} /> Log outreach</button>
          {!r.opportunityDealId && companies.find((c) => c.key === r.company)?.modules?.complianceOpportunities && r.state !== "NOT_APPLICABLE" &&
            <button onClick={() => setOpportunity(r)} className="text-accent hover:underline flex items-center gap-1"><Briefcase size={11} /> Opportunity</button>}
          {r.opportunityDealId && <span className="text-gray-400">In pipeline</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><ShieldCheck size={22} /> Compliance</h1>
        <p className="text-sm text-gray-500">Registrations with GRA, FDA, GSA, EPA, ORC and other regulators for {companies.map((c) => c.name).join(", ")} clients. A record is only &quot;Verified&quot; once someone has checked it.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setState(k)} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${state === k ? "bg-accent text-accent-foreground border-accent" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            {l} <span className={state === k ? "text-accent-foreground/80" : "text-gray-400"}>{count(k)}</span>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        title={`${filtered.length} records`}
        onAdd={() => setEditing("new")}
        onEdit={(r) => setEditing(r)}
        onDelete={accessLevel(user.role) !== "STAFF" ? (r) => confirmAction({ title: `Delete ${r.requirementName} for ${r.clientName}?`, body: "This can't be undone.", confirmLabel: "Delete" }).then((ok) => { if (ok) api.delete(`/compliance/${r.id}`).then(() => { toast.success("Record deleted", { description: `${r.requirementName} · ${r.clientName}` }); refresh(); }, (e) => toast.failed("Couldn't delete the record", e)); }) : undefined}
        filterBar={
          <div className="flex gap-2 flex-wrap">
            <select value={regulator} onChange={(e) => setRegulator(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              <option value="">All regulators</option>{regulators.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {companies.length > 1 && (
              <select value={company} onChange={(e) => setCompany(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                <option value="">All companies</option>{companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            )}
          </div>
        }
      />

      {editing && <RecordModal record={editing === "new" ? null : editing} types={types} companies={companies.map((c) => ({ key: c.key, name: c.name }))} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {outreach && <OutreachModal record={outreach} onClose={() => setOutreach(null)} onSaved={() => { setOutreach(null); refresh(); }} />}
      {opportunity && <OpportunityModal record={opportunity} onClose={() => setOpportunity(null)} onSaved={() => { setOpportunity(null); refresh(); }} />}
    </div>
  );
}

function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[92vh] flex flex-col`}>
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
        <div className="px-5 py-3 border-t flex justify-end gap-2 shrink-0">{footer}</div>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
function L({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return <div className={span ? "sm:col-span-2" : ""}><label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>{children}</div>;
}

function RecordModal({ record, types, companies, onClose, onSaved }: { record: Rec | null; types: ReqType[]; companies: { key: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const owner = !!user && accessLevel(user.role) === "GROUP_OWNER";
  const { data: clients = [] } = useQuery<{ data: ClientOption[] }, Error, ClientOption[]>({ queryKey: ["sme-options"], queryFn: () => fetcher("/sme"), select: (r) => r.data, enabled: !record });
  const [form, setForm] = useState({
    company: record?.company ?? (owner ? companies[0]?.key ?? "" : user?.bdoCompany ?? ""),
    smeId: record?.smeId ?? "", requirementTypeId: record?.requirementTypeId ?? "", subject: record?.subject ?? "",
    applicability: record?.applicability ?? "APPLICABLE", notApplicableReason: record?.notApplicableReason ?? "",
    status: record?.status ?? "NOT_REGISTERED", referenceNumber: record?.referenceNumber ?? "",
    issueDate: d10(record?.issueDate), expiryDate: d10(record?.expiryDate), responsibleBdoId: record?.responsibleBdoId ?? "",
    nextAction: record?.nextAction ?? "", nextActionDate: d10(record?.nextActionDate), evidenceDocIds: record?.evidenceDocIds ?? [],
  });
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const { data: bdos = [] } = useQuery<Bdo[]>({ queryKey: ["bdos", form.company], queryFn: () => fetcher(`/bdo${owner && form.company ? `?company=${form.company}` : ""}`) });
  const { data: docs = [] } = useQuery<{ id: string; fileName: string; fileUrl: string }[]>({ queryKey: ["client-documents", form.smeId], queryFn: () => fetcher(`/client-documents?smeId=${form.smeId}`), enabled: !!form.smeId });
  const { data: suggestions = [] } = useQuery<{ id: string; regulator: string; name: string; reason: string }[]>({
    queryKey: ["compliance-suggest", form.smeId, form.company], queryFn: () => fetcher(`/compliance/suggest?smeId=${form.smeId}${owner ? `&company=${form.company}` : ""}`), enabled: !record && !!form.smeId && !!form.company,
  });
  const { data: audit = [] } = useQuery<{ id: string; action: string; actorName: string | null; createdAt: string; note?: string; changes: { field: string; from: string; to: string }[] }[]>({
    queryKey: ["compliance-audit", record?.id], queryFn: () => fetcher(`/compliance/${record!.id}/audit`), enabled: !!record,
  });
  const type = types.find((t) => t.id === form.requirementTypeId);
  const byRegulator = useMemo(() => [...new Set(types.map((t) => t.regulator))].sort().map((r) => [r, types.filter((t) => t.regulator === r)] as const), [types]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form.smeId) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("smeId", form.smeId); fd.append("category", "COMPLIANCE_EVIDENCE");
    if (user?.email) fd.append("uploadedBy", user.email);
    try {
      const { data } = await api.post<{ id: string }>("/client-documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      set("evidenceDocIds", [...form.evidenceDocIds, data.id]);
      qc.invalidateQueries({ queryKey: ["client-documents", form.smeId] });
    } catch (err) { setError(errText(err, "Upload failed.")); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const save = async () => {
    setSaving(true); setError("");
    const body: Record<string, unknown> = {
      ...form, issueDate: form.issueDate || null, expiryDate: form.expiryDate || null, nextActionDate: form.nextActionDate || null,
      responsibleBdoId: form.responsibleBdoId || null, notApplicableReason: form.notApplicableReason || undefined,
    };
    try {
      if (record) { delete body.company; delete body.smeId; delete body.requirementTypeId; await api.put(`/compliance/${record.id}`, body); }
      else await api.post("/compliance", body);
      toast.success(record ? "Record updated" : "Record added");
      onSaved();
    } catch (e) { setError(errText(e, "Failed to save.")); }
    finally { setSaving(false); }
  };

  return (
    <Modal wide title={record ? `${record.regulator} ${record.requirementName} — ${record.clientName}` : "New compliance record"} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
        <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      </>}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
      {record && (
        <div className={`rounded-lg px-3 py-2 text-xs ${STATE_STYLE[record.state]}`}>
          {STATE_LABEL[record.state]}{record.verified && record.verifiedByName ? ` by ${record.verifiedByName} on ${showDate(record.verifiedAt)}` : ""}. Changing the reference, dates or status of a verified record sends it back to &quot;awaiting verification&quot;.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!record && owner && companies.length > 1 && (
          <L label="Tracked by" span><select value={form.company} onChange={(e) => set("company", e.target.value)} className={inputCls}>{companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></L>
        )}
        {!record && <div className="sm:col-span-2"><ClientSelect label="Client *" value={form.smeId} options={clients} onChange={(id) => set("smeId", id)} /></div>}
        {!record && (
          <L label="Requirement *" span>
            <select value={form.requirementTypeId} onChange={(e) => set("requirementTypeId", e.target.value)} className={inputCls}>
              <option value="">— Choose —</option>
              {byRegulator.map(([reg, ts]) => <optgroup key={reg} label={reg}>{ts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}
            </select>
            {suggestions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="text-[11px] text-gray-400">Suggested for this client:</span>
                {suggestions.map((s) => <button key={s.id} type="button" title={s.reason} onClick={() => set("requirementTypeId", s.id)} className="text-[11px] px-1.5 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/15">{s.regulator} {s.name}</button>)}
              </div>
            )}
          </L>
        )}
        {(type?.perSubject || form.subject) && <L label={type?.perSubject ? "Product or site *" : "Product or site"} span><input value={form.subject} onChange={(e) => set("subject", e.target.value)} className={inputCls} placeholder="e.g. Shea butter 250g jar" /></L>}
        <L label="Does it apply?">
          <select value={form.applicability} onChange={(e) => set("applicability", e.target.value)} className={inputCls}>
            <option value="APPLICABLE">Applies</option><option value="NOT_APPLICABLE">Does not apply</option><option value="UNASSESSED">Not assessed yet</option>
          </select>
        </L>
        {form.applicability === "NOT_APPLICABLE"
          ? <L label="Why not *"><input value={form.notApplicableReason} onChange={(e) => set("notApplicableReason", e.target.value)} className={inputCls} /></L>
          : <L label="Status">
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                <option value="NOT_REGISTERED">Not registered</option><option value="IN_PROGRESS">In progress</option><option value="REGISTERED">Registered</option><option value="EXPIRED">Expired</option><option value="SUSPENDED">Suspended</option>
              </select>
            </L>}
        <L label="Reference number"><input value={form.referenceNumber} onChange={(e) => set("referenceNumber", e.target.value)} className={inputCls} /></L>
        <L label="Responsible">
          <select value={form.responsibleBdoId} onChange={(e) => set("responsibleBdoId", e.target.value)} className={inputCls}>
            <option value="">— Nobody —</option>{bdos.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </L>
        <L label="Issue date"><input type="date" value={form.issueDate} onChange={(e) => set("issueDate", e.target.value)} className={inputCls} /></L>
        <L label={type?.renewal?.kind === "NONE" ? "Expiry date (if any)" : "Expiry date"}><input type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className={inputCls} /></L>
        <L label="Next action"><input value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)} className={inputCls} /></L>
        <L label="Next action by"><input type="date" value={form.nextActionDate} onChange={(e) => set("nextActionDate", e.target.value)} className={inputCls} /></L>
      </div>
      {type && <p className="text-[11px] text-gray-400">Renewal: {type.renewal.kind === "NONE" ? "does not renew" : type.renewal.kind === "INTERVAL" ? `every ${type.renewal.intervalMonths} months from the issue date` : "on the expiry date shown on the certificate"}.</p>}
      {form.smeId && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-600">Evidence</p>
            <label className="text-xs font-medium text-accent cursor-pointer">{uploading ? "Uploading…" : "+ Upload"}<input type="file" className="hidden" onChange={upload} disabled={uploading} /></label>
          </div>
          {docs.length === 0 ? <p className="text-xs text-gray-400">No documents for this client yet.</p> : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {docs.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.evidenceDocIds.includes(d.id)} onChange={(e) => set("evidenceDocIds", e.target.checked ? [...form.evidenceDocIds, d.id] : form.evidenceDocIds.filter((x) => x !== d.id))} />
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="truncate text-gray-700 hover:underline">{d.fileName}</a>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {record && audit.length > 0 && (
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer flex items-center gap-1"><History size={12} /> History ({audit.length})</summary>
          <ul className="mt-2 space-y-1">
            {audit.map((a) => (
              <li key={a.id}>{new Date(a.createdAt).toLocaleString()} · {a.actorName ?? "Someone"} · {a.action}{a.changes?.length ? `: ${a.changes.map((c) => `${c.field} ${c.from || "—"} → ${c.to || "—"}`).join("; ")}` : ""}{a.note ? ` — ${a.note}` : ""}</li>
            ))}
          </ul>
        </details>
      )}
    </Modal>
  );
}

function OutreachModal({ record, onClose, onSaved }: { record: Rec; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState("CALL");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true); setError("");
    try { await api.post(`/compliance/${record.id}/outreach`, { type, note }); toast.success("Outreach logged", { description: record.clientName }); onSaved(); } catch (e) { setError(errText(e, "Failed to save.")); } finally { setSaving(false); }
  };
  return (
    <Modal title={`Log outreach — ${record.clientName}`} onClose={onClose} footer={<>
      <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
      <button onClick={save} disabled={saving || !note.trim()} className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
    </>}>
      {error && <div className="bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
      <p className="text-xs text-gray-500">About {record.regulator} {record.requirementName}. It goes on the client&apos;s follow-up log.</p>
      <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>{["CALL", "VISIT", "MEETING", "EMAIL", "OTHER"].map((t) => <option key={t}>{t}</option>)}</select>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What happened?" className={`${inputCls} resize-none`} />
    </Modal>
  );
}

function OpportunityModal({ record, onClose, onSaved }: { record: Rec; onClose: () => void; onSaved: () => void }) {
  const { byKey } = useCompanies();
  const { data: bdos = [] } = useQuery<Bdo[]>({ queryKey: ["bdos", record.company], queryFn: () => fetcher(`/bdo?company=${record.company}`) });
  const renewal = ["VERIFIED", "AWAITING_VERIFICATION"].includes(record.state) && record.renewalDue;
  const [form, setForm] = useState({ ownerBdoId: record.responsibleBdoId ?? "", potentialFeeGhs: "", nextAction: "", nextActionDate: "", serviceType: renewal ? "Renewal support" : "Registration assistance" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const save = async () => {
    setSaving(true); setError("");
    try {
      await api.post(`/compliance/${record.id}/opportunity`, { ...form, potentialFeeGhs: form.potentialFeeGhs || null, nextActionDate: form.nextActionDate || null });
      const c = byKey[record.company];
      setDone(c ? `${companyHref(c)}?q=${encodeURIComponent(record.clientName)}` : "/");
    } catch (e) { setError(errText(e, "Failed to create the opportunity.")); } finally { setSaving(false); }
  };
  return (
    <Modal title={`New opportunity — ${record.clientName}`} onClose={done ? onSaved : onClose} footer={done
      ? <><Link href={done} className="px-4 py-2 text-sm font-medium text-accent">Open in pipeline →</Link><button onClick={onSaved} className="px-4 py-2 text-sm border rounded-lg">Close</button></>
      : <><button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
        <button onClick={save} disabled={saving || !form.ownerBdoId} className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg disabled:opacity-50">{saving ? "Creating…" : "Create deal"}</button></>}>
      {done ? <p className="text-sm text-green-700">The deal is in the pipeline and counts towards the dashboards and KPIs like any other.</p> : <>
        {error && <div className="bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
        <p className="text-xs text-gray-500">{record.regulator} {record.requirementName}{record.subject ? ` (${record.subject})` : ""} — {STATE_LABEL[record.state]}.</p>
        <L label="Service"><input value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} className={inputCls} /></L>
        <L label="Owner *"><select value={form.ownerBdoId} onChange={(e) => setForm({ ...form, ownerBdoId: e.target.value })} className={inputCls}><option value="">— Choose —</option>{bdos.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></L>
        <L label="Potential fee (GHS)"><input type="number" min={0} value={form.potentialFeeGhs} onChange={(e) => setForm({ ...form, potentialFeeGhs: e.target.value })} className={inputCls} /></L>
        <L label="Next action"><input value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} className={inputCls} /></L>
        <L label="By"><input type="date" value={form.nextActionDate} onChange={(e) => setForm({ ...form, nextActionDate: e.target.value })} className={inputCls} /></L>
      </>}
    </Modal>
  );
}
