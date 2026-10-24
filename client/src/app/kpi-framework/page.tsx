"use client"

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { useCompanies } from "@/lib/companies";
import { useAuth } from "@/components/AuthProvider";
import { isGroupOwner, isBusinessCeo } from "@/lib/auth";
import { KpiRow, KpiDef, KpiStatus, KpiDetailSheet } from "@/components/kpi";
import { KpiSummary } from "./components/KpiSummary";
import { KpiBoard } from "./components/KpiBoard";
import { KpiHierarchy } from "./components/KpiHierarchy";
import { ReviewPanel, PeriodTargetSheet, DepartmentsModal } from "./components/KpiDialogs";
import { KpiHeader } from "./components/KpiHeader";
import { Department, normRows, View } from "./components/lib";
import { AddKpiModal } from "./components/AddKpiModal";

export default function KpiFrameworkPage() {
  const { user } = useAuth();
  const isAdmin = isGroupOwner(user);
  // A Business CEO runs their own company's KPIs — same tools as the Group Owner, one company.
  const ownCompany = isBusinessCeo(user) ? (user?.bdoCompany ?? null) : null;
  const canManage = isAdmin || !!ownCompany;
  const qc = useQueryClient();
  const { companies, byKey } = useCompanies();
  const companyName = (k: string) => (k === "GROUP" ? "Group" : byKey[k]?.name ?? k);

  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [pickedCompany, setCompany] = useState("GROUP");
  const company = ownCompany ?? pickedCompany;
  const [departmentId, setDepartmentId] = useState("");
  const [statusFilter, setStatusFilter] = useState<KpiStatus | "">("");
  const [view, setView] = useState<View>("list");
  const [openKpi, setOpenKpi] = useState<string | null>(null);
  const [showAddKpi, setShowAddKpi] = useState(false);
  const [editDef, setEditDef] = useState<KpiDef | null>(null);
  const [editTarget, setEditTarget] = useState<KpiRow | null>(null);
  const [showDepartments, setShowDepartments] = useState(false);

  // Links like /kpi-framework?view=cascade&kpi=<id> (alerts, the assistant) open a view or a KPI.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const v = q.get("view");
    if (v === "cascade" || v === "department" || v === "list") setView(v);
    else if (v === "category") setView("department"); // old links
    const id = q.get("kpi");
    if (id) setOpenKpi(id);
  }, []);

  const companyOpts = ownCompany
    ? [{ key: ownCompany, name: byKey[ownCompany]?.name ?? ownCompany }]
    : [{ key: "GROUP", name: "Group" }, ...companies.map((c) => ({ key: c.key, name: c.name }))];

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["kpi-departments", company],
    queryFn: () => fetcher(`/kpi-framework/departments?company=${company}`),
    enabled: !!user,
  });

  useEffect(() => { setDepartmentId(""); }, [company]);

  const qp = new URLSearchParams({ period, company });
  if (departmentId) qp.set("departmentId", departmentId);

  const { data: board = [], isLoading, error } = useQuery<KpiRow[]>({
    queryKey: ["kpi-board", company, departmentId, period],
    queryFn: async () => normRows((await fetcher(`/kpi-framework/board?${qp}`)) as KpiRow[]),
    enabled: !!user,
  });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["kpi-board"] }); qc.invalidateQueries({ queryKey: ["kpi-cascade"] }); };
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["kpi-departments"] });
    invalidate();
  };

  const archiveDef = useMutation({
    mutationFn: (id: string) => api.delete(`/kpi-framework/definitions/${id}`),
    onSuccess: refreshAll,
    onError: (err) => window.alert(apiError(err, "Couldn't archive this KPI. Please try again.")),
  });
  const archive = (d: KpiDef) => {
    if (window.confirm(`Archive "${d.metric}"? Its history is kept, and any KPIs below it become top-level.`)) archiveDef.mutate(d.id);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      <KpiHeader
        ownCompany={ownCompany} companyName={companyName}
        period={period} onPeriod={setPeriod}
        canManage={canManage} onDepartments={() => setShowDepartments(true)} onAdd={() => setShowAddKpi(true)}
        companyOpts={companyOpts} company={company} onCompany={setCompany}
        departments={departments} departmentId={departmentId} onDepartment={setDepartmentId}
        view={view} onView={setView}
      />

      <KpiSummary
        board={board} statusFilter={statusFilter}
        onStatus={(s) => { setStatusFilter(s); if (view === "cascade") setView("list"); }}
      />

      {view === "cascade" ? (
        <KpiHierarchy period={period} company={company} companyName={companyName} onOpen={setOpenKpi} />
      ) : (
        <KpiBoard
          board={board} isLoading={isLoading} error={error} departments={departments} view={view}
          statusFilter={statusFilter} onStatusFilter={setStatusFilter}
          resetKey={`${company}|${departmentId}|${period}`}
          period={period} canManage={canManage} companyName={companyName}
          onOpen={setOpenKpi} onSetTarget={setEditTarget} onEdit={setEditDef} onArchive={archive}
          onAdd={() => setShowAddKpi(true)} onChanged={invalidate}
        />
      )}

      {openKpi && (
        <KpiDetailSheet
          kpiId={openKpi} period={period}
          onClose={() => setOpenKpi(null)} onChanged={invalidate} onOpen={setOpenKpi} companyName={companyName}
          extra={(row) => <ReviewPanel row={row} role={user?.role ?? ""} onChanged={() => { invalidate(); qc.invalidateQueries({ queryKey: ["kpi-detail"] }); }} />}
        />
      )}
      {editTarget && (
        <PeriodTargetSheet row={editTarget} period={period} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); invalidate(); }} />
      )}
      {(showAddKpi || editDef) && (
        <AddKpiModal
          editDef={editDef} departments={departments} companyOpts={companyOpts}
          defaultCompany={company} period={period}
          onClose={() => { setShowAddKpi(false); setEditDef(null); }}
          onSaved={() => { setShowAddKpi(false); setEditDef(null); refreshAll(); }}
        />
      )}
      {showDepartments && (
        <DepartmentsModal company={company} companyName={companyName(company)} onClose={() => setShowDepartments(false)} onChanged={refreshAll} />
      )}
    </div>
  );
}
function apiError(err: Error, fallback: string): string {
  const error = err as Error & {
    response?: { data?: { message?: unknown; error?: unknown; detail?: unknown } | string };
  };
  const data = error.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    for (const value of [data.message, data.error, data.detail]) {
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return error.message?.trim() || fallback;
}

