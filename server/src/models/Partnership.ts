import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const PartnershipSchema = new Schema({
  partnerOrganisation: { type: String, required: true },
  contactPerson: { type: String },
  contactEmailPhone: { type: String },
  partnershipType: { type: String },
  tradelineEntity: { type: String, enum: ['BAPX', 'TRADELINE'] },
  valueChainSector: { type: String },
  country: { type: String },
  agreementType: { type: String },
  startDate: { type: Date },
  endRenewalDate: { type: Date },
  status: { type: String, enum: ['ACTIVE', 'PENDING', 'EXPIRED', 'SUSPENDED'], default: 'ACTIVE' },
  revenueSharePct: { type: Number },
  revenueGeneratedGhs: { type: Number },
  notes: { type: String },
}, { timestamps: true });

PartnershipSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const Partnership = mongoose.models.Partnership || mongoose.model('Partnership', PartnershipSchema);
