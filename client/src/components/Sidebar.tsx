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
  ShieldCheck,
  LogOut,
  UserCircle,
  X,
  FolderKanban,
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { useAuth } from "./AuthProvider";

const ADMIN_NAV = [
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
  {
    label: "Alpha Africa",
    icon: Building2,
    children: [{ href: "/pipeline/alpha-africa", label: "Pipeline" }],
  },
  {
    label: "Finance Factory",
    icon: Building2,
    children: [{ href: "/pipeline/finance-factory", label: "Pipeline" }],
  },
  {
    label: "Community Finance",
    icon: Building2,
    children: [{ href: "/pipeline/community-finance", label: "Pipeline" }],
  },
  {
    label: "Akoteq",
    icon: Building2,
    children: [{ href: "/pipeline/akoteq", label: "Pipeline" }],
  },
  { href: "/leads", label: "Leads DB", icon: Users },
  { href: "/sme", label: "SME Database", icon: Building2 },
  { href: "/partnerships", label: "Partnerships", icon: Handshake },
  { href: "/grant-loans", label: "Grants & Loans", icon: DollarSign },
  { href: "/kpi", label: "KPI Scorecard", icon: BarChart3 },
  { href: "/tasks", label: "Scheme of Work", icon: ListChecks },
  { href: "/consolidated", label: "Consolidated", icon: Database },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/users", label: "Manage Users", icon: ShieldCheck },
];

const AUTH_PATHS = ["/login", "/change-password"];

type SidebarProps = { mobileOpen?: boolean; onClose?: () => void };

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState<string[]>(["BAPX", "Tradeline"]);

  if (AUTH_PATHS.includes(pathname)) return null;
  if (loading) return <aside className="hidden md:flex w-60 min-h-screen bg-gray-900 shrink-0" />;
  if (!user) return null;

  const toggle = (label: string) =>
    setOpen((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const asideClass = clsx(
    "w-60 bg-gray-900 text-gray-100 flex flex-col shrink-0 z-30",
    "fixed inset-y-0 left-0 transition-transform duration-200 md:relative md:translate-x-0",
    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
  );

  const CloseBtn = onClose && (
    <button onClick={onClose} className="md:hidden p-1 text-gray-400 hover:text-white">
      <X size={18} />
    </button>
  );

  if (user.role === "BDO") {
    return (
      <aside className={asideClass}>
        <div className="px-4 py-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">BDO Portal</div>
            <div className="font-bold text-lg text-white leading-tight">Tradeline · BAPX</div>
          </div>
          {CloseBtn}
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {user.bdoId && (
            <Link
              href={`/bdo/${user.bdoId}`}
              onClick={onClose}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                pathname.startsWith("/bdo/")
                  ? "bg-indigo-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <LayoutDashboard size={16} />
              My Dashboard
            </Link>
          )}
        </nav>
        <UserFooter name={user.bdoName ?? user.email} email={user.email} onLogout={logout} />
      </aside>
    );
  }

  return (
    <aside className={asideClass}>
      <div className="px-4 py-5 border-b border-gray-700 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Operations</div>
          <div className="font-bold text-lg text-white leading-tight">Tradeline · BAPX</div>
        </div>
        {CloseBtn}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
        {ADMIN_NAV.map((item) => {
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
                  <ChevronDown size={14} className={clsx("transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen &&
                  item.children?.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onClose}
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
              onClick={onClose}
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

      <UserFooter name={user.email} email={user.role} onLogout={logout} />
    </aside>
  );
}

function UserFooter({ name, email, onLogout }: { name: string | null; email: string; onLogout: () => void }) {
  return (
    <div className="px-3 py-3 border-t border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <UserCircle size={16} className="text-gray-400 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-200 truncate">{name}</div>
          <div className="text-[11px] text-gray-500 truncate">{email}</div>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
      >
        <LogOut size={13} />
        Sign out
      </button>
    </div>
  );
}
