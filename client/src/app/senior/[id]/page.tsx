"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { Users, Briefcase, ListChecks, ArrowRight } from "lucide-react";

type Member = {
  bdo: { id: string; name: string; company: string; role: string | null; isSelf: boolean };
  deals: number;
  revenueReceived: number;
  revenuePotential: number;
  tasks: { open: number; overdue: number; completed: number };
  kpi: { onTrack: number; atRisk: number; offTrack: number };
};
type SeniorDash = {
  senior: { id: string; name: string; company: string; role: string | null };
  members: Member[];
  totals: { members: number; deals: number; revenueReceived: number; revenuePotential: number; tasksOpen: number; tasksOverdue: number };
};

const fmt = (n: number) => "GHS " + (n ?? 0).toLocaleString();

export default function SeniorDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useQuery<SeniorDash>({
    queryKey: ["senior-dashboard", id],
    queryFn: () => fetcher(`/dashboard/senior/${id}`),
  });

  if (isLoading || !data) {
    return <div className="p-6 text-center text-gray-400 text-sm">Loading team dashboard…</div>;
  }

  const { senior, members, totals } = data;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users size={22} /> {senior.name}&apos;s Team</h1>
        <p className="text-sm text-gray-500 mt-1">{totals.members} member{totals.members !== 1 ? "s" : ""} · {senior.company}</p>
      </div>

      {/* Team totals */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile icon={<Users size={15} />} label="Members" value={String(totals.members)} />
        <Tile icon={<Briefcase size={15} />} label="Deals" value={String(totals.deals)} />
        <Tile label="Revenue Received" value={fmt(totals.revenueReceived)} accent="text-green-700" />
        <Tile label="Pipeline Potential" value={fmt(totals.revenuePotential)} accent="text-indigo-700" />
        <Tile icon={<ListChecks size={15} />} label="Open / Overdue Tasks" value={`${totals.tasksOpen} / ${totals.tasksOverdue}`} accent={totals.tasksOverdue > 0 ? "text-red-600" : undefined} />
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Team Leaderboard</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Member", "Deals", "Received", "Potential", "Tasks (open/overdue)", "KPI Health", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members
                .slice()
                .sort((a, b) => b.revenueReceived - a.revenueReceived)
                .map((m) => (
                  <tr key={m.bdo.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-900">
                        {m.bdo.name}
                        {m.bdo.isSelf && <span className="ml-2 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full uppercase">You</span>}
                      </div>
                      <div className="text-[11px] text-gray-400">{m.bdo.role ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{m.deals}</td>
                    <td className="px-3 py-2.5 font-medium text-green-700 tabular-nums whitespace-nowrap">{fmt(m.revenueReceived)}</td>
                    <td className="px-3 py-2.5 text-gray-600 tabular-nums whitespace-nowrap">{fmt(m.revenuePotential)}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {m.tasks.open} / <span className={m.tasks.overdue > 0 ? "text-red-600 font-medium" : ""}>{m.tasks.overdue}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-green-600">{m.kpi.onTrack}</span>·
                        <span className="text-amber-600">{m.kpi.atRisk}</span>·
                        <span className="text-red-600">{m.kpi.offTrack}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/bdo/${m.bdo.id}`} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
                        Open <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              {members.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No team members yet. Assign staff a manager on the Manage BDOs screen.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-50 text-[11px] text-gray-400">KPI Health shows On&nbsp;Track · At&nbsp;Risk · Off&nbsp;Track counts for the current month.</div>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, accent = "text-gray-900" }: { icon?: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium uppercase tracking-wide">{icon} {label}</div>
      <div className={`text-xl font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}
