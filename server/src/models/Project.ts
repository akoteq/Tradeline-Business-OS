import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const ProjectSchema = new Schema({
  name:        { type: String, required: true },
  leader:      { type: String, required: true },
  status:      { type: String, enum: ['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED'], default: 'ACTIVE' },
  company:     { type: String, enum: ['BAPX', 'TRADELINE', 'SHARED'], default: 'SHARED' },
  description: { type: String },
  startDate:   { type: Date },
  endDate:     { type: Date },
  notes:       { type: String },
}, { timestamps: true });

ProjectSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
