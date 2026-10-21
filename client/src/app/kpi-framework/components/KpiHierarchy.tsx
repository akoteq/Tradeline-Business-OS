"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ChevronDown, ChevronRight } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { fmtKpiVal, PaceBar, AutoTag, Tag, StatusPill, WorkChip, windowLabel } from "@/components/kpi";
import { apiError, kpiIcon, normNodes, pruneCascade, type CascadeNode } from "./lib";

// Each level counts the results in its own scope and window; the note under a parent shows
// how much of its target the KPIs below it have taken.
export function KpiHierarchy({ period, company, companyName, onOpen }: {
  period: string; company: string; companyName: (k: string) => string; onOpen: (id: string) => void;
}) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const { data = [], isLoading, error } = useQuery<CascadeNode[]>({
    queryKey: ["kpi-cascade", period],
    queryFn: async () => normNodes((await fetcher(`/kpi-framework/cascade?period=${period}`)) as CascadeNode[]),
    enabled: !!user,
  });
  const tree = pruneCascade(data, company);

  const box = "rounded-2xl border border-border bg-surface shadow-sm px-4 py-12 text-center text-muted";
  if (isLoading) return <div className={box}>Loading the hierarchy…</div>;
  if (error) return <div className={clsx(box, "text-red-600")}>{apiError(error, "Couldn't load the hierarchy. Please refresh and try again.")}</div>;
  if (!tree.length) {
    return <div className={box}>No KPIs in {companyName(company)}&apos;s hierarchy yet. Start with a Group KPI, then add company and personal KPIs that are &quot;part of&quot; it.</div>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted px-1">One goal, shared down the chain. Deals won and money received update every level at once.</p>
      {tree.map((n) => <Branch key={n.row.definition.id} node={n} depth={0} collapsed={collapsed} onToggle={toggle} onOpen={onOpen} companyName={companyName} />)}
    </div>
  );
}

function Branch({ node, depth, collapsed, onToggle, onOpen, companyName }: {
  node: CascadeNode; depth: number; collapsed: Set<string>; onToggle: (id: string) => void; onOpen: (id: string) => void; companyName: (k: string) => string;
}) {
  const r = node.row;
  const d = r.definition;
  const id = d.id;
  const isOpen = !collapsed.has(id);
  const level = d.ownerBdoId ? "Person" : d.company === "GROUP" ? "Group" : companyName(d.company);
  const c = r.children;
  const allocPct = c.count && r.target ? Math.min(100, Math.round(((c.allocated ?? 0) / r.target) * 100)) : null;
  const Icon = kpiIcon(d);

  return (
    <div className={clsx(depth === 0 && "rounded-2xl border border-border bg-surface shadow-sm p-3")}>
      <div className={clsx("flex items-start gap-2 rounded-xl px-2 py-2.5 hover:bg-primary/[0.03]", depth > 0 && "border-l-2 border-border/70 ml-5 pl-3")}>
        <button onClick={() => onToggle(id)} className={clsx("mt-2.5 text-muted hover:text-foreground", !node.children.length && "invisible")} aria-label={isOpen ? "Collapse" : "Expand"}>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <span className="h-9 w-9 rounded-full bg-foreground/5 text-foreground/80 grid place-items-center shrink-0"><Icon size={16} /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
              level === "Group" ? "bg-primary text-accent-foreground" : level === "Person" ? "bg-foreground/5 text-foreground/70" : "bg-accent/10 text-accent")}>
              {level === "Person" ? (r.owner?.name ?? "Person") : level}
            </span>
            <button onClick={() => onOpen(id)} className="font-semibold text-foreground hover:text-accent text-left">{d.metric}</button>
            {d.source === "AUTO" && <AutoTag />}
            {d.state === "DRAFT" && <Tag>Draft</Tag>}
            <StatusPill status={r.status} />
            <span className="text-[11px] text-muted">{windowLabel(r.window, d.frequency)}{r.owner && level !== "Person" ? ` · ${r.owner.name}` : ""}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            <span className="text-sm tabular-nums text-foreground font-medium whitespace-nowrap">{fmtKpiVal(r.current, d.unit)} <span className="text-muted font-normal">/ {fmtKpiVal(r.target, d.unit)}</span></span>
            <div className="flex items-center gap-2 w-48">
              <PaceBar attainment={r.attainment} expected={r.expected} status={r.status} />
              <span className="text-xs tabular-nums text-muted w-9 text-right">{r.attainment != null ? `${r.attainment}%` : "—"}</span>
            </div>
            <WorkChip work={r.work} />
            {allocPct != null && (
              <span className={clsx("text-[11px] whitespace-nowrap", c.over ? "text-red-600 font-medium" : "text-muted")} title="How much of this target is assigned to the KPIs below it">
                {c.over ? `Over-assigned by ${fmtKpiVal(-(c.unallocated ?? 0), d.unit)}` : `${allocPct}% assigned · ${fmtKpiVal(c.unallocated, d.unit)} left`}
              </span>
            )}
          </div>
        </div>
      </div>
      {isOpen && node.children.length > 0 && (
        <div className={clsx(depth === 0 ? "mt-1" : "ml-5")}>
          {node.children.map((k) => <Branch key={k.row.definition.id} node={k} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} onOpen={onOpen} companyName={companyName} />)}
        </div>
      )}
    </div>
  );
}
