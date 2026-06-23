import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const FollowUpSchema = new Schema({
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  assignedTo: { type: String },
  dueDate: { type: Date, required: true },
  notes: { type: String },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
}, { timestamps: true });

FollowUpSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const FollowUp = mongoose.models.FollowUp || mongoose.model('FollowUp', FollowUpSchema);
