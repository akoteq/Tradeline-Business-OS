import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const ConsolidatedRecordSchema = new Schema({
  serialNo: { type: Number },
  businessName: { type: String, required: true },
  contactPerson: { type: String },
  emailPhone: { type: String },
  region: { type: String },
  valueChain: { type: String },
  dealValue: { type: Number },
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'] },
  pipelineStatus: { type: String },
  duplicateFlag: { type: Boolean, default: false },
  sourceFirm: { type: String, enum: ['BAPX', 'TRADELINE'] },
  assignedBdo: { type: String },
}, { timestamps: true });

ConsolidatedRecordSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const ConsolidatedRecord = mongoose.models.ConsolidatedRecord || mongoose.model('ConsolidatedRecord', ConsolidatedRecordSchema);
