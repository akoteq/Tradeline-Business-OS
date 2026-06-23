import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'BDO', 'CEO'], default: 'BDO' },
  bdoId: { type: String, default: null },
  mustChangePassword: { type: Boolean, default: true },
}, { timestamps: true });

UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform(_doc: any, ret: any) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.password;
  },
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
