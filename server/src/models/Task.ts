import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const TaskSchema = new Schema({
  year: { type: Number },
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  deliverable: { type: String, required: true },
  targetDate: { type: Date },
  bdoId: { type: String, default: null },
  status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'], default: 'PENDING' },
  company: { type: String, enum: ['BAPX', 'TRADELINE'] },
  notes: { type: String },
  // Entry type: a normal Scheme-of-Work task, or a client proposal.
  type: { type: String, enum: ['TASK', 'PROPOSAL'], default: 'TASK' },
  // Proposal-only fields (ignored for type === 'TASK').
  smeId: { type: String, default: null },
  clientName: { type: String },
  proposalValueGhs: { type: Number, min: 0 },
  outcome: { type: String, enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'NO_RESPONSE'], default: 'DRAFT' },
}, { timestamps: true });

TaskSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);
