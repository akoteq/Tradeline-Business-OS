"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Users,
  Building2,
  Handshake,
  DollarSign,
  BarChart3,
  ListChecks,
  Database,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";

const nav = [
  { href: "/", label: "CEO Dashboard", icon: LayoutDashboard },
  {
    label: "BAPX",
    icon: Briefcase,
    children: [{ href: "/bapx/pipeline", label: "Pipeline" }],
  },
  {
    label: "Tradeline",
    icon: TrendingUp,
    children: [{ href: "/tradeline/pipeline", label: "Pipeline" }],
  },
  { href: "/leads", label: "Leads DB", icon: Users },
  { href: "/sme", label: "SME Database", icon: Building2 },
  { href: "/partnerships", label: "Partnerships", icon: Handshake },
  { href: "/grant-loans", label: "Grants & Loans", icon: DollarSign },
  { href: "/kpi", label: "KPI Scorecard", icon: BarChart3 },
  { href: "/tasks", label: "Scheme of Work", icon: ListChecks },
  { href: "/consolidated", label: "Consolidated", icon: Database },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState<string[]>(["BAPX", "Tradeline"]);

  const toggle = (label: string) =>
    setOpen((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  return (
    <aside className="w-60 min-h-screen bg-gray-900 text-gray-100 flex flex-col shrink-0">
      <div className="px-4 py-5 border-b border-gray-700">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Operations</div>
        <div className="font-bold text-lg text-white leading-tight">Tradeline · BAPX</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
        {nav.map((item) => {
          if ("children" in item) {
            const isOpen = open.includes(item.label);
            const Icon = item.icon;
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggle(item.label)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <Icon size={16} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    size={14}
                    className={clsx("transition-transform", isOpen && "rotate-180")}
                  />
                </button>
                {isOpen &&
                  item.children?.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={clsx(
                        "flex items-center gap-2 px-3 py-2 pl-8 rounded-lg text-sm transition-colors",
                        pathname === child.href
                          ? "bg-indigo-600 text-white"
                          : "text-gray-400 hover:bg-gray-800 hover:text-white"
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
              </div>
            );
          }

          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                pathname === item.href
                  ? "bg-indigo-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
        v1.0 · {new Date().getFullYear()}
      </div>
    </aside>
  );
}
