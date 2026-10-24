"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, Building2, ClipboardCheck, Layers, Target, User } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isGroupOwner, isBusinessCeo } from "@/lib/auth";
import { useCompanies } from "@/lib/companies";
import { BrandLoader } from "@/components/BrandLoader";
import { Masthead } from "@/components/home/Masthead";
import { QuickNav, type NavItem } from "@/components/home/QuickNav";
import { useHomeCharts } from "@/components/home/charts/useHomeCharts";
import { ApprovalsTab } from "@/components/home/tabs/ApprovalsTab";
import { AttentionTab } from "@/components/home/tabs/AttentionTab";
import { CompaniesTab } from "@/components/home/tabs/CompaniesTab";
import { DealsTab } from "@/components/home/tabs/DealsTab";
import { OverviewTab } from "@/components/home/tabs/OverviewTab";
import { TeamTab } from "@/components/home/tabs/TeamTab";
import { PREVIEW_TREND, URGENCY_RANK, URGENCY_URGENT, groupStale, plural } from "@/components/home/format";
import type { AlertsResponse, AttentionModel, Exec, PendingApproval } from "@/components/home/types";

/**
 * Home routes by role: the group dashboard is the Group Owner's view only (the API refuses it
 * to everyone else). Business CEOs land on their company's dashboard, staff on their overview.
 *
 * The page itself only fetches and wires. Each tab lives in components/home/tabs, each chart in
 * components/home/charts.
 */
export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const { byKey } = useCompanies();
  const isOwner = isGroupOwner(user);
  const ownSlug = user?.bdoCompany ? byKey[user.bdoCompany]?.slug : undefined;

  useEffect(() => {
    if (!user || isOwner) return;
    if (isBusinessCeo(user) && ownSlug) router.replace(`/dashboard/${ownSlug}`);
    else if (!isBusinessCeo(user) || !user.bdoCompany) router.replace(user.bdoId ? "/overview" : "/tasks");
  }, [user, isOwner, ownSlug, router]);

  if (!isOwner) return <BrandLoader label="Loading" />;
  return <GroupDashboard />;
}

function GroupDashboard() {
  const { byKey } = useCompanies();
  const alerts = useQuery<AlertsResponse>({ queryKey: ["alerts"], queryFn: () => fetcher("/alerts") });
  const exec = useQuery<Exec>({ queryKey: ["executive-dashboard"], queryFn: () => fetcher("/dashboard/executive") });
  // Work staff finished that waits for the Group Owner's approval before it counts.
  const approvalsQuery = useQuery<PendingApproval[]>({ queryKey: ["tasks", "approvals"], queryFn: () => fetcher("/tasks/approvals") });
  const approvals = approvalsQuery.data ?? [];
  const charts = useHomeCharts();
  const [activeId, setActiveId] = useState("overview");

  // The approvals alert links here with ?view=approvals.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "approvals") setActiveId("approvals");
  }, []);

  const data = exec.data;

  // One model for everything that reads alerts, so the headline, the tab badge and the
  // Attention tab can never disagree about the totals.
  const attention = useMemo<AttentionModel>(() => {
    const deadlines = [...(alerts.data?.deadlines ?? [])].sort(
      (a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || a.daysUntil - b.daysUntil,
    );
    const stale = alerts.data?.stale ?? [];
    const flags = alerts.data?.flags ?? [];
    return {
      deadlines,
      stale,
      staleGroups: groupStale(stale),
      flags,
      urgentCount: deadlines.filter((d) => URGENCY_URGENT.includes(d.urgency)).length,
      total: deadlines.length + stale.length + flags.length,
      breakdown: [
        deadlines.length > 0 ? plural(deadlines.length, "deadline") : null,
        stale.length > 0 ? `${plural(stale.length, "deal")} gone quiet` : null,
        flags.length > 0 ? plural(flags.length, "financial flag") : null,
      ].filter(Boolean).join(" · "),
    };
  }, [alerts.data]);

  const hasAttention = attention.deadlines.length > 0 || attention.staleGroups.length > 0 || attention.flags.length > 0;

  const navItems = useMemo<NavItem[]>(
    () =>
      [
        { id: "overview", label: "Overview", icon: Layers },
        { id: "approvals", label: "Approvals", icon: ClipboardCheck, count: approvals.length },
        { id: "team-performance", label: "Team", icon: User },
        hasAttention ? { id: "attention", label: "Attention", icon: AlertTriangle, count: attention.total } : null,
        { id: "company-health", label: "Companies", icon: Building2 },
        { id: "deal-ledgers", label: "Deals", icon: Target },
      ].filter((x): x is NavItem => x !== null),
    [hasAttention, attention.total, approvals.length],
  );

  if (exec.isLoading) return <BrandLoader fullScreen={false} label="Loading dashboard" />;
  if (exec.isError || !data) {
    return (
      <div className="mx-auto max-w-md p-3 text-center">
        <p className="text-xl font-semibold text-foreground">Couldn&apos;t load the dashboard</p>
        <p className="mt-2 text-sm text-muted">Make sure the server is reachable, then refresh.</p>
      </div>
    );
  }

  const previewTrend =
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("previewTrend");
  const activeTrend = data.totals.activeTrend ?? (previewTrend ? PREVIEW_TREND : undefined);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl space-y-7 px-5 py-10 md:px-8 md:py-12">
        <Masthead
          companyCount={data.companies.length}
          urgentCount={attention.urgentCount}
          deadlineCount={attention.deadlines.length}
          staleCount={attention.stale.length}
        />

        <QuickNav items={navItems} activeId={activeId} onSelect={setActiveId} />

        <AnimatePresence mode="wait">
          {activeId === "overview" && (
            <OverviewTab key="overview" data={data} attention={attention} byKey={byKey} activeTrend={activeTrend} charts={charts}
              approvals={approvals} onOpenApprovals={() => setActiveId("approvals")} />
          )}
          {activeId === "approvals" && <ApprovalsTab key="approvals" approvals={approvals} byKey={byKey} />}
          {activeId === "team-performance" && <TeamTab key="team-performance" health={data.kpiHealth} charts={charts} />}
          {activeId === "attention" && hasAttention && <AttentionTab key="attention" attention={attention} byKey={byKey} />}
          {activeId === "company-health" && <CompaniesTab key="company-health" companies={data.companies} />}
          {activeId === "deal-ledgers" && <DealsTab key="deal-ledgers" data={data} stale={attention.stale} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
