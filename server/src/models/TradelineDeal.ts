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
  revenuePotentialGhs: { type: Number, min: 0 },
  dueDate: { type: Date },
  expectedRevenueReceivedGhs: { type: Number, min: 0 },
  revenueReceivedGhs: { type: Number, default: 0, min: 0 },
  balanceGhs: { type: Number, min: 0 },
  paymentStatus: { type: String, enum: ['PAID', 'UNPAID', 'PARTIAL', 'OVERDUE'], default: 'UNPAID' },
  invoiceStatus: { type: String, enum: ['NOT_INVOICED', 'INVOICED', 'PAID', 'OVERDUE'], default: 'NOT_INVOICED' },
  // Multi-currency: GHS amounts are canonical; currency + exchangeRate record the original entry.
  currency: { type: String, enum: ['GHS', 'USD', 'EUR', 'NGN', 'RWF'], default: 'GHS' },
  exchangeRate: { type: Number, default: 1 },
  dealStage: { type: String, enum: ['QUALIFICATION', 'DISCOVERY', 'PROPOSAL_SENT', 'NEGOTIATION', 'CONTRACT_REVIEW', 'CLOSED_WON', 'CLOSED_LOST', 'ON_HOLD'], default: 'QUALIFICATION' },
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  dealHealth: { type: String, enum: ['ACTIVE', 'STALE', 'AT_RISK', 'CLOSED_WON', 'CLOSED_LOST'], default: 'ACTIVE' },
  smeId: { type: String, default: null },
}, { timestamps: true });

TradelineDealSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const TradelineDeal = mongoose.models.TradelineDeal || mongoose.model('TradelineDeal', TradelineDealSchema);
