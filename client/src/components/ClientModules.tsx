"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { toast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { useCompanies, type ClientField } from "@/lib/companies";
import { accessLevel } from "@/lib/auth";
import { ShieldCheck, Users, Building2 } from "lucide-react";

// Panels shown inside a client's drawer on the Clients page: the viewer's own company layer on
// the shared client (its field pack), the client's compliance records (companies that track
// compliance), and linked strategic contacts.

type Engagement = {
  id: string; company: string; companyName: string; profile: Record<string, unknown>;
  profileComplete: boolean; missingFields: string[]; fields: ClientField[]; since: string;
};

// Which companies' compliance the viewer works with: every company with the module for the
// Group Owner, otherwise their own company if it has the module on.
export function useComplianceCompanies() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const on = companies.filter((c) => c.modules?.compliance);
  if (!user) return [];
  if (accessLevel(user.role) === "GROUP_OWNER") return on;
  return on.filter((c) => c.key === user.bdoCompany);
}

const errText = (e: unknown, fallback: string) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

export function FieldInput({ field, value, onChange }: { field: ClientField; value: unknown; onChange: (v: unknown) => void }) {
  const cls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
  const v = value == null ? "" : String(value);
  if (field.type === "LONGTEXT") return <textarea value={v} onChange={(e) => onChange(e.target.value)} rows={2} className={`${cls} resize-none`} />;
  if (field.type === "SELECT") return (
    <select value={v} onChange={(e) => onChange(e.target.value)} className={cls}>
      <option value="">—</option>
      {(field.options ?? []).map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
    </select>
  );
  if (field.type === "BOOLEAN") return (
    <select value={v} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "true")} className={cls}>
      <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
    </select>
  );
  return <input type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"} value={v} onChange={(e) => onChange(e.target.value)} className={cls} />;
}

function showValue(f: ClientField, v: unknown) {
  if (v == null || v === "") return "—";
  if (f.type === "BOOLEAN") return v ? "Yes" : "No";
  if (f.type === "NUMBER") return Number(v).toLocaleString();
  return String(v).replace(/_/g, f.type === "SELECT" ? " " : "_");
}

export function EngagementSection({ smeId }: { smeId: string }) {
  const { user } = useAuth();
  const { byKey } = useCompanies();
  const qc = useQueryClient();
  const { data: engagements = [] } = useQuery<Engagement[]>({ queryKey: ["engagements", smeId], queryFn: () => fetcher(`/sme/${smeId}/engagements`) });
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // A company that hasn't worked with the client yet can still fill in its details.
  const own = user?.bdoCompany ? byKey[user.bdoCompany] : undefined;
  const showStart = !!own && (own.clientFields?.length ?? 0) > 0 && !engagements.some((e) => e.company === own.key);
  const list: Engagement[] = [
    ...engagements,
    ...(showStart && own ? [{ id: "new", company: own.key, companyName: own.name, profile: {}, profileComplete: false, missingFields: [], fields: own.clientFields ?? [], since: "" }] : []),
  ].filter((e) => e.fields?.length);

  const save = async (e: Engagement) => {
    setSaving(true); setError("");
    try {
      await api.put(`/sme/${smeId}/engagements/${e.company}`, { profile: form });
      toast.success("Details saved", { description: e.companyName });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["engagements", smeId] });
      qc.invalidateQueries({ queryKey: ["sme"] });
    } catch (err) { setError(errText(err, "Failed to save.")); }
    finally { setSaving(false); }
  };

  if (!list.length) return null;
  return (
    <div className="space-y-3">
      {list.map((e) => {
        const sections = [...new Set(e.fields.map((f) => f.section || "Details"))];
        const open = editing === e.company;
        return (
          <div key={e.company} className="border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-600"><Building2 size={13} /> {e.companyName} details</p>
              <div className="flex items-center gap-2">
                {e.id !== "new" && (e.profileComplete
                  ? <span className="text-[11px] text-green-700">Complete</span>
                  : <span className="text-[11px] text-amber-700">{e.missingFields.length} to fill in</span>)}
                {!open && <button onClick={() => { setEditing(e.company); setForm({ ...e.profile }); setError(""); }} className="text-xs font-medium text-accent hover:underline">{e.id === "new" ? "Fill in" : "Edit"}</button>}
              </div>
            </div>
            <div className="p-3 space-y-3">
              {e.id === "new" && !open && <p className="text-xs text-gray-500">{e.companyName} hasn&apos;t recorded its details for this client yet. Only {e.companyName} will see them.</p>}
              {sections.map((sec) => (
                <div key={sec}>
                  {sections.length > 1 && <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{sec}</p>}
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {e.fields.filter((f) => (f.section || "Details") === sec).map((f) => (
                      <div key={f.key} className={f.type === "LONGTEXT" ? "sm:col-span-2" : ""}>
                        <dt className="text-xs text-gray-400">{f.label}{f.required ? " *" : ""}</dt>
                        {open ? <FieldInput field={f} value={form[f.key]} onChange={(v) => setForm((x) => ({ ...x, [f.key]: v }))} />
                          : (e.id !== "new" && <dd className="text-gray-800 mt-0.5 whitespace-pre-wrap">{showValue(f, e.profile?.[f.key])}</dd>)}
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
              {open && (
                <div className="flex items-center justify-end gap-2">
                  {error && <span className="text-xs text-red-600 mr-auto">{error}</span>}
                  <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg">Cancel</button>
                  <button onClick={() => save(e)} disabled={saving} className="px-3 py-1.5 text-xs font-medium bg-accent text-accent-foreground rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type ComplianceRow = { id: string; regulator: string; requirementName: string; subject: string; state: string; dueDate: string | null; daysToDue: number | null; company: string };

export const STATE_STYLE: Record<string, string> = {
  VERIFIED: "bg-green-100 text-green-700", AWAITING_VERIFICATION: "bg-amber-100 text-amber-800", NOT_REGISTERED: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700", UNASSESSED: "bg-gray-100 text-gray-600", NOT_APPLICABLE: "bg-slate-100 text-slate-500",
  EXPIRED: "bg-red-100 text-red-700", SUSPENDED: "bg-red-100 text-red-700",
};
export const STATE_LABEL: Record<string, string> = {
  VERIFIED: "Verified", AWAITING_VERIFICATION: "Awaiting verification", NOT_REGISTERED: "Not registered", IN_PROGRESS: "In progress",
  UNASSESSED: "Not assessed", NOT_APPLICABLE: "Not applicable", EXPIRED: "Expired", SUSPENDED: "Suspended",
};

export function ClientComplianceSection({ smeId, clientName }: { smeId: string; clientName: string }) {
  const companies = useComplianceCompanies();
  const { data: rows = [] } = useQuery<ComplianceRow[]>({
    queryKey: ["compliance", "client", smeId], queryFn: () => fetcher(`/compliance?smeId=${smeId}`), enabled: companies.length > 0,
  });
  if (!companies.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-400"><ShieldCheck size={13} /> Compliance</p>
        <Link href={`/compliance?q=${encodeURIComponent(clientName)}`} className="text-xs font-medium text-accent hover:underline">Manage →</Link>
      </div>
      {rows.length === 0 ? <p className="text-sm text-gray-400">No compliance records yet.</p> : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <span className="text-gray-700 truncate">{r.regulator} · {r.requirementName}{r.subject ? ` (${r.subject})` : ""}</span>
              <span className="flex items-center gap-2 shrink-0">
                {r.daysToDue != null && r.daysToDue <= 90 && <span className={`text-[11px] ${r.daysToDue < 0 ? "text-red-600" : "text-amber-700"}`}>{r.daysToDue < 0 ? `${-r.daysToDue}d overdue` : `renews in ${r.daysToDue}d`}</span>}
                <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${STATE_STYLE[r.state]}`}>{STATE_LABEL[r.state]}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClientContactsSection({ smeId }: { smeId: string }) {
  const { data: rows = [] } = useQuery<{ id: string; name: string; organisation: string; role: string; ownerName: string | null }[]>({
    queryKey: ["contacts", "client", smeId], queryFn: () => fetcher(`/contacts?smeId=${smeId}`),
  });
  if (!rows.length) return null;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-1.5"><Users size={13} /> Linked contacts</p>
      <div className="space-y-1.5">
        {rows.map((c) => (
          <Link key={c.id} href={`/contacts?q=${encodeURIComponent(c.name)}`} className="block bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 text-sm">
            <span className="text-gray-800 font-medium">{c.name}</span>
            <span className="text-gray-500">{[c.role, c.organisation].filter(Boolean).length ? ` · ${[c.role, c.organisation].filter(Boolean).join(", ")}` : ""}</span>
            {c.ownerName && <span className="text-xs text-gray-400"> · owner {c.ownerName}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
