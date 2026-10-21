"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bell,
  Activity,
  Users,
  Building2,
  Handshake,
  DollarSign,
  BarChart3,
  ListChecks,
  Database,
  ChevronDown,
  LogOut,
  UserCircle,
  X,
  FolderKanban,
  UsersRound,
  HelpCircle,
  Target,
  ShieldCheck,
  AlertTriangle,
  Contact,
  Briefcase,
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { useAuth } from "./AuthProvider";
import { useCompanies } from "@/lib/companies";
import { accessLevel, ACCESS_LEVEL_LABEL } from "@/lib/auth";

/**
 * One nav per role (Group Owner / Business CEO / Staff). Stored roles fold into these via
 * accessLevel(): ADMIN and CEO are Group Owners; BDO and the retired titles are Staff.
 *
 * Copy rules for this file:
 *  - Sentence case everywhere ("Group finances", not "Group Financials").
 *  - Labels name the place ("Clients") or start with a verb for an action ("Assign tasks").
 *  - Section titles say what the items are for, in plain words.
 *  - `hint` is a one-line explanation shown on hover. Only add one when the label alone isn't enough.
 */

/**
 * status: "live" -> route + API already wired, safe to ship
 *         "soon" -> nav slot exists but the page isn't built yet (shown greyed out, not clickable)
 * Flip an item to "live" the moment its route is real.
 */
type NavStatus = "live" | "soon";

type IconType = typeof LayoutDashboard;

type NavItem = { href: string; label: string; icon: IconType; status?: NavStatus; hint?: string };
type NavChild = { href: string; label: string; status?: NavStatus };
type NavGroup = {
  label: string;
  icon: IconType;
  variant?: "branch"; // "branch" renders the trunk/twig connector style
  children: NavChild[];
  /** Shown when the group has no children yet. */
  empty?: { label: string; href: string };
};
type NavEntry = NavItem | NavGroup;
type NavSection = { title?: string; items: NavEntry[] };

const AUTH_PATHS = ["/login", "/change-password"];

type SidebarProps = { mobileOpen?: boolean; onClose?: () => void };

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const { companies } = useCompanies();
  const [open, setOpen] = useState<string[]>(["Companies"]);

  if (AUTH_PATHS.includes(pathname)) return null;
  if (loading) return <aside className="hidden md:flex w-64 min-h-screen bg-surface shrink-0" />;
  if (!user) return null;

  const toggle = (label: string) =>
    setOpen((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const level = accessLevel(user.role);
  // Compliance shows only where the module is on: any company for the Group Owner, else their own.
  const complianceOn = level === "GROUP_OWNER"
    ? companies.some((c) => c.modules?.compliance)
    : !!companies.find((c) => c.key === user.bdoCompany)?.modules?.compliance;
  const complianceItem: NavItem[] = complianceOn
    ? [{ href: "/compliance", label: "Compliance", icon: ShieldCheck, status: "live", hint: "Compliance deadlines and tasks" }]
    : [];

  // ---- Role-scoped nav content -------------------------------------------------

  const groupOwnerNav: NavSection[] = [
    {
      items: [
        { href: "/", label: "Home", icon: Activity, status: "live", hint: "Alerts and activity across all your companies" },
        {
          label: "Companies",
          icon: Building2,
          variant: "branch",
          children: companies.map((c) => ({ href: `/dashboard/${c.slug}`, label: c.name, status: "live" })),
          empty: { label: "Add your first company", href: "/admin/companies" },
        },
      ],
    },
    {
      title: "Sales & contacts",
      items: [
        { href: "/leads", label: "All leads", icon: Users, status: "live", hint: "Every lead across your companies" },
        { href: "/sme", label: "Clients", icon: Briefcase, status: "live" },
        { href: "/contacts", label: "Contacts", icon: Contact, status: "live" },
      ],
    },
    {
      title: "Money",
      items: [
        { href: "/consolidated", label: "Group finances", icon: Database, status: "live", hint: "All your companies' numbers, combined" },
        { href: "/investments", label: "Investments", icon: DollarSign, status: "soon" },
      ],
    },
    {
      title: "Performance",
      items: [
        { href: "/kpi-framework", label: "Company KPIs", icon: BarChart3, status: "live", hint: "Set targets and track progress, company by company" },
        { href: "/my-kpis", label: "Team KPIs", icon: Target, status: "live", hint: "KPIs assigned to people on your team" },
      ],
    },
    {
      title: "Risk & compliance",
      items: [
        ...complianceItem,
        { href: "/risks", label: "Risks", icon: AlertTriangle, status: "live", hint: "What could go wrong, who owns it, and what's being done" },
      ],
    },
    {
      title: "Manage",
      items: [
        { href: "/tasks", label: "Assign tasks", icon: ListChecks, status: "live" },
        { href: "/admin/team", label: "Team & access", icon: UsersRound, status: "live", hint: "Invite people and choose what each person can see" },
        { href: "/admin/companies", label: "Add a company", icon: Building2, status: "live" },
      ],
    },
    {
      items: [{ href: "/help", label: "Help", icon: HelpCircle, status: "live", hint: "Guides and definitions" }],
    },
  ];

  // A Business CEO's dashboard is their own company's, not the group view.
  const ownCompany = companies.find((c) => c.key === user.bdoCompany);
  const businessCeoNav: NavSection[] = [
    {
      items: [
        { href: ownCompany ? `/dashboard/${ownCompany.slug}` : "/", label: "Dashboard", icon: LayoutDashboard, status: "live", hint: "How your company is doing" },
        { href: "/alerts", label: "Alerts", icon: Bell, status: "soon" },
      ],
    },
    {
      title: "Money",
      items: [
        { href: "/finance", label: "Finance", icon: DollarSign, status: "soon" },
        { href: "/grant-loans", label: "Grants & loans", icon: DollarSign, status: "live" },
      ],
    },
    {
      title: "Work",
      items: [
        { href: "/tasks", label: "Assign tasks", icon: ListChecks, status: "live", hint: "Assign tasks to several people at once" },
        { href: "/projects", label: "Projects", icon: FolderKanban, status: "live" },
        { href: "/team", label: "Team", icon: UsersRound, status: "live" },
      ],
    },
    {
      title: "Sales & contacts",
      items: [
        { href: "/leads", label: "Leads", icon: Users, status: "live" },
        { href: "/sme", label: "Clients", icon: Briefcase, status: "live" },
        { href: "/contacts", label: "Contacts", icon: Contact, status: "live" },
        { href: "/partnerships", label: "Partnerships", icon: Handshake, status: "live" },
      ],
    },
    {
      title: "Performance",
      items: [
        { href: "/kpi-framework", label: "Company KPIs", icon: BarChart3, status: "live", hint: "Set targets and track progress" },
        { href: "/my-kpis", label: "Team KPIs", icon: Target, status: "live", hint: "KPIs assigned to people on your team" },
      ],
    },
    {
      title: "Risk & compliance",
      items: [
        ...complianceItem,
        { href: "/risks", label: "Risks", icon: AlertTriangle, status: "live", hint: "What could go wrong, who owns it, and what's being done" },
      ],
    },
    {
      items: [{ href: "/help", label: "Help", icon: HelpCircle, status: "live", hint: "Guides and definitions" }],
    },
  ];

  const staffNav: NavSection[] = [
    {
      items: [
        { href: "/overview", label: "Home", icon: LayoutDashboard, status: "live", hint: "What needs your attention today" },
        { href: "/tasks", label: "My tasks", icon: ListChecks, status: "live" },
        { href: "/leads", label: "My leads", icon: Users, status: "live" },
        { href: "/sme", label: "Clients", icon: Briefcase, status: "live" },
        { href: "/contacts", label: "Contacts", icon: Contact, status: "live" },
        ...complianceItem,
        { href: "/risks", label: "My risk actions", icon: AlertTriangle, status: "live", hint: "Risk actions assigned to you" },
        { href: "/my-kpis", label: "My KPIs", icon: Target, status: "live" },
        { href: "/help", label: "Help", icon: HelpCircle, status: "live", hint: "Guides and definitions" },
      ],
    },
  ];

  const nav = level === "GROUP_OWNER" ? groupOwnerNav : level === "BUSINESS_CEO" ? businessCeoNav : staffNav;

  const portalLabel = ACCESS_LEVEL_LABEL[level];

  const asideClass = clsx(
    "w-64 bg-surface text-foreground flex flex-col shrink-0 z-40 border-r border-border h-screen",
    "fixed inset-y-0 left-0 transition-transform duration-200",
    "md:sticky md:top-0 md:translate-x-0",
    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
  );

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-primary/40 backdrop-blur-[2px] md:hidden"
          aria-hidden
        />
      )}

      <aside className={asideClass}>
        <Brand onClose={onClose} />

        <nav aria-label="Main" className="no-scrollbar flex-1 overflow-y-auto py-3 px-2.5">
          {nav.map((section, i) => (
            <div key={section.title ?? `s${i}`} className={clsx(i > 0 && "mt-5")}>
              {section.title && <div className="type-colhead px-3 mb-1.5">{section.title}</div>}
              <div className="space-y-0.5">
                {section.items.map((item) =>
                  "children" in item ? (
                    <CompanyBranchGroup
                      key={item.label}
                      item={item}
                      isOpen={open.includes(item.label)}
                      onToggle={() => toggle(item.label)}
                      pathname={pathname}
                      onNavigate={onClose}
                    />
                  ) : (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      status={item.status}
                      hint={item.hint}
                      active={pathname === item.href}
                      onClick={onClose}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </nav>

        <UserFooter name={user.email} meta={portalLabel} onLogout={logout} />
      </aside>

      {/* Scrollbar hidden but still scrollable (wheel/touch/keyboard all still work) */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}

// ---- Subcomponents ---------------------------------------------------------

function Brand({ onClose }: { onClose?: () => void }) {
  return (
    <div className="px-5 py-5 bg-white border-b border-border flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-9 h-9 shrink-0 rounded-lg overflow-hidden">
          <Image src="/icon.png" alt="Trunqo" fill sizes="36px" />
        </div>
        <div className="font-display text-xl font-semibold tracking-tight leading-none text-foreground truncate">
          Trunqo
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="md:hidden p-1 text-muted hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status?: NavStatus }) {
  if (status !== "soon") return null;
  return (
    <span className="ml-auto shrink-0 text-xs font-medium text-accent bg-accent/[0.08] border border-accent/25 rounded-full px-2 py-px">
      Soon
    </span>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  status,
  hint,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon?: IconType;
  status?: NavStatus;
  hint?: string;
  active: boolean;
  onClick?: () => void;
}) {
  // "Soon" pages aren't built yet — show the item, but don't link to a 404.
  if (status === "soon") {
    return (
      <span
        aria-disabled="true"
        title={`${label} — coming soon`}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-base border-l-2 border-transparent text-foreground/45 cursor-not-allowed select-none"
      >
        {Icon && <Icon size={16} strokeWidth={1.75} className="shrink-0" />}
        <span className="flex-1 truncate">{label}</span>
        <StatusBadge status={status} />
      </span>
    );
  }
  return (
    <Link
      href={href}
      onClick={onClick}
      title={hint}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-base transition-colors border-l-2",
        active
          ? "bg-accent/10 border-accent text-accent font-medium"
          : "border-transparent text-foreground/70 hover:bg-primary/5 hover:text-foreground"
      )}
    >
      {Icon && <Icon size={16} strokeWidth={1.75} className="shrink-0" />}
      <span className="flex-1 truncate">{label}</span>
      <StatusBadge status={status} />
    </Link>
  );
}

/**
 * The signature element: "Companies" renders as a trunk with branches
 * rather than a generic accordion — one root line down the left, a short
 * twig connecting to each business. Ties directly to "the trunk your
 * businesses grow from" instead of decorating for its own sake.
 */
function CompanyBranchGroup({
  item,
  isOpen,
  onToggle,
  pathname,
  onNavigate,
}: {
  item: NavGroup;
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-base text-foreground/70 hover:bg-primary/5 hover:text-foreground transition-colors"
      >
        <Icon size={16} strokeWidth={1.75} className="shrink-0" />
        <span className="flex-1 text-left truncate">{item.label}</span>
        <span
          aria-label={`${item.children.length} ${item.label.toLowerCase()}`}
          className="min-w-5 h-5 px-1.5 shrink-0 rounded-full border border-accent/40 bg-surface flex items-center justify-center text-xs font-medium text-foreground/80 tabular-nums"
        >
          {item.children.length}
        </span>
        <ChevronDown
          size={13}
          className={clsx("transition-transform shrink-0 text-muted/60", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="relative ml-[19px] mt-0.5 pl-4 border-l border-border space-y-0.5">
          {item.children.length === 0 && item.empty && (
            <Link
              href={item.empty.href}
              onClick={onNavigate}
              className="block pl-2 pr-3 py-1.5 rounded-lg text-sm text-accent hover:bg-accent/10 transition-colors"
            >
              {item.empty.label}
            </Link>
          )}
          {item.children.map((child) => {
            const active = pathname === child.href;
            return (
              <div key={child.href} className="relative">
                <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-3 h-px bg-border" />
                {child.status === "soon" ? (
                  <span
                    aria-disabled="true"
                    title={`${child.label} — coming soon`}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg text-sm text-foreground/45 cursor-not-allowed select-none"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-border" />
                    <span className="flex-1 truncate">{child.label}</span>
                    <StatusBadge status={child.status} />
                  </span>
                ) : (
                  <Link
                    href={child.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg text-sm transition-colors",
                      active
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-foreground/60 hover:bg-primary/5 hover:text-foreground"
                    )}
                  >
                    <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", active ? "bg-accent" : "bg-border")} />
                    <span className="flex-1 truncate">{child.label}</span>
                    <StatusBadge status={child.status} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserFooter({ name, meta, onLogout }: { name: string | null; meta: string; onLogout: () => void }) {
  return (
    <div className="px-3 py-3 border-t border-border">
      <div className="flex items-center gap-2.5 mb-2 px-1">
        <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
          <UserCircle size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{name}</div>
          <div className="text-xs text-muted truncate">{meta}</div>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted hover:bg-accent/10 hover:text-accent transition-colors"
      >
        <LogOut size={14} strokeWidth={1.75} />
        Sign out
      </button>
    </div>
  );
}