import mongoose, { Schema } from 'mongoose';
import { jsonTransform } from '../lib/jsonTransform';

// Which deal collection holds a company's deals:
//   BAPX      → BapxDeal        (special, own collection & fields)
//   TRADELINE → TradelineDeal   (special, own collection & fields)
//   COMPANY   → CompanyDeal     (shared collection, keyed by company.key) — all admin-added companies
export const DEAL_SOURCES = ['BAPX', 'TRADELINE', 'COMPANY'] as const;
export type DealSource = typeof DEAL_SOURCES[number];

const CompanySchema = new Schema({
  key:        { type: String, required: true, unique: true, uppercase: true, trim: true }, // stable id used in deals/tasks/kpi
  name:       { type: String, required: true, trim: true },                                // display name (admin-editable)
  slug:       { type: String, required: true, unique: true, lowercase: true, trim: true }, // used in /pipeline/:slug routes
  dealSource: { type: String, enum: DEAL_SOURCES, default: 'COMPANY' },
  color:      { type: String, default: 'teal' },   // badge tint, e.g. "green", "indigo", "violet"
  order:      { type: Number, default: 100 },       // sort order in menus
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

CompanySchema.set('toJSON', { virtuals: true, versionKey: false, transform: jsonTransform });

export const Company = mongoose.models.Company || mongoose.model('Company', CompanySchema);

// The six companies the system shipped with. Used to seed the collection idempotently
// so existing deployments gain the Company records without a manual reseed.
export const DEFAULT_COMPANIES = [
  { key: 'BAPX',              name: 'BAPX',                     slug: 'bapx',              dealSource: 'BAPX',      color: 'green',   order: 10 },
  { key: 'TRADELINE',         name: 'Tradeline Consult',        slug: 'tradeline',         dealSource: 'TRADELINE', color: 'indigo',  order: 20 },
  { key: 'ALPHA_AFRICA',      name: 'Alpha Africa Consult Ltd', slug: 'alpha-africa',      dealSource: 'COMPANY',   color: 'indigo',  order: 30 },
  { key: 'FINANCE_FACTORY',   name: 'Finance Factory Limited',  slug: 'finance-factory',   dealSource: 'COMPANY',   color: 'emerald', order: 40 },
  { key: 'COMMUNITY_FINANCE', name: 'Community Finance Ltd',    slug: 'community-finance', dealSource: 'COMPANY',   color: 'sky',     order: 50 },
  { key: 'AKOTEQ',            name: 'Akoteq Ltd',               slug: 'akoteq',            dealSource: 'COMPANY',   color: 'violet',  order: 60 },
] as const;

// Insert any missing default companies without overwriting admin edits to existing ones.
export async function ensureCompaniesSeeded(): Promise<void> {
  for (const c of DEFAULT_COMPANIES) {
    await Company.updateOne({ key: c.key }, { $setOnInsert: c }, { upsert: true });
  }
}
