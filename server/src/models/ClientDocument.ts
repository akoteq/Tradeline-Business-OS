import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const ClientDocumentSchema = new Schema({
  smeId: { type: String, required: true },
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  publicId: { type: String, required: true },
  resourceType: { type: String, default: 'raw' },
  fileType: { type: String },
  fileSize: { type: Number },
  uploadedBy: { type: String },
}, { timestamps: true });

ClientDocumentSchema.index({ smeId: 1 });
ClientDocumentSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const ClientDocument = mongoose.models.ClientDocument || mongoose.model('ClientDocument', ClientDocumentSchema);
