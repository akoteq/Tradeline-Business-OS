import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const BDOSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  company: { type: String, enum: ['BAPX', 'TRADELINE', 'ALPHA_AFRICA', 'FINANCE_FACTORY', 'COMMUNITY_FINANCE', 'AKOTEQ'], required: true },
  role: { type: String },                    // job title, e.g. "Senior BDO", "Finance Analyst"
  managerId: { type: String, default: null }, // links a staff member to the Senior BDO / lead they report to
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

BDOSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const BDO = mongoose.models.BDO || mongoose.model('BDO', BDOSchema);
