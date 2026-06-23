import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const TaskSchema = new Schema({
  year: { type: Number },
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  deliverable: { type: String, required: true },
  targetDate: { type: String },
  bdoId: { type: String, default: null },
  status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'], default: 'PENDING' },
  company: { type: String, enum: ['BAPX', 'TRADELINE'] },
  notes: { type: String },
}, { timestamps: true });

TaskSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);
