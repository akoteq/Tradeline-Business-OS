import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

// A cross-company referral — routes a client's unmet need from one group company to
// another (e.g. a Tradeline advisory client needing recruitment → BAPX). Turns ad-hoc
// cross-selling into a tracked pipeline of referral revenue.
export const REFERRAL_STATUS = ['IDENTIFIED', 'INTRODUCED', 'CONVERTED', 'DECLINED'] as const;

const ReferralSchema = new Schema({
  clientName:  { type: String, required: true },
  fromCompany: { type: String },                     // originating company key
  toCompany:   { type: String },                     // recommended / receiving company key
  bdoId:       { type: String, default: null },      // referral owner (who makes the introduction)
  service:     { type: String },                     // the need / service being referred
  status:      { type: String, enum: REFERRAL_STATUS, default: 'IDENTIFIED' },
  revenueGhs:  { type: Number },                     // referral revenue generated on conversion
  sourceDealId:{ type: String, default: null },      // optional link to the originating deal
  notes:       { type: String },
  convertedAt: { type: Date, default: null },
}, { timestamps: true });

ReferralSchema.index({ status: 1 });
ReferralSchema.index({ toCompany: 1 });
ReferralSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const Referral = mongoose.models.Referral || mongoose.model('Referral', ReferralSchema);
