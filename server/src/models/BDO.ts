import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const BDOSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  company: { type: String, enum: ['BAPX', 'TRADELINE'], required: true },
  role: { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

BDOSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const BDO = mongoose.models.BDO || mongoose.model('BDO', BDOSchema);
