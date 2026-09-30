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
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { useAuth } from "./AuthProvider";
import { useCompanies, companyHref } from "@/lib/companies";
import { AskTranqoTrigger, TranqoAssistant, type Scope } from "@/components/TranqoAssistant";

/**
 * ROLE STRINGS — confirmed with backend: ADMIN, CEO, BUSINESS_CEO, BDO.
 * Backend confirmed ADMIN and CEO both land on the Group Owner dashboard,
 * so both map to the same nav below.
 *
 * STILL UNCONFIRMED: what BDO should see. It isn't one of the three roles
 * in the spec doc (Group Owner / Business CEO / Staff) at all, so for now
 * it's routed to the same nav as Staff (own tasks/leads/KPIs) as the
 * closest safe default — flag me the real answer and I'll give it its
 * own nav if it needs one.
 */
const GROUP_OWNER_ROLES = ["ADMIN", "CEO"];
const ROLE = {
  BUSINESS_CEO: "BUSINESS_CEO",
  // No STAFF role exists on the backend (see User.ts USER_ROLES), so comparing
  // against it is a type error. Commented out until the real role is confirmed.
  // STAFF: "STAFF",
  BDO: "BDO",
} as const;

/**
 * status: "live"  -> route + API already wired, safe to ship
 *         "soon"  -> nav slot exists per spec but backend/page isn't built yet
 *
 * I set these based on what was already in your file (marked live) vs.
 * what I added to match the spec doc (marked soon). Flip any of these
 * the moment the route is real — that's the whole point of the flag.
 */
type NavStatus = "live" | "soon";

type IconType = typeof LayoutDashboard;

type NavItem = { href: string; label: string; icon: IconType; status?: NavStatus };
type NavChild = { href: string; label: string; status?: NavStatus };
type NavGroup = {
  label: string;
  icon: IconType;
  variant?: "branch"; // "branch" renders the trunk/twig connector style
  children: NavChild[];
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
  const [askOpen, setAskOpen] = useState(false);

  if (AUTH_PATHS.includes(pathname)) return null;
  if (loading) return <aside className="hidden md:flex w-64 min-h-screen bg-surface shrink-0" />;
  if (!user) return null;

  const toggle = (label: string) =>
    setOpen((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const isGroupOwner = GROUP_OWNER_ROLES.includes(user.role);
  const isBusinessCeo = user.role === ROLE.BUSINESS_CEO;
  const isStaff = /* user.role === ROLE.STAFF || */ user.role === ROLE.BDO;

  // ---- Ask Tranqo scope ---------------------------------------------------
  // Group Owner: group-wide by default, auto-scoped to a company the moment
  // they're already sitting on that company's dashboard — no need to say
  // "for Finance Factory" out loud when the page already says it.
  // Business CEO / Staff: always their own company. Their `companies` list
  // is already backend-scoped to just that one business (FR-1 data
  // isolation), so companies[0] is safe to treat as "mine," not a guess.
  const activeCompany = companies.find((c) => pathname === `/dashboard/${c.slug}`);
  const scope: Scope = isGroupOwner
    ? activeCompany
      ? { level: "company", companyKey: activeCompany.key, companyName: activeCompany.name }
      : { level: "group" }
    : companies[0]
    ? { level: "company", companyKey: companies[0].key, companyName: companies[0].name }
    : { level: "group" };

  const scopeHint = scope.level === "company" ? `Scoped to ${scope.companyName}` : "Scoped to the whole group";

  // ---- Role-scoped nav content -------------------------------------------------

  const groupOwnerNav: NavSection[] = [
    {
      items: [{ href: "/", label: "Pulse", icon: Activity, status: "live" }],
    },
    {
      title: "The Grove",
      items: [
        {
          label: "Companies",
          icon: Building2,
          variant: "branch",
          children: companies.map((c) => ({ href: `/dashboard/${c.slug}`, label: c.name, status: "live" })),
        },
        { href: "/leads", label: "All Leads", icon: Users, status: "live" },
        { href: "/investments", label: "Investments", icon: DollarSign, status: "soon" },
        { href: "/consolidated", label: "Group Financials", icon: Database, status: "live" },
        { href: "/kpi-framework", label: "KPI Framework", icon: BarChart3, status: "live" },
      ],
    },
    {
      title: "Upkeep",
      items: [
        { href: "/tasks", label: "Assign Tasks", icon: ListChecks, status: "live" },
        { href: "/admin/companies", label: "Add a Company", icon: Building2, status: "live" },
        { href: "/admin/team", label: "Team & Access", icon: UsersRound, status: "live" },
      ],
    },
    {
      items: [{ href: "/help", label: "Help & Glossary", icon: HelpCircle, status: "live" }],
    },
  ];

  const businessCeoNav: NavSection[] = [
    {
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard, status: "live" },
        { href: "/alerts", label: "Alerts", icon: Bell, status: "soon" },
      ],
    },
    {
      title: "Money",
      items: [
        { href: "/finance", label: "Finance", icon: DollarSign, status: "soon" },
        { href: "/grant-loans", label: "Grants & Loans", icon: DollarSign, status: "live" },
      ],
    },
    {
      title: "Work",
      items: [
        { href: "/tasks", label: "Batch-Assign Tasks", icon: ListChecks, status: "live" },
        { href: "/projects", label: "Projects", icon: FolderKanban, status: "live" },
      ],
    },
    {
      title: "People",
      items: [
        { href: "/leads", label: "Leads", icon: Users, status: "live" },
        { href: "/team", label: "Team", icon: UsersRound, status: "live" },
        { href: "/kpi-framework", label: "KPI Framework", icon: BarChart3, status: "live" },
        { href: "/partnerships", label: "Partnerships", icon: Handshake, status: "live" },
      ],
    },
    {
      items: [{ href: "/help", label: "Help & Glossary", icon: HelpCircle, status: "live" }],
    },
  ];

  const staffNav: NavSection[] = [
    {
      items: [
        { href: "/", label: "My Tasks", icon: ListChecks, status: "live" },
        { href: "/leads", label: "My Leads", icon: Users, status: "live" },
        { href: "/kpi-framework", label: "My KPIs", icon: BarChart3, status: "live" },
        { href: "/help", label: "Help & Glossary", icon: HelpCircle, status: "live" },
      ],
    },
  ];

  // Lightweight fallback in case a role isn't mapped yet — no BDO baggage.
  const fallbackNav: NavSection[] = [
    {
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard, status: "live" },
        { href: "/help", label: "Help & Glossary", icon: HelpCircle, status: "live" },
      ],
    },
  ];

  const nav = isGroupOwner ? groupOwnerNav : isBusinessCeo ? businessCeoNav : isStaff ? staffNav : fallbackNav;

  const portalLabel = isGroupOwner ? "Group Owner" : isBusinessCeo ? "Business CEO" : isStaff ? "Staff" : "Portal";

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
        <Brand portalLabel={portalLabel} onClose={onClose} />

        {/* Pinned above the scrollable nav on purpose — this is a flagship
            entry point, not just another row that can scroll out of view. */}
        <div className="px-2.5 pt-3">
          <AskTranqoTrigger onClick={() => setAskOpen(true)} scopeHint={scopeHint} />
        </div>

        <nav className="no-scrollbar flex-1 overflow-y-auto py-3 px-2.5">
          {nav.map((section, i) => (
            <div key={section.title ?? `s${i}`} className={clsx(i > 0 && "mt-4")}>
              {section.title && (
                <div className="px-3 mb-1.5 text-[10px] font-semibold text-foreground/35 uppercase tracking-widest">
                  {section.title}
                </div>
              )}
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

      <TranqoAssistant scope={scope} open={askOpen} onClose={() => setAskOpen(false)} />

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

function Brand({ portalLabel, onClose }: { portalLabel: string; onClose?: () => void }) {
  return (
    <div className="px-5 py-5 bg-white border-b border-border flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-9 h-9 shrink-0 rounded-lg overflow-hidden">
          <Image src="/icon.png" alt="Trunqo" fill sizes="36px"  />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
            <span className="text-[10px] font-semibold text-muted uppercase tracking-widest leading-none truncate">
              {portalLabel}
            </span>
          </div>
          <div className="font-serif text-xl leading-none text-foreground truncate">Trunqo</div>
        </div>
      </div>
      {onClose && (
        <button onClick={onClose} className="md:hidden p-1 text-muted hover:text-foreground transition-colors">
          <X size={18} />
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status?: NavStatus }) {
  if (status !== "soon") return null;
  return (
    <span className="ml-auto shrink-0 text-[9px] font-semibold uppercase tracking-wider text-accent bg-accent/[0.08] border border-accent/25 rounded-full px-1.5 py-[1px]">
      Soon
    </span>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  status,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon?: IconType;
  status?: NavStatus;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors border-l-2",
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
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground/70 hover:bg-primary/5 hover:text-foreground transition-colors"
      >
        <Icon size={16} strokeWidth={1.75} className="shrink-0" />
        <span className="flex-1 text-left truncate">{item.label}</span>
        <span className="w-5 h-5 shrink-0 rounded-full border border-accent/40 bg-surface flex items-center justify-center text-[10px] font-semibold text-foreground/80 tabular-nums">
          {item.children.length}
        </span>
        <ChevronDown
          size={13}
          className={clsx("transition-transform shrink-0 text-muted/60", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="relative ml-[19px] mt-0.5 pl-4 border-l border-border space-y-0.5">
          {item.children.map((child) => {
            const active = pathname === child.href;
            return (
              <div key={child.href} className="relative">
                <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-3 h-px bg-border" />
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  className={clsx(
                    "flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg text-[13px] transition-colors",
                    active
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-foreground/60 hover:bg-primary/5 hover:text-foreground"
                  )}
                >
                  <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", active ? "bg-accent" : "bg-border")} />
                  <span className="flex-1 truncate">{child.label}</span>
                  <StatusBadge status={child.status} />
                </Link>
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
        <div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
          <UserCircle size={16} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-foreground truncate">{name}</div>
          <div className="text-[11px] text-muted truncate">{meta}</div>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted hover:bg-accent/10 hover:text-accent transition-colors"
      >
        <LogOut size={13} strokeWidth={1.75} />
        Sign out
      </button>
    </div>
  );
}