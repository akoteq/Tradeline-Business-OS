import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const TradelineDealSchema = new Schema({
  bizId: { type: String },
  serialNo: { type: Number },
  businessName: { type: String, required: true },
  valueChain: { type: String },
  bdoId: { type: String, default: null },
  tier: { type: String, enum: ['TIER_1', 'TIER_2', 'TIER_3'], default: 'TIER_1' },
  email: { type: String },
  telephone: { type: String },
  currentStatus: { type: String },
  nextAction: { type: String },
  requiredInvestment: { type: String },
  revenuePotentialGhs: { type: Number },
  dueDate: { type: Date },
  revenueReceivedGhs: { type: Number, default: 0 },
  balanceGhs: { type: Number },
  paymentStatus: { type: String, enum: ['PAID', 'UNPAID', 'PARTIAL', 'OVERDUE'], default: 'UNPAID' },
  dealStage: { type: String, enum: ['QUALIFICATION', 'DISCOVERY', 'PROPOSAL_SENT', 'NEGOTIATION', 'CONTRACT_REVIEW', 'CLOSED_WON', 'CLOSED_LOST', 'ON_HOLD'], default: 'QUALIFICATION' },
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  dealHealth: { type: String, enum: ['ACTIVE', 'STALE', 'AT_RISK', 'CLOSED_WON', 'CLOSED_LOST'], default: 'ACTIVE' },
  smeId: { type: String, default: null },
}, { timestamps: true });

TradelineDealSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const TradelineDeal = mongoose.models.TradelineDeal || mongoose.model('TradelineDeal', TradelineDealSchema);
