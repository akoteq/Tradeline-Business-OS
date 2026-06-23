import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const LeadSchema = new Schema({
  bizId: { type: String },
  businessName: { type: String, required: true },
  email: { type: String },
  contactPerson: { type: String },
  roleTitle: { type: String },
  status: { type: String, enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'IN_PROGRESS', 'CONVERTED', 'LOST'], default: 'NEW' },
  source: { type: String },
  bdoId: { type: String, default: null },
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'] },
  dateAdded: { type: Date },
  followUpDate: { type: Date },
  notes: { type: String },
  smeId: { type: String, default: null },
}, { timestamps: true });

LeadSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const Lead = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
