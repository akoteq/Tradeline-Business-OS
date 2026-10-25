"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isStaff } from "@/lib/auth";
import { useCompanies, companyHref } from "@/lib/companies";
import { Bell, ChevronDown, ChevronUp, X } from "lucide-react";

type Urgency = "overdue" | "today" | "1day" | "3days" | "week";

type Deadline = {
  id: string;
  type: "TRADELINE" | "TASK";
  subtype?: string;
  businessName: string;
  dueDate: string;
  daysUntil: number;
  urgency: Urgency;
  bdo: { id: string; name: string } | null;
};

type StaleDeal = {
  id: string;
  type: "BAPX" | "TRADELINE" | "COMPANY";
  company?: string;
  businessName: string;
  dealHealth: string;
  lastUpdated: string;
  daysSinceUpdate: number;
  bdo: { id: string; name: string } | null;
};

// KPIs behind pace (kpiRisks) and early warnings (kpiSignals): slipping, quiet for a week,
// over-allocated, or finished linked work with no result logged.
type KpiAlert = {
  id: string; metric: string; owner: string | null; company: string; bdoId: string | null;
  reason?: string; detail?: string; type?: "AT_RISK" | "STALE" | "OVER_ALLOCATED" | "NO_RESULT";
};

// Tasks staff finished that wait for this manager to approve them before they count.
type Approval = { id: string; deliverable: string; submittedAt: string | null; bdo: { id: string; name: string } | null };

type AlertsResponse = { deadlines: Deadline[]; stale: StaleDeal[]; kpiRisks?: KpiAlert[]; kpiSignals?: KpiAlert[]; approvals?: Approval[] };

const SIGNAL_LABEL: Record<string, string> = { AT_RISK: "At risk", STALE: "Quiet", OVER_ALLOCATED: "Over-allocated", NO_RESULT: "No result" };

const URGENCY_STYLES: Record<Urgency, string> = {
  overdue: "bg-red-100 text-red-800 border-red-200",
  today: "bg-red-50 text-red-700 border-red-200",
  "1day": "bg-orange-50 text-orange-700 border-orange-200",
  "3days": "bg-amber-50 text-amber-700 border-amber-200",
  week: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

function urgencyLabel(u: Urgency, daysUntil: number) {
  switch (u) {
    case "overdue": return `Overdue by ${Math.abs(daysUntil)}d`;
    case "today": return "Due today";
    case "1day": return "1 day left";
    default: return `${daysUntil} days left`;
  }
}

const TYPE_LABELS: Record<StaleDeal["type"], string> = {
  BAPX: "BAPX",
  TRADELINE: "Tradeline",
  COMPANY: "Other Company",
};

const PIPELINE_HREF: Partial<Record<StaleDeal["type"], string>> = {
  BAPX: "/bapx/pipeline",
  TRADELINE: "/tradeline/pipeline",
};

function pipelineLink(type: StaleDeal["type"], bdoName?: string | null) {
  const base = PIPELINE_HREF[type];
  if (!base) return null;
  return bdoName ? `${base}?bdo=${encodeURIComponent(bdoName)}` : base;
}

function deadlineLink(d: Deadline) {
  if (d.type === "TASK") {
    return d.bdo?.name ? `/tasks?bdo=${encodeURIComponent(d.bdo.name)}` : "/tasks";
  }
  return pipelineLink("TRADELINE", d.bdo?.name);
}

type View = "popup" | "banner" | "hidden";

export function Alerts() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("hidden");
  const [autoShown, setAutoShown] = useState(false);
  const [bannerExpanded, setBannerExpanded] = useState(false);
  const { byKey } = useCompanies();

  const isBdo = isStaff(user);
  const bdoId = isBdo ? user?.bdoId ?? null : null;
  // BDOs are always scoped to their own data; admins/CEO see everyone.
  // An unlinked BDO (no bdoId) must NOT fall through to the org-wide feed.
  const { data } = useQuery<AlertsResponse>({
    queryKey: ["alerts", { bdoId }],
    queryFn: () => fetcher(bdoId ? `/alerts?bdoId=${bdoId}` : "/alerts"),
    enabled: !!user && (!isBdo || !!bdoId),
    refetchInterval: 5 * 60 * 1000,
  });

  const deadlines = data?.deadlines ?? [];
  const stale = data?.stale ?? [];
  const kpiAlerts = [
    ...(data?.kpiRisks ?? []).map((k) => ({ ...k, label: "Behind", text: k.reason ?? "" })),
    ...(data?.kpiSignals ?? []).map((k) => ({ ...k, label: SIGNAL_LABEL[k.type ?? ""] ?? "KPI", text: k.detail ?? "" })),
  ];
  const kpiHref = isBdo ? "/my-kpis" : "/kpi-framework";
  const approvals = data?.approvals ?? [];
  const totalCount = deadlines.length + stale.length + kpiAlerts.length + approvals.length;

  // The dashboard is now the primary alert surface (see CEODashboard), so this
  // no longer force-opens a full-screen modal every session — it starts as a
  // quiet collapsed banner instead. Users can still tap "View all" for the modal.
  useEffect(() => {
    if (!autoShown && data && totalCount > 0) {
      setView("banner");
      setAutoShown(true);
    }
  }, [data, totalCount, autoShown]);

  if (!user || totalCount === 0 || view === "hidden") return null;

  const urgentCount = deadlines.filter((d) => d.urgency === "overdue" || d.urgency === "today" || d.urgency === "1day").length;
  const isUrgent = urgentCount > 0;

  const list = (
    <div className="space-y-5">
      {approvals.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Waiting for your approval ({approvals.length})
          </p>
          <div className="space-y-1.5">
            {approvals.slice(0, 10).map((a) => (
              <Link key={a.id} href="/tasks?view=approvals" onClick={() => setView("banner")} className="block hover:opacity-80">
                <div className="flex items-center justify-between gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.deliverable}</p>
                    <p className="text-xs text-gray-400">
                      {a.bdo?.name ?? "Unassigned"}{a.submittedAt ? ` · done ${new Date(a.submittedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 bg-sky-50 text-sky-700 border-sky-200">Approve</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {deadlines.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Upcoming Deadlines ({deadlines.length})
          </p>
          <div className="space-y-1.5">
            {deadlines.map((d) => {
              const href = deadlineLink(d);
              const content = (
                <div className="flex items-center justify-between gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.businessName}</p>
                    <p className="text-xs text-gray-400">
                      {d.subtype ? `${d.subtype} · ` : ""}Due {new Date(d.dueDate).toLocaleDateString()}
                      {d.bdo && ` · ${d.bdo.name}`}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${URGENCY_STYLES[d.urgency]}`}>
                    {urgencyLabel(d.urgency, d.daysUntil)}
                  </span>
                </div>
              );
              return href
                ? <Link key={d.id} href={href} onClick={() => setView("banner")} className="block hover:opacity-80">{content}</Link>
                : <div key={d.id}>{content}</div>;
            })}
          </div>
        </div>
      )}

      {stale.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Needs Attention ({stale.length}) — no update in 14+ days
          </p>
          <div className="space-y-1.5">
            {stale.map((d) => {
              const co = d.company ? byKey[d.company] : undefined;
              const href = co
                ? `${companyHref(co)}${d.bdo?.name ? `?bdo=${encodeURIComponent(d.bdo.name)}` : ""}`
                : pipelineLink(d.type, d.bdo?.name);
              const content = (
                <div className="flex items-center justify-between gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.businessName}</p>
                    <p className="text-xs text-gray-400">
                      {co?.name ?? TYPE_LABELS[d.type]}{d.bdo ? ` · ${d.bdo.name}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 bg-gray-100 text-gray-600 border-gray-200">
                    {d.daysSinceUpdate}d silent
                  </span>
                </div>
              );
              return href
                ? <Link key={d.id} href={href} onClick={() => setView("banner")} className="block hover:opacity-80">{content}</Link>
                : <div key={d.id}>{content}</div>;
            })}
          </div>
        </div>
      )}

      {kpiAlerts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            KPIs ({kpiAlerts.length})
          </p>
          <div className="space-y-1.5">
            {kpiAlerts.slice(0, 25).map((k, i) => (
              <Link key={`${k.id}-${k.bdoId ?? ""}-${k.label}-${i}`} href={kpiHref} onClick={() => setView("banner")} className="block hover:opacity-80">
                <div className="flex items-center justify-between gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{k.metric}{k.owner ? ` · ${k.owner}` : ""}</p>
                    <p className="text-xs text-gray-400 truncate">{k.text}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${k.label === "Behind" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    {k.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (view === "popup") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={() => setView("banner")} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-accent" />
              <h2 className="font-semibold text-gray-900">Alerts</h2>
            </div>
            <button onClick={() => setView("banner")} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="p-5 overflow-y-auto">{list}</div>
        </div>
      </div>
    );
  }

  // Collapsed to a banner after the popup is closed
  return (
    <div className={`border-b ${isUrgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
      <div className="px-4 md:px-6 py-2.5 flex items-center gap-3">
        <Bell size={16} className={isUrgent ? "text-red-600 shrink-0" : "text-amber-600 shrink-0"} />
        <button
          onClick={() => setBannerExpanded((e) => !e)}
          className={`flex-1 text-left text-sm font-medium ${isUrgent ? "text-red-800" : "text-amber-800"}`}
        >
          {approvals.length > 0 && `${approvals.length} task${approvals.length !== 1 ? "s" : ""} to approve`}
          {approvals.length > 0 && (deadlines.length > 0 || stale.length > 0 || kpiAlerts.length > 0) && " · "}
          {deadlines.length > 0 && `${deadlines.length} deadline${deadlines.length !== 1 ? "s" : ""} coming up`}
          {deadlines.length > 0 && stale.length > 0 && " · "}
          {stale.length > 0 && `${stale.length} deal${stale.length !== 1 ? "s" : ""} need${stale.length === 1 ? "s" : ""} attention`}
          {(deadlines.length > 0 || stale.length > 0) && kpiAlerts.length > 0 && " · "}
          {kpiAlerts.length > 0 && `${kpiAlerts.length} KPI alert${kpiAlerts.length !== 1 ? "s" : ""}`}
        </button>
        <button
          onClick={() => setView("popup")}
          className={`text-xs font-medium underline shrink-0 ${isUrgent ? "text-red-700 hover:text-red-900" : "text-amber-700 hover:text-amber-900"}`}
        >
          View all
        </button>
        <button onClick={() => setBannerExpanded((e) => !e)} className={isUrgent ? "text-red-500 hover:text-red-700" : "text-amber-500 hover:text-amber-700"}>
          {bannerExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button onClick={() => setView("hidden")} className={isUrgent ? "text-red-400 hover:text-red-600" : "text-amber-400 hover:text-amber-600"}>
          <X size={16} />
        </button>
      </div>

      {bannerExpanded && <div className="px-4 md:px-6 pb-3">{list}</div>}
    </div>
  );
}