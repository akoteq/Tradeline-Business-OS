"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fetcher } from "@/lib/api";
import { toast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { fitsUnder, type KpiDef, type ParentOpt } from "@/components/kpi";
import {
  AGG_LABEL, FREQ_OPTS, UNIT_OPTS, apiError, defaultAgg, periodLabelFor,
  type AutoKey, type Bdo, type CompanyOpt, type Department,
} from "./lib";
import type { KpiForm } from "./types";
import { AddKpiSheet } from "./AddKpiSheet";

const day = (s: string | null | undefined) => (s ? s.slice(0, 10) : "");

// Everything data-related for the Add / Edit KPI flow lives here (queries, form state, save).
// What the person sees and how the steps flow is in AddKpiSheet and the Step files.
export function AddKpiModal({ editDef, departments, companyOpts, defaultCompany, period, onClose, onSaved }: {
  editDef?: KpiDef | null; departments: Department[]; companyOpts: CompanyOpt[];
  defaultCompany: string; period: string; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!editDef;
  const { user } = useAuth();
  const { data: autoKeys = [] } = useQuery<AutoKey[]>({ queryKey: ["kpi-auto-keys"], queryFn: () => fetcher("/kpi-framework/auto-keys") });
  const { data: people = [] } = useQuery<Bdo[]>({ queryKey: ["bdos"], queryFn: () => fetcher("/bdo") });

  const [form, setForm] = useState<KpiForm>({
    metric: editDef?.metric ?? "",
    company: editDef?.company ?? defaultCompany ?? "GROUP",
    departmentId: editDef?.departmentId ?? "",
    ownerId: editDef?.ownerId ?? "",
    parentId: editDef?.parentId ?? "",
    definition: editDef?.definition ?? "",
    unit: editDef?.unit ?? "COUNT",
    currency: editDef?.currency ?? "GHS",
    higherIsBetter: editDef?.higherIsBetter ?? true,
    frequency: editDef?.frequency ?? "MONTHLY",
    source: editDef?.source ?? "MANUAL",
    autoKey: editDef?.autoKey ?? "",
    aggregation: editDef?.aggregation ?? "",
    windowed: !!(editDef?.startDate && editDef?.endDate),
    startDate: day(editDef?.startDate),
    endDate: day(editDef?.endDate),
    targetValue: editDef?.targetValue != null ? String(editDef.targetValue) : "",
    startValue: editDef?.startValue != null ? String(editDef.startValue) : "",
    periodTarget: "",
    state: editDef?.state ?? "ACTIVE",
    milestones: (editDef?.milestones ?? []).map((m) => ({ date: day(m.date), target: String(m.target) })),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof KpiForm>(k: K, v: KpiForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const { data: parents = [] } = useQuery<ParentOpt[]>({
    queryKey: ["kpi-parents", form.company, editDef?.id ?? "", period],
    queryFn: () => fetcher(`/kpi-framework/parents?company=${form.company}&period=${period}${editDef ? `&excludeId=${editDef.id}` : ""}`),
  });
  const { data: formDepts = departments } = useQuery<Department[]>({
    queryKey: ["kpi-departments", form.company],
    queryFn: () => fetcher(`/kpi-framework/departments?company=${form.company}`),
  });

  // Same unit, and tracked as often as this KPI or less often, so results roll up.
  const fits = (p: ParentOpt) => p.unit === form.unit && (form.windowed || fitsUnder(p, form.frequency));
  const parentChoices = parents.filter((p) => fits(p) || p.id === form.parentId);
  const parent = parents.find((p) => p.id === form.parentId);
  const owners = people.filter((p) => form.company === "GROUP" || p.company === form.company);

  // A new KPI starts with the logged-in person responsible, when they work at the chosen company.
  // "Nobody yet" stays available, and changing company starts this over.
  useEffect(() => {
    if (isEdit || !user?.bdoId) return;
    const me = user.bdoId;
    setForm((f) => (!f.ownerId && (f.company === "GROUP" || user.bdoCompany === f.company) ? { ...f, ownerId: me } : f));
  }, [isEdit, user?.bdoId, user?.bdoCompany, form.company]);

  const pickFrequency = (frequency: string) => setForm((f) => {
    const p = parents.find((x) => x.id === f.parentId);
    return { ...f, frequency, parentId: p && !fitsUnder(p, frequency) ? "" : f.parentId };
  });
  const pickAutoKey = (key: string) => {
    const ak = autoKeys.find((a) => a.key === key);
    setForm((f) => ({ ...f, autoKey: key, unit: ak?.unit ?? f.unit }));
  };
  const pickParent = (id: string) => set("parentId", id);

  const save = async () => {
    if (!form.metric.trim()) { setError("Give this KPI a name."); return; }
    if (form.source === "AUTO" && !form.autoKey) { setError("Choose where the numbers should come from."); return; }
    if (form.windowed && (!form.startDate || !form.endDate)) { setError("Add both a start date and an end date."); return; }
    const t = form.windowed ? form.targetValue : form.periodTarget;
    if (!isEdit && !(Number(t) > 0)) { setError("Set a target above zero."); return; }
    setSaving(true); setError("");
    const body: Record<string, unknown> = {
      metric: form.metric,
      company: form.company,
      departmentId: form.departmentId || null,
      ownerId: form.ownerId || null,
      parentId: form.parentId || null,
      definition: form.definition || null,
      unit: form.unit,
      currency: form.unit === "CURRENCY" ? form.currency : null,
      higherIsBetter: form.higherIsBetter,
      frequency: form.frequency,
      source: form.source,
      autoKey: form.source === "AUTO" ? (form.autoKey || null) : null,
      state: form.state,
      startDate: form.windowed ? form.startDate : null,
      endDate: form.windowed ? form.endDate : null,
      targetValue: form.windowed ? (form.targetValue === "" ? null : form.targetValue) : null,
      startValue: form.windowed ? (form.startValue === "" ? null : form.startValue) : null,
      milestones: form.windowed ? form.milestones.filter((m) => m.date && m.target !== "") : [],
      period,
    };
    if (form.source !== "AUTO") body.aggregation = form.aggregation || null;
    if (!form.windowed && form.periodTarget !== "") body.target = form.periodTarget;
    try {
      if (isEdit) await api.put(`/kpi-framework/definitions/${editDef!.id}?period=${period}`, body);
      else await api.post(`/kpi-framework/definitions?period=${period}`, body);
      toast.success(isEdit ? "KPI updated" : "KPI added", { description: form.metric.trim() });
      onSaved();
    } catch (err) {
      setError(apiError(err, "Couldn't save this KPI. Please try again."));
    } finally { setSaving(false); }
  };

  return (
    <AddKpiSheet
      onClose={onClose}
      onSave={save}
      saving={saving}
      error={error}
      ctx={{
        form, set, setForm, isEdit, editId: editDef?.id ?? null,
        lockedAggregation: isEdit && editDef?.state === "ACTIVE",
        companyOpts, owners, departments: formDepts,
        parent, parentChoices, hiddenParents: parents.length > parentChoices.length,
        autoKeys, unitOpts: UNIT_OPTS, freqOpts: FREQ_OPTS, aggLabels: AGG_LABEL, defaultAgg,
        periodLabel: periodLabelFor(period, form.frequency),
        parentRange: parent?.startDate ? `${day(parent.startDate)} to ${day(parent.endDate)}` : undefined,
        pickParent, pickAutoKey, pickFrequency,
      }}
    />
  );
}