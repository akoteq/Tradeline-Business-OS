import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

// Access roles — control what a login can see/do (permissions), ranked from most to least access.
// A staff member's *job title* is a separate concept and lives on their staff profile (BDO.role).
export const USER_ROLES = [
  'ADMIN',            // system administrator — full access
  'CEO',              // Group Owner — cross-company alert feed + logged drill-down
  'BUSINESS_CEO',     // Business CEO — full control of exactly one company
  'MANAGING_PARTNER', // executive — group-wide read
  'SENIOR_PARTNER',   // executive — group-wide read
  'SENIOR_BDO',       // team lead — own + supervised team (team scoping added in v2)
  'BDO',              // individual contributor — own data
  'JUNIOR_BDO',       // individual contributor — own data
  'INTERN',           // individual contributor — own data
] as const;

export type UserRole = typeof USER_ROLES[number];

// Roles scoped to their own profile's data only.
export const INDIVIDUAL_ROLES: UserRole[] = ['SENIOR_BDO', 'BDO', 'JUNIOR_BDO', 'INTERN'];

// Roles with company-wide scope (one company, all its data).
export const COMPANY_ROLES: UserRole[] = ['BUSINESS_CEO'];

// Roles allowed to manage users and other admin actions.
export const ADMIN_ROLES: UserRole[] = ['ADMIN', 'CEO'];

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: [...USER_ROLES], default: 'BDO' },
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
