"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Bell, ChevronDown, ChevronUp, X } from "lucide-react";

type Urgency = "overdue" | "today" | "1day" | "3days" | "week";

type Deadline = {
  id: string;
  type: "TRADELINE";
  businessName: string;
  dueDate: string;
  daysUntil: number;
  urgency: Urgency;
  bdo: { id: string; name: string } | null;
};

type StaleDeal = {
  id: string;
  type: "BAPX" | "TRADELINE" | "COMPANY";
  businessName: string;
  dealHealth: string;
  lastUpdated: string;
  daysSinceUpdate: number;
  bdo: { id: string; name: string } | null;
};

type AlertsResponse = { deadlines: Deadline[]; stale: StaleDeal[] };

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

type View = "popup" | "banner" | "hidden";

export function Alerts() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("hidden");
  const [autoShown, setAutoShown] = useState(false);
  const [bannerExpanded, setBannerExpanded] = useState(false);

  const bdoId = user?.role === "BDO" ? user.bdoId : null;
  const { data } = useQuery<AlertsResponse>({
    queryKey: ["alerts", { bdoId }],
    queryFn: () => fetcher(bdoId ? `/alerts?bdoId=${bdoId}` : "/alerts"),
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
  });

  const deadlines = data?.deadlines ?? [];
  const stale = data?.stale ?? [];
  const totalCount = deadlines.length + stale.length;

  // Auto-open as a popup once per session as soon as alerts are known
  useEffect(() => {
    if (!autoShown && data && totalCount > 0) {
      setView("popup");
      setAutoShown(true);
    }
  }, [data, totalCount, autoShown]);

  if (!user || totalCount === 0 || view === "hidden") return null;

  const urgentCount = deadlines.filter((d) => d.urgency === "overdue" || d.urgency === "today" || d.urgency === "1day").length;
  const isUrgent = urgentCount > 0;

  const list = (
    <div className="space-y-5">
      {deadlines.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Upcoming Deadlines ({deadlines.length})
          </p>
          <div className="space-y-1.5">
            {deadlines.map((d) => {
              const href = pipelineLink(d.type, d.bdo?.name);
              const content = (
                <div className="flex items-center justify-between gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.businessName}</p>
                    <p className="text-xs text-gray-400">
                      Due {new Date(d.dueDate).toLocaleDateString()}
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
              const href = pipelineLink(d.type, d.bdo?.name);
              const content = (
                <div className="flex items-center justify-between gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.businessName}</p>
                    <p className="text-xs text-gray-400">
                      {TYPE_LABELS[d.type]}{d.bdo ? ` · ${d.bdo.name}` : ""}
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
    </div>
  );

  if (view === "popup") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={() => setView("banner")} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-indigo-600" />
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
          {deadlines.length > 0 && `${deadlines.length} deadline${deadlines.length !== 1 ? "s" : ""} coming up`}
          {deadlines.length > 0 && stale.length > 0 && " · "}
          {stale.length > 0 && `${stale.length} deal${stale.length !== 1 ? "s" : ""} need${stale.length === 1 ? "s" : ""} attention`}
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
