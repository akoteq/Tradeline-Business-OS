import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

// The KPI registry — the catalog of *what* is measured, mirroring the SME-OS Executive
// KPI Framework. Actual period values live in KpiEntry, keyed by definitionId.
export const KPI_UNITS = ['COUNT', 'CURRENCY', 'PERCENT', 'SCORE', 'DAYS', 'HOURS'] as const;
export const KPI_FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const;
// The entity a KPI belongs to: the whole group, or a specific company key.
export const KPI_GROUP = 'GROUP';

// How a KPI's actual value is obtained: computed live from app data, or typed by a person.
export const KPI_SOURCES = ['MANUAL', 'AUTO'] as const;

const KpiDefinitionSchema = new Schema({
  metric:             { type: String, required: true },   // e.g. "Revenue Received"
  company:            { type: String, default: KPI_GROUP }, // 'GROUP' or a company key (BAPX, TRADELINE, …)
  department:         { type: String },                   // optional sub-grouping, e.g. "Finance", "HR"
  definition:         { type: String },                   // short description shown when entering values
  unit:               { type: String, enum: KPI_UNITS, default: 'COUNT' },
  higherIsBetter:     { type: Boolean, default: true },   // false for metrics like Sales Cycle, Overdue Follow-ups
  frequency:          { type: String, enum: KPI_FREQUENCIES, default: 'MONTHLY' },
  source:             { type: String, enum: KPI_SOURCES, default: 'MANUAL' }, // AUTO ⇒ actual computed from data
  autoKey:            { type: String, default: null },    // which auto-feed metric powers an AUTO KPI
  order:              { type: Number, default: 100 },
  isActive:           { type: Boolean, default: true },
  // — deprecated (retained so existing docs keep their data; no longer edited in-app) —
  scope:              { type: String },
  category:           { type: String },
  formula:            { type: String },
  ownerName:          { type: String },
  ownerId:            { type: String, default: null },
  strategicObjective: { type: String },
  linkedDashboard:    { type: String },
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
