"use client";

import { use, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, Landmark, Layers, Target, Users } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useCompanies, companyHref } from "@/lib/companies";
import { BrandLoader } from "@/components/BrandLoader";
import { AiSummaryCard } from "@/components/AiSummary";
import type { CompanyDash } from "../components/types";
import { buildAlerts, buildStats, buildSummary } from "../components/insights";
import { TabPanel, TabSwitcher, type TabItem } from "../components/ui";
import { OverviewTab } from "../components/OverviewTab";
import { DealsTab, FinanceTab } from "../components/MoneyTabs";
import { LeadsTab, TasksTab } from "../components/TeamTabs";

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

export default function CompanyDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { bySlug } = useCompanies();
  const company = bySlug[slug];
  const key = company?.key;

  const { data, isLoading } = useQuery<CompanyDash>({
    queryKey: ["company-dashboard", key],
    queryFn: () => fetcher(`/dashboard/company/${key}`),
    enabled: !!key,
  });

  const isBapx = data?.source === "BAPX";
  const [activeId, setActiveId] = useState("overview");
  const goTo = (id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const leads = data?.leads ?? [];
  const taskList = data?.taskList ?? [];

  // Reading order follows the money: results → what drives them → what's next → execution.
  const tabs: TabItem[] = data
    ? [
        { id: "overview", label: "Overview", icon: Layers },
        { id: "finance", label: "Finance", icon: Landmark },
        { id: "deals", label: "Deals", icon: Target, count: data.total },
        { id: "leads", label: "Leads", icon: Users, count: leads.length },
        { id: "tasks", label: "Tasks", icon: ClipboardList, count: data.tasks.overdue, flag: true },
      ]
    : [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Masthead: title and subtitle left, the period right (same shape as My KPIs). */}
      <motion.header initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl text-foreground md:text-4xl">{company?.name ?? slug}</h1>
            <p className="mt-1 max-w-2xl text-base text-muted">Money, deals, leads and tasks for this business, all in one place.</p>
          </div>
          {data && (
            <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
              <CalendarDays size={15} className="text-foreground/70" />
              {data.period ? `${data.period.label} · vs ${data.period.compareLabel}` : "All time"}
            </span>
          )}
        </div>

        {data && (
          <div className="rounded-xl border border-border bg-surface pr-5">
            <AiSummaryCard endpoint={`/dashboard/company/${data.company.key}/summary`} fallback={buildSummary(data)} variant="strip" />
          </div>
        )}
      </motion.header>

      {isLoading || !data ? (
        <BrandLoader fullScreen={false} label="Loading dashboard" />
      ) : (
        <>
          <TabSwitcher items={tabs} activeId={activeId} onSelect={setActiveId} />

          <AnimatePresence mode="wait">
            {activeId === "overview" && (
              <TabPanel id="overview">
                <OverviewTab data={data} isBapx={!!isBapx} stats={buildStats(data, !!isBapx)} alerts={buildAlerts(data, !!isBapx)} onGo={goTo} />
              </TabPanel>
            )}
            {activeId === "finance" && <TabPanel id="finance"><FinanceTab companyKey={data.company.key} /></TabPanel>}
            {activeId === "deals" && (
              <TabPanel id="deals"><DealsTab deals={data.topDeals} isBapx={!!isBapx} dealsHref={company ? companyHref(company) : undefined} /></TabPanel>
            )}
            {activeId === "leads" && <TabPanel id="leads"><LeadsTab leads={leads} /></TabPanel>}
            {activeId === "tasks" && <TabPanel id="tasks"><TasksTab tasks={data.tasks} list={taskList} /></TabPanel>}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
