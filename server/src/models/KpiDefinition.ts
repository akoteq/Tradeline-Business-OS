import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

// The KPI registry — the catalog of *what* is measured, mirroring the SME-OS Executive
// KPI Framework. Actual period values live in KpiEntry, keyed by definitionId.
export const KPI_UNITS = ['COUNT', 'CURRENCY', 'PERCENT', 'SCORE', 'DAYS', 'HOURS'] as const;
export const KPI_FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const;
// Whose performance a KPI describes — group-wide, a single company, a department, or an individual BDO.
export const KPI_SCOPES = ['GROUP', 'COMPANY', 'DEPARTMENT', 'BDO'] as const;

const KpiDefinitionSchema = new Schema({
  metric:             { type: String, required: true },   // e.g. "Revenue Received"
  department:         { type: String },                   // e.g. "Finance", "Business Development", "HR"
  category:           { type: String },                   // e.g. "Revenue", "Sales"
  definition:         { type: String },
  formula:            { type: String },
  unit:               { type: String, enum: KPI_UNITS, default: 'COUNT' },
  higherIsBetter:     { type: Boolean, default: true },   // false for metrics like Sales Cycle, Overdue Follow-ups
  frequency:          { type: String, enum: KPI_FREQUENCIES, default: 'MONTHLY' },
  scope:              { type: String, enum: KPI_SCOPES, default: 'DEPARTMENT' },
  company:            { type: String, default: null },    // company key for COMPANY-scoped KPIs
  ownerName:          { type: String },                   // e.g. "Ebo Awortwe (Finance & Investment Analyst)"
  ownerId:            { type: String, default: null },    // staff (BDO) id, if resolvable
  strategicObjective: { type: String },
  linkedDashboard:    { type: String },                   // e.g. "01_Board_Dashboard"
  order:              { type: Number, default: 100 },
  isActive:           { type: Boolean, default: true },
}, { timestamps: true });

KpiDefinitionSchema.index({ department: 1, order: 1 });
KpiDefinitionSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const KpiDefinition = mongoose.models.KpiDefinition || mongoose.model('KpiDefinition', KpiDefinitionSchema);

// Attainment status derived from current vs target — computed, never typed.
export type AttainmentStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'NO_TARGET';

export function computeAttainment(
  current: number | null | undefined,
  target: number | null | undefined,
  higherIsBetter = true,
): { variance: number; attainment: number | null; status: AttainmentStatus } {
  const variance = (current ?? 0) - (target ?? 0);
  if (current == null || target == null || target === 0) {
    return { variance, attainment: null, status: 'NO_TARGET' };
  }
  const ratio = higherIsBetter ? current / target : target / current;
  const attainment = Math.round(ratio * 100);
  const status: AttainmentStatus = ratio >= 1 ? 'ON_TRACK' : ratio >= 0.8 ? 'AT_RISK' : 'OFF_TRACK';
  return { variance, attainment, status };
}
