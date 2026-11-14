"use client";

import { LogoMark } from "@/components/LogoMark";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Users,
  Building2,
  DollarSign,
  BarChart3,
  ListChecks,
  Database,
  ChevronDown,
  LogOut,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  UsersRound,
  HelpCircle,
  Target,
  ShieldCheck,
  AlertTriangle,
  Contact,
  Briefcase,
  FolderKanban,
  Handshake,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { useAuth } from "./AuthProvider";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./notifications/Notifications";
import { companyHref, useCompanies } from "@/lib/companies";
import { accessLevel, ACCESS_LEVEL_LABEL, isExternal } from "@/lib/auth";

/**
 * One nav per role (Group Owner / Business CEO / Staff). Stored roles fold into these via
 * accessLevel(): ADMIN and CEO are Group Owners; BDO and the retired titles are Staff.
 *
 * Rule for this file: if a page isn't built, it isn't in the sidebar. No "Soon" badges,
 * no greyed-out items. Add the link on the day the page ships.
 *
 * Copy rules:
 *  - Sentence case everywhere ("Group finances", not "Group Financials").
 *  - Labels name the place ("Clients") or start with a verb for an action ("Assign tasks").
 *  - Section titles say what the items are for, in plain words.
 *  - Paired pages are named by scope, so the difference is obvious at a glance:
 *    "Company KPIs" (one per business) and "Individual KPIs" (one per person).
 *  - `hint` is a one-line explanation shown on hover. Only add one when the label alone isn't enough.
 *
 * Visual rules:
 *  - Items: 14px, weight 500 at rest, 600 when active. Section titles: 11px, bold, tracked caps.
 *  - Groups are separated by a hairline, so the rail reads as clear blocks.
 *  - Active = neutral wash, dark label, and a 3px terracotta marker on the left edge. Orange is reserved for "needs attention", so the nav stays calm and the page content stays the loudest thing.
 *  - Hover = lighter grey wash behind a fixed pill, icon turns terracotta, and only the icon + label nudge 2px right.
 *    Hover has no marker and a lighter wash than active, so it can't pass for the current page.
 *  - A group that contains the current page reads as active too, even when collapsed.
 *
 * Theme: the light/dark switch (ThemeToggle) sits at the end of the name row in the footer; on the
 * rail it drops to its own row above "Sign out". The colours come from globals.css.
 */

type IconType = typeof LayoutDashboard;

type NavItem = { href: string; label: string; icon: IconType; hint?: string };
type NavChild = { href: string; label: string };
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

type SidebarProps = {
  mobileOpen?: boolean; onClose?: () => void;
  /** Desktop only: the sidebar is folded down to a slim rail. */
  hidden?: boolean; onToggleHidden?: () => void;
  /** Opens the notifications panel (AppShell owns it). */
  onOpenNotifications?: () => void;
};

// A link is active on its own page and on pages nested under it (/tasks/123 keeps "Assign tasks" lit).
// Home ("/") only matches exactly, or it would light up everywhere.
function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export default function Sidebar({ mobileOpen = false, onClose, hidden = false, onToggleHidden, onOpenNotifications }: SidebarProps) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const { companies } = useCompanies();
  const [open, setOpen] = useState<string[]>(["Companies"]);

  if (AUTH_PATHS.includes(pathname)) return null;
  if (loading) return <aside className={clsx("hidden md:flex min-h-screen bg-surface shrink-0", hidden ? "w-[68px]" : "w-64")} />;
  if (!user) return null;

  const toggle = (label: string) =>
    setOpen((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const level = accessLevel(user.role);
  // Compliance shows only where the module is on: any company for the Group Owner, else their own.
  const complianceOn = level === "GROUP_OWNER"
    ? companies.some((c) => c.modules?.compliance)
    : !!companies.find((c) => c.key === user.bdoCompany)?.modules?.compliance;
  const complianceItem: NavItem[] = complianceOn
    ? [{ href: "/compliance", label: "Compliance", icon: ShieldCheck, hint: "Deadlines you need to meet, and who's handling them" }]
    : [];

  // ---- Role-scoped nav content -------------------------------------------------

  const groupOwnerNav: NavSection[] = [
    {
      items: [
        { href: "/", label: "Home", icon: Activity, hint: "Alerts and activity across all your companies" },
        {
          label: "Companies",
          icon: Building2,
          variant: "branch",
          children: companies.map((c) => ({ href: `/dashboard/${c.slug}`, label: c.name })),
          empty: { label: "Add your first company", href: "/admin/companies" },
        },
      ],
    },
    {
      title: "Sales & contacts",
      items: [
        { href: "/leads", label: "All leads", icon: Users, hint: "Every lead across your companies" },
        { href: "/sme", label: "Clients", icon: Briefcase },
        { href: "/contacts", label: "Contacts", icon: Contact },
      ],
    },
    {
      title: "Money",
      items: [
        { href: "/finance", label: "Company finance", icon: Wallet, hint: "One company's money and weekly report" },
        { href: "/consolidated", label: "Group finances", icon: Database, hint: "All your companies' numbers, combined" },
      ],
    },
    {
      title: "Performance",
      items: [
        { href: "/kpi-framework", label: "Company KPIs", icon: BarChart3, hint: "Set targets and track how each company is doing" },
        { href: "/my-kpis", label: "Individual KPIs", icon: Target, hint: "See each person's targets and how they're doing" },
      ],
    },
    {
      title: "Risk & compliance",
      items: [
        ...complianceItem,
        { href: "/risks", label: "Risks", icon: AlertTriangle, hint: "What could go wrong, who owns it, and what's being done" },
      ],
    },
    {
      title: "Manage",
      items: [
        { href: "/tasks", label: "Assign tasks", icon: ListChecks, hint: "Give tasks to one or more people" },
        { href: "/projects", label: "Projects", icon: FolderKanban, hint: "Project teams, their tasks and KPIs" },
        { href: "/admin/team", label: "Team & access", icon: UsersRound, hint: "Invite people and choose what each person can see" },
        { href: "/admin/companies", label: "Add a company", icon: Building2 },
      ],
    },
    {
      items: [{ href: "/help", label: "Help", icon: HelpCircle, hint: "Guides and definitions" }],
    },
  ];

  // A Business CEO's dashboard is their own company's, not the group view.
  const ownCompany = companies.find((c) => c.key === user.bdoCompany);
  const businessCeoNav: NavSection[] = [
    {
      items: [
        { href: ownCompany ? `/dashboard/${ownCompany.slug}` : "/", label: "Dashboard", icon: LayoutDashboard, hint: "How your company is doing" },
      ],
    },
    {
      title: "Work",
      items: [
        { href: "/tasks", label: "Assign tasks", icon: ListChecks, hint: "Give tasks to one or more people" },
        { href: "/projects", label: "Projects", icon: FolderKanban, hint: "Project teams, their tasks and KPIs" },
        { href: "/team", label: "Team", icon: UsersRound },
      ],
    },
    {
      title: "Sales & contacts",
      items: [
        { href: "/leads", label: "Leads", icon: Users },
        { href: "/sme", label: "Clients", icon: Briefcase },
        ...(ownCompany ? [{ href: companyHref(ownCompany), label: "Deals", icon: Handshake, hint: "Won work: value, money received and balance" }] : []),
        { href: "/contacts", label: "Contacts", icon: Contact },
      ],
    },
    {
      title: "Money",
      items: [
        { href: "/finance", label: "Finance", icon: Wallet, hint: "Expected and actual money, and the weekly report" },
        { href: "/grant-loans", label: "Grants & loans", icon: DollarSign },
      ],
    },
    {
      title: "Performance",
      items: [
        { href: "/kpi-framework", label: "Company KPIs", icon: BarChart3, hint: "Set targets and track how your company is doing" },
        { href: "/my-kpis", label: "Individual KPIs", icon: Target, hint: "See each person's targets and how they're doing" },
      ],
    },
    {
      title: "Risk & compliance",
      items: [
        ...complianceItem,
        { href: "/risks", label: "Risks", icon: AlertTriangle, hint: "What could go wrong, who owns it, and what's being done" },
      ],
    },
    {
      items: [{ href: "/help", label: "Help", icon: HelpCircle, hint: "Guides and definitions" }],
    },
  ];

  const staffNav: NavSection[] = [
    {
      items: [
        { href: "/overview", label: "Home", icon: LayoutDashboard, hint: "What needs your attention today" },
        { href: "/tasks", label: "My tasks", icon: ListChecks },
        { href: "/projects", label: "My projects", icon: FolderKanban, hint: "Projects you're on" },
        { href: "/leads", label: "My leads", icon: Users },
        { href: "/sme", label: "Clients", icon: Briefcase },
        ...(ownCompany ? [{ href: companyHref(ownCompany), label: "My deals", icon: Handshake }] : []),
        { href: "/finance", label: "My expenses", icon: Wallet, hint: "Record what you spend" },
        { href: "/contacts", label: "Contacts", icon: Contact },
        ...complianceItem,
        { href: "/risks", label: "My risk actions", icon: AlertTriangle, hint: "Risk actions assigned to you" },
        { href: "/my-kpis", label: "My KPIs", icon: Target, hint: "Your targets and how you're doing" },
        { href: "/help", label: "Help", icon: HelpCircle, hint: "Guides and definitions" },
      ],
    },
  ];

  // Outside collaborators: only their projects and the tasks in them.
  const externalNav: NavSection[] = [
    {
      items: [
        { href: "/projects", label: "My projects", icon: FolderKanban },
        { href: "/tasks", label: "My tasks", icon: ListChecks },
        { href: "/help", label: "Help", icon: HelpCircle, hint: "Guides and definitions" },
      ],
    },
  ];

  const external = isExternal(user);
  const nav = external ? externalNav : level === "GROUP_OWNER" ? groupOwnerNav : level === "BUSINESS_CEO" ? businessCeoNav : staffNav;

  const portalLabel = external ? "Collaborator" : ACCESS_LEVEL_LABEL[level];

  // Folded on desktop, the sidebar narrows to an icon rail; the phone drawer always shows in full.
  const rail = hidden;
  const asideClass = clsx(
    // The wash comes from --sidebar-bg in globals.css, so it follows the theme
    "w-64 bg-[image:var(--sidebar-bg)] text-foreground flex flex-col shrink-0 z-40 border-r border-border h-screen overflow-hidden",
    "fixed inset-y-0 left-0 transition-[width,transform] duration-300 ease-in-out motion-reduce:transition-none",
    "md:sticky md:top-0 md:translate-x-0",
    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
    rail ? "md:w-[68px]" : "md:w-64"
  );
  // Expanding from the rail opens the group too, so a click on Companies lands on its list.
  const openGroup = (label: string) => {
    if (rail) { onToggleHidden?.(); setOpen((o) => (o.includes(label) ? o : [...o, label])); }
    else toggle(label);
  };

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
        <Brand onClose={onClose} onToggle={onToggleHidden} rail={rail} />

        <nav
          aria-label="Main"
          className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden select-none pt-4 pb-6 px-3"
          style={{
            // Soft fade at the bottom edge so a clipped item reads as "scroll for more", not a cut-off bug.
            maskImage: "linear-gradient(to bottom, #000 calc(100% - 20px), transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, #000 calc(100% - 20px), transparent)",
          }}
        >
          {nav.map((section, i) => (
            <div key={section.title ?? `s${i}`} className={clsx(i > 0 && "mt-4 pt-4 border-t border-border")}>
              {section.title && (
                <div className={clsx("px-3 mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/55 whitespace-nowrap", fade(rail))}>
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
                      onToggle={() => openGroup(item.label)}
                      pathname={pathname}
                      onNavigate={onClose}
                      rail={rail}
                    />
                  ) : (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      hint={item.hint}
                      active={isActive(pathname, item.href)}
                      onClick={onClose}
                      rail={rail}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </nav>

        {/* The person's name from their staff profile; a login without one (e.g. a Group Owner) shows the email. */}
        <UserFooter name={user.bdoName?.trim() || user.email} email={user.email} meta={portalLabel} onLogout={logout} rail={rail}
          onOpenNotifications={onOpenNotifications ? () => { onClose?.(); onOpenNotifications(); } : undefined}
        />
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

// Labels fade out on the desktop rail while the icons stay where they are.
function fade(rail: boolean) {
  return clsx("transition-opacity duration-200 motion-reduce:transition-none", rail && "md:opacity-0 md:pointer-events-none");
}

function Brand({ onClose, onToggle, rail }: { onClose?: () => void; onToggle?: () => void; rail: boolean }) {
  return (
    <div className="px-4 py-5 border-b border-border/70 flex items-center justify-between relative">
      <div className="flex items-center gap-3 min-w-0">
        {/* On the rail the logo is the way back out. */}
        <button
          type="button" onClick={rail ? onToggle : undefined} tabIndex={rail ? 0 : -1}
          aria-label={rail ? "Show sidebar" : undefined} title={rail ? "Show sidebar" : undefined}
          className={clsx("group/logo relative w-9 h-9 shrink-0 rounded-lg overflow-hidden", rail ? "md:cursor-pointer" : "cursor-default", focusRing)}
        >
          <LogoMark sizes="36px" />
          {rail && (
            <span className="absolute inset-0 hidden md:flex items-center justify-center bg-surface/90 text-foreground opacity-0 group-hover/logo:opacity-100 transition-opacity">
              <PanelLeftOpen size={18} />
            </span>
          )}
        </button>
        <div className={clsx("font-display text-[22px] font-medium tracking-tight leading-none text-foreground whitespace-nowrap", fade(rail))}>
          Trunqo
        </div>
      </div>
      {onToggle && (
        <button
          onClick={onToggle}
          aria-label="Hide sidebar" title="Hide sidebar"
          className={clsx("hidden md:inline-flex p-1.5 rounded-md text-muted hover:text-foreground hover:bg-foreground/5 transition-colors", fade(rail), focusRing)}
        >
          <PanelLeftClose size={18} />
        </button>
      )}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close menu"
          className={clsx("md:hidden p-1.5 rounded-md text-muted hover:text-foreground transition-colors", focusRing)}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

/** The one small orange cue on the rail: where you are. */
function ActiveMarker() {
  return <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent" />;
}

function NavLink({
  href,
  label,
  icon: Icon,
  hint,
  active,
  onClick,
  rail,
}: {
  href: string;
  label: string;
  icon?: IconType;
  hint?: string;
  active: boolean;
  onClick?: () => void;
  rail: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={rail ? label : hint}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 md:py-2 text-[14px] leading-5 transition-colors duration-150",
        focusRing,
        active
          ? "bg-foreground/[0.09] text-foreground font-semibold"
          : "font-medium text-foreground/85 hover:bg-foreground/[0.05] hover:text-foreground"
      )}
    >
      {active && <ActiveMarker />}
      {Icon && (
        <Icon
          size={17}
          strokeWidth={1.75}
          className={clsx("shrink-0 transition-all duration-150", active ? "text-foreground" : "text-foreground/60 group-hover:text-accent group-hover:translate-x-0.5")}
        />
      )}
      <span className={clsx("flex-1 truncate whitespace-nowrap transition-[transform,opacity] duration-200", !active && "group-hover:translate-x-0.5", fade(rail))}>{label}</span>
    </Link>
  );
}

/**
 * The signature element: "Companies" renders as a trunk with branches
 * rather than a generic accordion — one root line down the left, a short
 * twig connecting to each business. Ties directly to "the trunk your
 * businesses grow from" instead of decorating for its own sake.
 *
 * When one of its businesses is the current page, the group itself reads as active
 * (even collapsed), so the path to where you are is always visible.
 */
function CompanyBranchGroup({
  item,
  isOpen,
  onToggle,
  pathname,
  onNavigate,
  rail,
}: {
  item: NavGroup;
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
  onNavigate?: () => void;
  rail: boolean;
}) {
  const Icon = item.icon;
  const hasActive = item.children.some((c) => isActive(pathname, c.href));
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        title={rail ? item.label : undefined}
        className={clsx(
          "group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 md:py-2 text-[14px] leading-5 transition-colors duration-150",
          focusRing,
          hasActive
            ? "text-foreground font-semibold hover:bg-foreground/[0.05]"
            : "font-medium text-foreground/85 hover:bg-foreground/[0.05] hover:text-foreground"
        )}
      >
        <Icon
          size={17}
          strokeWidth={1.75}
          className={clsx("shrink-0 transition-all duration-150", hasActive ? "text-foreground" : "text-foreground/60 group-hover:text-accent group-hover:translate-x-0.5")}
        />
        <span className={clsx("flex-1 text-left truncate whitespace-nowrap transition-[transform,opacity] duration-200", !hasActive && "group-hover:translate-x-0.5", fade(rail))}>{item.label}</span>
        <span
          aria-label={`${item.children.length} ${item.label.toLowerCase()}`}
          className={clsx("min-w-5 h-5 px-1.5 shrink-0 rounded-full bg-foreground/[0.06] flex items-center justify-center text-[11px] font-medium text-foreground/70 tabular-nums", fade(rail))}
        >
          {item.children.length}
        </span>
        <ChevronDown
          size={14}
          className={clsx("transition-transform shrink-0 text-muted/60", isOpen && "rotate-180", fade(rail))}
        />
      </button>

      {isOpen && (
        <div className={clsx("relative ml-[20px] mt-0.5 pl-4 border-l border-border space-y-0.5", rail && "md:hidden")}>
          {item.children.length === 0 && item.empty && (
            <Link
              href={item.empty.href}
              onClick={onNavigate}
              className={clsx("block pl-2 pr-3 py-1.5 rounded-lg text-[13px] font-medium text-accent hover:bg-accent/10 transition-colors", focusRing)}
            >
              {item.empty.label}
            </Link>
          )}
          {item.children.map((child) => {
            const active = isActive(pathname, child.href);
            return (
              <div key={child.href} className="relative">
                <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-3 h-px bg-border" />
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "group flex items-center gap-2.5 pl-2.5 pr-3 py-2 md:py-1.5 rounded-lg text-[13px] leading-5 transition-colors duration-150",
                    focusRing,
                    active
                      ? "bg-foreground/[0.09] text-foreground font-semibold"
                      : "font-medium text-foreground/80 hover:bg-foreground/[0.05] hover:text-foreground"
                  )}
                >
                  <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-150", active ? "bg-accent" : "bg-foreground/30 group-hover:bg-accent group-hover:translate-x-0.5")} />
                  <span className={clsx("flex-1 truncate transition-transform duration-150", !active && "group-hover:translate-x-0.5")}>{child.label}</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserFooter({ name, email, meta, onLogout, rail, onOpenNotifications }: { name: string | null; email: string; meta: string; onLogout: () => void; rail: boolean; onOpenNotifications?: () => void }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="px-3 py-3 border-t border-border">
      <div className="flex items-center gap-3 mb-1 px-1.5 py-2" title={rail ? `${name ?? ""} · ${meta}` : email}>
        <div className="w-8 h-8 rounded-full bg-foreground/10 text-foreground/70 flex items-center justify-center shrink-0 text-[13px] font-semibold">
          {initial}
        </div>
        <div className={clsx("min-w-0 flex-1 whitespace-nowrap", fade(rail))}>
          <div className="text-[13px] font-medium text-foreground truncate">{name}</div>
          <div className="text-xs text-muted truncate">{meta}</div>
        </div>
        <ThemeToggle className={clsx("-mr-1 shrink-0", rail && "md:hidden")} />
      </div>
      {rail && <ThemeToggle className="hidden md:flex ml-1 mb-1" />}
      {onOpenNotifications && <NotificationBell variant="row" rail={rail} onOpen={onOpenNotifications} />}
      <button
        onClick={onLogout}
        title={rail ? "Sign out" : undefined}
        className={clsx(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-muted hover:bg-foreground/[0.05] hover:text-foreground transition-colors",
          focusRing
        )}
      >
        <LogOut size={15} strokeWidth={1.75} className="shrink-0" />
        <span className={clsx("whitespace-nowrap", fade(rail))}>Sign out</span>
      </button>
    </div>
  );
}
