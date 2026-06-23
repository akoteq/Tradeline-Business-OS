"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { TrendingUp, Users, ListChecks, DollarSign } from "lucide-react";
import Link from "next/link";

type BdoSummary = {
  bdo: { id: string; name: string; company: string };
  bapxDeals: Array<{ id: string; businessName: string; dealStage: string; dealHealth: string }>;
  tradelineDeals: Array<{ id: string; businessName: string; dealStage: string; dealHealth: string }>;
  leads: Array<{ id: string; businessName: string; status: string }>;
  tasks: Array<{ id: string; deliverable: string; status: string; priority: string }>;
};

export default function BdoDashboard() {
  const { user } = useAuth();
  const bdoId = user?.bdoId ?? null;
  const displayName = user?.bdoName ?? user?.email ?? null;

  const { data, isLoading, isError } = useQuery<BdoSummary>({
    queryKey: ["bdo-dashboard", bdoId],
    queryFn: () => fetcher(`/dashboard/bdo/${bdoId}`),
    enabled: !!bdoId,
  });

  if (!bdoId) {
    return (
      <div className="p-6 text-amber-600 bg-amber-50 rounded-xl m-6">
        Your account has no BDO ID configured. Ask the admin to set your <code className="font-mono text-xs">bdoId</code> in Supabase user settings.
      </div>
    );
  }

  if (isLoading) return <div className="p-8 text-gray-400">Loading your dashboard…</div>;
  if (isError || !data) return <div className="p-8 text-red-400">Failed to load dashboard.</div>;

  const { bapxDeals, tradelineDeals, leads, tasks } = data;
  const activeBapx = bapxDeals.filter((d) => d.dealHealth === 'ACTIVE').length;
  const activeTradeline = tradelineDeals.filter((d) => d.dealHealth === 'ACTIVE').length;
  const openTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back, {displayName}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard label="BAPX Deals" value={bapxDeals.length} sub={`${activeBapx} active`} icon={<TrendingUp size={20} />} color="indigo" href="/bapx/pipeline" />
        <KpiCard label="Tradeline Deals" value={tradelineDeals.length} sub={`${activeTradeline} active`} icon={<TrendingUp size={20} />} color="emerald" href="/tradeline/pipeline" />
        <KpiCard label="Leads" value={leads.length} icon={<Users size={20} />} color="sky" href="/leads" />
        <KpiCard label="Open Tasks" value={openTasks} icon={<ListChecks size={20} />} color="amber" href="/tasks" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PipelineList title="BAPX Pipeline" deals={bapxDeals.slice(0, 8)} href="/bapx/pipeline" />
        <PipelineList title="Tradeline Pipeline" deals={tradelineDeals.slice(0, 8)} href="/tradeline/pipeline" />
      </div>

      {openTasks > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm">Open Tasks</h3>
            <Link href="/tasks" className="text-xs text-indigo-600 hover:text-indigo-800">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').slice(0, 5).map((t) => (
              <div key={t.id} className="px-4 py-2.5 flex items-center justify-between">
                <p className="text-sm text-gray-800 truncate max-w-xs">{t.deliverable}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  t.priority === 'HIGH' ? 'bg-red-50 text-red-700' :
                  t.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{t.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, icon, color, href }: {
  label: string; value: number; sub?: string;
  icon: React.ReactNode; color: string; href: string;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    sky: "bg-sky-50 text-sky-600",
  };
  return (
    <Link href={href} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 hover:border-indigo-200 transition-colors">
      <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      <div>
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold text-gray-900 mt-0.5">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </Link>
  );
}

function PipelineList({ title, deals, href }: {
  title: string;
  deals: Array<{ id: string; businessName: string; dealStage: string; dealHealth: string }>;
  href: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        <Link href={href} className="text-xs text-indigo-600 hover:text-indigo-800">View all</Link>
      </div>
      {deals.length === 0 ? (
        <p className="px-4 py-8 text-sm text-gray-400 text-center">No deals yet</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {deals.map((d) => (
            <div key={d.id} className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">{d.businessName}</p>
                <p className="text-xs text-gray-400">{d.dealStage.replace(/_/g, ' ')}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                d.dealHealth === 'ACTIVE' ? 'bg-green-50 text-green-700' :
                d.dealHealth === 'CLOSED_WON' ? 'bg-indigo-50 text-indigo-700' :
                d.dealHealth === 'AT_RISK' ? 'bg-red-50 text-red-700' :
                'bg-gray-100 text-gray-600'
              }`}>{d.dealHealth.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
