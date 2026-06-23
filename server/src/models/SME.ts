import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const SMESchema = new Schema({
  bizId: { type: String },
  companyName: { type: String, required: true },
  contactName: { type: String },
  email: { type: String },
  phone: { type: String },
  valueChain: { type: String },
  region: { type: String },
  district: { type: String },
  businessDescription: { type: String },
  status: { type: String, enum: ['IN_PROGRESS', 'ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'IN_PROGRESS' },
  followUpDate: { type: Date },
  investorReadinessScore: { type: Number },
  bankabilityTier: { type: String, enum: ['TIER_1', 'TIER_2', 'TIER_3', 'UNSCORED'], default: 'UNSCORED' },
  notes: { type: String },
}, { timestamps: true });

SMESchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const SME = mongoose.models.SME || mongoose.model('SME', SMESchema);
