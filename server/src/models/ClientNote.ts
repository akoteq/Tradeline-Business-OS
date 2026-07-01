import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const ClientNoteSchema = new Schema({
  smeId: { type: String, required: true },
  note: { type: String, required: true },
  type: { type: String, enum: ['CALL', 'VISIT', 'MEETING', 'EMAIL', 'OTHER'], default: 'OTHER' },
  authorName: { type: String },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

ClientNoteSchema.index({ smeId: 1, date: -1 });
ClientNoteSchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const ClientNote = mongoose.models.ClientNote || mongoose.model('ClientNote', ClientNoteSchema);
