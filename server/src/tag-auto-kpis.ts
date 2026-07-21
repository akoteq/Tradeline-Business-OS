import 'dotenv/config';
import { connectDB } from './lib/db';
import { KpiDefinition } from './models/KpiDefinition';
import mongoose from 'mongoose';

// Marks the KPI definitions we can compute from live app data as source='AUTO' and wires
// each to its auto-feed key. Matching is by metric name (case-insensitive). Re-runnable.
const MAP: Record<string, string> = {
  'revenue received': 'revenue_received',
  'outstanding revenue': 'revenue_outstanding',
  'pipeline value': 'pipeline_value',
  'deals closed': 'deals_closed_won',
  'leads': 'leads_total',
  'qualified leads': 'leads_qualified',
  'cross-sell revenue': 'cross_sell_revenue',
  'revenue from cross-selling': 'cross_sell_revenue',
  'active strategic partnerships': 'active_partnerships',
  'active partners': 'active_partnerships',
  'capital mobilised': 'capital_mobilised',
};

(async () => {
  await connectDB();
  let updated = 0;
  for (const [name, autoKey] of Object.entries(MAP)) {
    const res = await KpiDefinition.updateMany(
      { metric: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      { $set: { source: 'AUTO', autoKey } },
    );
    if (res.modifiedCount) { console.log(`  ${name} → ${autoKey}: ${res.modifiedCount} def(s)`); updated += res.modifiedCount; }
  }
  console.log(`\nTagged ${updated} definitions as AUTO.`);
  const total = await KpiDefinition.countDocuments({ source: 'AUTO' });
  console.log(`Total AUTO definitions now: ${total}`);
  await mongoose.disconnect();
  process.exit(0);
})();
