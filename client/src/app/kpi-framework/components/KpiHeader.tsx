"use client";

import { useRef } from "react";
import { clsx } from "clsx";
import { Plus, ChevronLeft, ChevronRight, Calendar, Building2, List, FolderTree, GitBranch } from "lucide-react";
import { Picker } from "./ui";
import { buildMonthOptions, periodLabel, type CompanyOpt, type Department, type View } from "./lib";

function CompanyTabs({ options, value, onChange }: { options: CompanyOpt[]; value: string; onChange: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dx: number) => ref.current?.scrollBy({ left: dx, behavior: "smooth" });
  const arrow = "p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-primary/5 transition-colors shrink-0";
  return (
    <div className="flex items-center gap-1 bg-surface border border-border rounded-2xl shadow-sm px-2 py-2 min-w-0">
      <button onClick={() => scroll(-260)} className={arrow} aria-label="Scroll companies left"><ChevronLeft size={16} /></button>
      <div ref={ref} className="flex items-center gap-1 overflow-x-auto flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((c) => (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={clsx(
              "px-4 py-2 text-sm rounded-xl whitespace-nowrap transition-colors",
              value === c.key ? "bg-primary text-accent-foreground font-semibold shadow-sm" : "text-foreground/70 hover:bg-primary/5",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <button onClick={() => scroll(260)} className={arrow} aria-label="Scroll companies right"><ChevronRight size={16} /></button>
    </div>
  );
}

const VIEWS = [["list", "List", List], ["department", "By department", FolderTree], ["cascade", "Hierarchy", GitBranch]] as const;

export function KpiHeader({
  ownCompany, companyName, period, onPeriod, canManage, onDepartments, onAdd,
  companyOpts, company, onCompany, departments, departmentId, onDepartment, view, onView,
}: {
  ownCompany: string | null; companyName: (k: string) => string;
  period: string; onPeriod: (p: string) => void;
  canManage: boolean; onDepartments: () => void; onAdd: () => void;
  companyOpts: CompanyOpt[]; company: string; onCompany: (c: string) => void;
  departments: Department[]; departmentId: string; onDepartment: (id: string) => void;
  view: View; onView: (v: View) => void;
}) {
  const monthOptions = buildMonthOptions(period);
  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl md:text-5xl text-foreground tracking-tight">Company Scorecard</h1>
          <p className="text-sm text-muted mt-2 max-w-3xl">
            {ownCompany && <>{companyName(ownCompany)} · </>}See how every KPI is pacing against its target. The tick on each bar marks where it should be by today.
            Recurring KPIs show {periodLabel(period)}; KPIs with a fixed deadline show their full run.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Picker icon={Calendar} value={period} onChange={onPeriod} className="min-w-[190px]">
            {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Picker>
          {canManage && (
            <button onClick={onDepartments} className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border border-border bg-surface text-foreground shadow-sm hover:bg-primary/5 transition-colors">
              <Building2 size={16} /> Departments
            </button>
          )}
          {canManage && (
            <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-accent text-accent-foreground rounded-xl shadow-sm hover:opacity-90 transition-opacity">
              <Plus size={16} /> Add KPI
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {!ownCompany && <CompanyTabs options={companyOpts} value={company} onChange={onCompany} />}
        <div className="flex flex-wrap items-center gap-3">
          {departments.length > 0 && view !== "cascade" && (
            <Picker icon={Building2} value={departmentId} onChange={onDepartment} className="min-w-[220px]">
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.kpiCount})</option>)}
              <option value="none">No department</option>
            </Picker>
          )}
          <div className="flex rounded-xl border border-border bg-surface shadow-sm overflow-hidden text-sm ml-auto">
            {VIEWS.map(([v, label, Icon], i) => (
              <button
                key={v}
                onClick={() => onView(v)}
                title={v === "cascade" ? "See how each Group target is split across companies and people" : undefined}
                className={clsx("flex items-center gap-1.5 px-3.5 py-2.5 transition-colors", i > 0 && "border-l border-border", view === v ? "bg-primary text-accent-foreground font-medium" : "text-foreground/70 hover:bg-primary/5")}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
