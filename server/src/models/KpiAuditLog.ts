import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

// An immutable record of every change to a KPI entry — creation, value edits, and
// workflow transitions. Backs the proposal's requirement that scorecard changes are
// logged with editor, time, previous value, new value, and approval status.
const KpiAuditLogSchema = new Schema({
  entryId:       { type: String, required: true },
  definitionId:  { type: String },
  actorId:       { type: String },       // User id
  actorEmail:    { type: String },
  actorRole:     { type: String },
  action:        { type: String, required: true }, // 'create' | 'update' | 'submit_target' | 'submit_actual' | 'verify' | 'lock' | 'reopen'
  field:         { type: String },       // for 'update' — e.g. 'current', 'target'
  previousValue: { type: String },
  newValue:      { type: String },
  reviewStatus:  { type: String },       // review status after this action
  note:          { type: String },
}, { timestamps: true });

KpiAuditLogSchema.index({ entryId: 1, createdAt: -1 });
KpiAuditLogSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const KpiAuditLog = mongoose.models.KpiAuditLog || mongoose.model('KpiAuditLog', KpiAuditLogSchema);
