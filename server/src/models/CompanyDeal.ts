import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

export const COMPANY_KEYS = ['ALPHA_AFRICA', 'FINANCE_FACTORY', 'COMMUNITY_FINANCE', 'AKOTEQ'] as const;
export type CompanyKey = typeof COMPANY_KEYS[number];

const CompanyDealSchema = new Schema({
  // Company is a dynamic key from the Company collection (dealSource=COMPANY), not a fixed enum,
  // so admins can add new companies. COMPANY_KEYS below are just the original defaults.
  company:             { type: String, required: true },
  businessName:        { type: String, required: true },
  clientName:          { type: String },
  email:               { type: String },
  telephone:           { type: String },
  region:              { type: String },
  industry:            { type: String },
  valueChain:          { type: String },
  product:             { type: String },
  bdoId:               { type: String, default: null },
  dealStage:           { type: String, enum: ['QUALIFICATION', 'DISCOVERY', 'PROPOSAL_SENT', 'NEGOTIATION', 'CONTRACT_REVIEW', 'CLOSED_WON', 'CLOSED_LOST', 'ON_HOLD'], default: 'QUALIFICATION' },
  dealHealth:          { type: String, enum: ['ACTIVE', 'STALE', 'AT_RISK', 'CLOSED_WON', 'CLOSED_LOST'], default: 'ACTIVE' },
  priority:            { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  paymentStatus:       { type: String, enum: ['PAID', 'UNPAID', 'PARTIAL', 'OVERDUE'], default: 'UNPAID' },
  invoiceStatus:       { type: String, enum: ['NOT_INVOICED', 'INVOICED', 'PAID', 'OVERDUE'], default: 'NOT_INVOICED' },
  revenuePotentialGhs: { type: Number },
  revenueReceivedGhs:  { type: Number, default: 0 },
  balanceGhs:          { type: Number },
  nextSteps:           { type: String },
  nextCallDate:        { type: Date },
  notes:               { type: String },
}, { timestamps: true });

CompanyDealSchema.index({ company: 1, updatedAt: -1 });
CompanyDealSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const CompanyDeal = mongoose.models.CompanyDeal || mongoose.model('CompanyDeal', CompanyDealSchema);
