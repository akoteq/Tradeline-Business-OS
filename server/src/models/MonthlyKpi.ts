import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const MonthlyKpiSchema = new Schema({
  serialNo: { type: Number },
  category: { type: String },
  metric: { type: String, required: true },
  bdoId: { type: String, default: null },
  month: { type: Date, required: true },
  target: { type: Number },
  actual: { type: Number },
  notes: { type: String },
}, { timestamps: true });

MonthlyKpiSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const MonthlyKpi = mongoose.models.MonthlyKpi || mongoose.model('MonthlyKpi', MonthlyKpiSchema);
