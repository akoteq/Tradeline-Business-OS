import 'dotenv/config';
import { connectDB } from './lib/db';
import { KpiDefinition } from './models/KpiDefinition';
import mongoose from 'mongoose';

// One-off: assign every existing KPI definition to a company now that KPIs are per-company.
// BAPX-specific departments → BAPX; everything else (the Tradeline SME-OS framework) → GROUP.
// Re-runnable. Admins can then re-assign individual KPIs from the UI.
const BY_DEPARTMENT: Record<string, string> = {
  'BAPX Recruitment': 'BAPX',
};

(async () => {
  await connectDB();

  // Default everything to GROUP first.
  const toGroup = await KpiDefinition.updateMany({ $or: [{ company: { $exists: false } }, { company: null }, { company: '' }] }, { $set: { company: 'GROUP' } });
  console.log(`Defaulted ${toGroup.modifiedCount} definition(s) to GROUP.`);

  // Then move known company-specific departments.
  for (const [dept, company] of Object.entries(BY_DEPARTMENT)) {
    const res = await KpiDefinition.updateMany({ department: dept }, { $set: { company } });
    if (res.modifiedCount) console.log(`  ${dept} → ${company}: ${res.modifiedCount} def(s)`);
  }

  const byCompany = await KpiDefinition.aggregate([{ $group: { _id: '$company', c: { $sum: 1 } } }, { $sort: { c: -1 } }]);
  console.log('\nDefinitions by company:', JSON.stringify(byCompany));
  await mongoose.disconnect();
  process.exit(0);
})();
