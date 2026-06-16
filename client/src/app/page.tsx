"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TrendingUp, Users, Building2, Handshake, DollarSign, AlertTriangle } from "lucide-react";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6"];

export default function CEODashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ceo-dashboard"],
    queryFn: () => fetcher("/dashboard/ceo"),
  });

  if (isLoading)
    return (
      <div className="text-gray-400 p-8">Loading dashboard…</div>
    );
  if (isError || !data)
    return (
      <div className="text-red-400 p-8">
        Failed to load data. Make sure the server is running on port 4000.
      </div>
    );

  const bapxStageData = (
    data.bapx.byStage as Array<{ dealStage: string; _count: { _all: number } }>
  ).map((s) => ({ name: s.dealStage, value: s._count._all }));

  const tradelineStageData = (
    data.tradeline.byStage as Array<{ dealStage: string; _count: { _all: number } }>
  ).map((s) => ({ name: s.dealStage, value: s._count._all }));

  const leadStatusData = (
    data.leads.byStatus as Array<{ status: string; _count: { _all: number } }>
  ).map((s) => ({ name: s.status, value: s._count._all }));

  const bapxHealthData = (
    data.bapx.byHealth as Array<{ dealHealth: string; _count: { _all: number } }>
  ).map((s) => ({ name: s.dealHealth, value: s._count._all }));

  const fmt = (n: number) =>
    n.toLocaleString("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CEO Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Monday brief — live system overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="BAPX Deals" value={data.bapx.total} icon={<TrendingUp size={20} />} color="indigo" />
        <KpiCard label="Tradeline Deals" value={data.tradeline.total} icon={<TrendingUp size={20} />} color="emerald" />
        <KpiCard label="Revenue Received" value={fmt(data.tradeline.revenueReceived)} icon={<DollarSign size={20} />} color="amber" />
        <KpiCard label="Outstanding" value={fmt(data.tradeline.outstanding)} icon={<AlertTriangle size={20} />} color="red" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Leads" value={data.leads.total} icon={<Users size={20} />} color="sky" />
        <KpiCard label="SMEs Tracked" value={data.smes.total} icon={<Building2 size={20} />} color="violet" />
        <KpiCard label="Active Partnerships" value={data.partnerships.active} icon={<Handshake size={20} />} color="teal" />
        <KpiCard label="Grants in Flight" value={data.grants.inFlight} icon={<DollarSign size={20} />} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="BAPX Pipeline by Stage">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bapxStageData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={44} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tradeline Pipeline by Stage">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tradelineStageData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={44} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="BAPX Deal Health">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={bapxHealthData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {bapxHealthData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Leads by Status">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={leadStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {leadStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    sky: "bg-sky-50 text-sky-600",
    violet: "bg-violet-50 text-violet-600",
    teal: "bg-teal-50 text-teal-600",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      <div>
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold text-gray-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}
