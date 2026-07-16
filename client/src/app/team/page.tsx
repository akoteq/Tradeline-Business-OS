"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { Mail, Phone, Users, Search, UserCog } from "lucide-react";

type Staff = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string;
  role: string | null;
  managerId: string | null;
  isActive: boolean;
};

// Company colour name → badge classes.
const badge: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-700", green: "bg-green-100 text-green-700",
  emerald: "bg-emerald-100 text-emerald-700", teal: "bg-teal-100 text-teal-700",
  sky: "bg-sky-100 text-sky-700", violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-700", rose: "bg-rose-100 text-rose-700", slate: "bg-slate-100 text-slate-700",
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

export default function TeamPage() {
  const { companies, byKey } = useCompanies();
  const [companyFilter, setCompanyFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: staff = [], isLoading } = useQuery<Staff[]>({
    queryKey: ["bdos"],
    queryFn: () => fetcher("/bdo"),
  });

  const nameById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s.name])), [staff]);

  const filtered = staff.filter((s) => {
    if (companyFilter && s.company !== companyFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [s.name, s.role, s.email].some((v) => v?.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users size={22} /> Team</h1>
          <p className="text-sm text-gray-500">Everyone across the group — {staff.length} staff in {companies.length} companies.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All Companies</option>
          {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, role, email…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Loading team…</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">No staff match your filters.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => {
            const co = byKey[s.company];
            return (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-sm shrink-0">
                    {initials(s.name) || "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 truncate">{s.name}</div>
                    <div className="text-xs text-gray-500 truncate">{s.role ?? "—"}</div>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${badge[co?.color ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
                    {co?.name ?? s.company}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-gray-600">
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 hover:text-indigo-600 truncate">
                      <Mail size={12} className="shrink-0" /> <span className="truncate">{s.email}</span>
                    </a>
                  )}
                  {s.phone && (
                    <div className="flex items-center gap-1.5"><Phone size={12} className="shrink-0" /> {s.phone}</div>
                  )}
                  {s.managerId && nameById[s.managerId] && (
                    <div className="flex items-center gap-1.5 text-gray-400"><UserCog size={12} className="shrink-0" /> Reports to {nameById[s.managerId]}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
