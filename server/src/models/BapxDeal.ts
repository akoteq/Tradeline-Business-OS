import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const BapxDealSchema = new Schema({
  bizId: { type: String },
  dealHealth: { type: String, enum: ['ACTIVE', 'STALE', 'AT_RISK', 'CLOSED_WON', 'CLOSED_LOST'], default: 'ACTIVE' },
  date: { type: Date },
  businessName: { type: String, required: true },
  clientName: { type: String },
  holdingFirm: { type: String },
  industry: { type: String },
  telephone: { type: String },
  region: { type: String },
  email: { type: String },
  bdoId: { type: String, default: null },
  activityType: { type: String },
  keyTopics: { type: String },
  callOutcome: { type: String },
  product: { type: String },
  dealStage: { type: String, enum: ['QUALIFICATION', 'DISCOVERY', 'PROPOSAL_SENT', 'NEGOTIATION', 'CONTRACT_REVIEW', 'CLOSED_WON', 'CLOSED_LOST', 'ON_HOLD'], default: 'QUALIFICATION' },
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  nextSteps: { type: String },
  nextCallDate: { type: Date },
  targetGhs: { type: Number },
  daysSinceLastContact: { type: Number },
  aiCoachRecommendation: { type: String },
  smeId: { type: String, default: null },
}, { timestamps: true });

BapxDealSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const BapxDeal = mongoose.models.BapxDeal || mongoose.model('BapxDeal', BapxDealSchema);
