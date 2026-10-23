"use client";

import { motion } from "framer-motion";
import { Building2, Calendar } from "lucide-react";
import { AiSummaryCard } from "@/components/AiSummary";
import { plural, todayStamp } from "./format";

/** The page's opening statement: today's date, the one number that matters most, and the AI summary. */
export function Masthead({
  companyCount,
  urgentCount,
  deadlineCount,
  staleCount,
}: {
  companyCount: number;
  /** Overdue, due today or due tomorrow. */
  urgentCount: number;
  /** All upcoming deadlines, including ones not yet urgent. */
  deadlineCount: number;
  staleCount: number;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between gap-6 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
        <span className="flex items-center gap-2.5 tabular-nums">
          <Calendar size={15} strokeWidth={1.75} />
          {todayStamp()}
        </span>
        <span className="flex items-center gap-2.5">
          <Building2 size={15} strokeWidth={1.75} />
          {companyCount} {companyCount === 1 ? "company" : "companies"}
        </span>
      </div>

      <h1 className="text-[2.25rem] font-bold leading-[1.1] tracking-tight text-foreground md:text-[3.25rem]">
        {urgentCount > 0 ? (
          <>
            <span className="text-accent">{urgentCount}</span> deadline{urgentCount === 1 ? "" : "s"} overdue or due today
          </>
        ) : deadlineCount > 0 ? (
          <>
            <span className="text-accent">{deadlineCount}</span> deadline{deadlineCount === 1 ? "" : "s"} this week
          </>
        ) : (
          "Everything's on track"
        )}
      </h1>

      <p className="max-w-2xl text-base leading-relaxed text-muted">
        Across {companyCount} {companyCount === 1 ? "company" : "companies"}.
        {staleCount > 0 && (
          <> {plural(staleCount, "deal")} {staleCount === 1 ? "hasn’t" : "haven’t"} been updated in over two weeks.</>
        )}
      </p>

      <AiSummaryCard endpoint="/dashboard/executive/summary" variant="strip" />
    </motion.header>
  );
}
