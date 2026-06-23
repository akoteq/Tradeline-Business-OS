import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const GrantLoanTrackerSchema = new Schema({
  clientName: { type: String, required: true },
  bdoId: { type: String, default: null },
  grantLoanType: { type: String },
  funderDfi: { type: String },
  sectorValueChain: { type: String },
  amountApplied: { type: String },
  amountApproved: { type: Number },
  disbursed: { type: Number },
  applicationDate: { type: Date },
  decisionDate: { type: Date },
  status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DISBURSED', 'REJECTED', 'WITHDRAWN'], default: 'SUBMITTED' },
  commissionPct: { type: Number, default: 10 },
  commissionReceived: { type: Number },
  notes: { type: String },
  smeId: { type: String, default: null },
}, { timestamps: true });

GrantLoanTrackerSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const GrantLoanTracker = mongoose.models.GrantLoanTracker || mongoose.model('GrantLoanTracker', GrantLoanTrackerSchema);
