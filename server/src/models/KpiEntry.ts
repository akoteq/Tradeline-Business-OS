import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

// The measured value of a KPI for one reporting period. Attainment status/variance are
// derived at read time from current vs target (see computeAttainment in KpiDefinition).
// reviewStatus drives the target → approve → actual → verify → lock workflow (V2.5).
export const KPI_REVIEW_STATES = ['DRAFT', 'TARGET_SET', 'ACTUAL_SUBMITTED', 'VERIFIED', 'LOCKED'] as const;

const KpiEntrySchema = new Schema({
  definitionId:        { type: String, required: true },  // → KpiDefinition
  period:              { type: Date, required: true },    // start of the month/quarter
  current:             { type: Number, default: null },   // actual
  target:              { type: Number, default: null },
  priority:            { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  actionPlan:          { type: String },
  decisionRequired:    { type: String },
  executiveCommentary: { type: String },
  dataSource:          { type: String },
  bdoId:               { type: String, default: null },   // for per-BDO (BDO-scoped) entries
  company:             { type: String, default: null },   // denormalised for filtering
  reviewStatus:        { type: String, enum: KPI_REVIEW_STATES, default: 'DRAFT' },
}, { timestamps: true });

KpiEntrySchema.index({ definitionId: 1, period: -1 });
KpiEntrySchema.index({ company: 1, period: -1 });
KpiEntrySchema.index({ bdoId: 1, period: -1 });
KpiEntrySchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const KpiEntry = mongoose.models.KpiEntry || mongoose.model('KpiEntry', KpiEntrySchema);
