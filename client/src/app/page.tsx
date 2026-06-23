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
import { TrendingUp, Users, Building2, Handshake, DollarSign, AlertTriangle, FolderKanban } from "lucide-react";
import Link from "next/link";

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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">CEO Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Monday brief — live system overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard label="BAPX Deals" value={data.bapx.total} icon={<TrendingUp size={20} />} color="indigo" />
        <KpiCard label="Tradeline Deals" value={data.tradeline.total} icon={<TrendingUp size={20} />} color="emerald" />
        <KpiCard label="Revenue Received" value={fmt(data.tradeline.revenueReceived)} icon={<DollarSign size={20} />} color="amber" />
        <KpiCard label="Outstanding" value={fmt(data.tradeline.outstanding)} icon={<AlertTriangle size={20} />} color="red" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard label="Total Leads" value={data.leads.total} icon={<Users size={20} />} color="sky" />
        <KpiCard label="SMEs Tracked" value={data.smes.total} icon={<Building2 size={20} />} color="violet" />
        <KpiCard label="Active Partnerships" value={data.partnerships.active} icon={<Handshake size={20} />} color="teal" />
        <KpiCard label="Grants in Flight" value={data.grants.inFlight} icon={<DollarSign size={20} />} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
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

      {/* Projects section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FolderKanban size={18} className="text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-900">Projects</h2>
            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{data.projects.total}</span>
          </div>
          <Link href="/projects" className="text-xs text-indigo-600 hover:underline font-medium">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(data.projects.list as ProjectItem[]).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

type ProjectItem = {
  id: string;
  name: string;
  leader: string;
  status: string;
  company: string;
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  ON_HOLD:   "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const PROJECT_COMPANY_COLORS: Record<string, string> = {
  BAPX:      "text-indigo-600",
  TRADELINE: "text-emerald-600",
  SHARED:    "text-gray-500",
};

function ProjectCard({ project }: { project: ProjectItem }) {
  return (
    <Link href="/projects" className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${PROJECT_COMPANY_COLORS[project.company] ?? "text-gray-400"}`}>
          {project.company}
        </span>
        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[11px] font-medium ${PROJECT_STATUS_COLORS[project.status] ?? "bg-gray-100 text-gray-500"}`}>
          {project.status.replace("_", " ")}
        </span>
      </div>
      <p className="font-semibold text-sm text-gray-900 leading-snug">{project.name}</p>
      <p className="text-xs text-gray-400 mt-1">Leader: {project.leader}</p>
    </Link>
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
