import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const ActivityLogSchema = new Schema({
  taskNo: { type: Number },
  category: { type: String },
  description: { type: String, required: true },
  startWeek: { type: String },
  endWeek: { type: String },
  progress: { type: Number, default: 0 },
  status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'], default: 'PENDING' },
  notes: { type: String },
  bdoId: { type: String, default: null },
}, { timestamps: true });

ActivityLogSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);
