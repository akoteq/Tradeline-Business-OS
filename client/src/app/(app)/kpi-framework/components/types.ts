import type { Dispatch, SetStateAction } from "react";
import type { ParentOpt } from "@/components/kpi";

export type KpiForm = {
  metric: string; company: string; departmentId: string; ownerId: string;
  parentId: string; unit: string; state: string; source: string; autoKey: string;
  aggregation: string; windowed: boolean; startDate: string; endDate: string;
  targetValue: string; startValue: string; milestones: { date: string; target: string }[];
  frequency: string; periodTarget: string; higherIsBetter: boolean; definition: string;
  currency: string; // "GHS" | "USD" | "EUR" (see @/lib/currency). Only meaningful when unit === "CURRENCY".
};


export type KpiFormCtx = {
  form: KpiForm;
  set: <K extends keyof KpiForm>(key: K, value: KpiForm[K]) => void;
  setForm: Dispatch<SetStateAction<KpiForm>>;
  isEdit: boolean;
  lockedAggregation: boolean;            // isEdit && editDef?.state === "ACTIVE"
  companyOpts: { key: string; name: string }[];
  owners: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  parent?: ParentOpt;
  parentChoices: ParentOpt[];
  hiddenParents: boolean;                // parents.length > parentChoices.length
  autoKeys: { key: string; label: string }[];
  unitOpts: string[];
  freqOpts: string[];
  aggLabels: Record<string, string>;
  defaultAgg: (unit: string) => string;
  periodLabel: string;                   // periodLabelFor(period, form.frequency)
  parentRange?: string;                  // "1 Jan 2026 to 31 Dec 2026" when the parent has fixed dates
  pickParent: (id: string) => void;
  pickAutoKey: (key: string) => void;
  pickFrequency: (f: string) => void;
  setTarget: (v: string) => void;        // provided by the shell
};