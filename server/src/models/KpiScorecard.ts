import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const KpiScorecardSchema = new Schema({
  month: { type: Date, required: true },
  company: { type: String, enum: ['BAPX', 'TRADELINE'], required: true },
  kpiMetric: { type: String, required: true },
  currentValue: { type: Number },
  unit: { type: String },
  benchmarkTarget: { type: Number },
  status: { type: String },
  managementNotes: { type: String },
}, { timestamps: true });

KpiScorecardSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const KpiScorecard = mongoose.models.KpiScorecard || mongoose.model('KpiScorecard', KpiScorecardSchema);
