import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDB } from '../lib/db';
import { KpiDefinition } from '../models/KpiDefinition';

// Seeds the KPI registry from the SME-OS Executive KPI Framework (Excel-derived).
// Idempotent: inserts definitions that don't yet exist, keyed by (metric + department),
// and never overwrites admin edits to existing ones. Run with: npx tsx src/scripts/seedKpiFramework.ts
// Standard per-BDO scorecard — applied to every BDO, one entry per BDO per month
// (Level 1 individual metrics from the BOS proposal).
const BDO_KPIS: Record<string, unknown>[] = [
  { metric: 'Revenue Collected', department: 'BDO Performance', unit: 'CURRENCY', higherIsBetter: true, scope: 'BDO', frequency: 'MONTHLY', order: 10, definition: 'Revenue actually collected by this BDO in the period.' },
  { metric: 'Opportunities Generated', department: 'BDO Performance', unit: 'COUNT', higherIsBetter: true, scope: 'BDO', frequency: 'MONTHLY', order: 20, definition: 'New qualified opportunities created by this BDO.' },
  { metric: 'Proposals Submitted', department: 'BDO Performance', unit: 'COUNT', higherIsBetter: true, scope: 'BDO', frequency: 'MONTHLY', order: 30, definition: 'Proposals submitted before deadline.' },
  { metric: 'Deals Won', department: 'BDO Performance', unit: 'COUNT', higherIsBetter: true, scope: 'BDO', frequency: 'MONTHLY', order: 40, definition: 'Contracts won in the period.' },
  { metric: 'Proposal Conversion Rate', department: 'BDO Performance', unit: 'PERCENT', higherIsBetter: true, scope: 'BDO', frequency: 'MONTHLY', order: 50, definition: 'Percentage of submitted proposals that convert to won deals.' },
  { metric: 'Client Meetings', department: 'BDO Performance', unit: 'COUNT', higherIsBetter: true, scope: 'BDO', frequency: 'MONTHLY', order: 60, definition: 'Client meetings held in the period.' },
  { metric: 'Tasks Completed On Time', department: 'BDO Performance', unit: 'PERCENT', higherIsBetter: true, scope: 'BDO', frequency: 'MONTHLY', order: 70, definition: 'Percentage of scheme-of-work tasks completed by their target date.' },
  { metric: 'Stale Opportunities', department: 'BDO Performance', unit: 'COUNT', higherIsBetter: false, scope: 'BDO', frequency: 'MONTHLY', order: 80, definition: 'Open opportunities not updated on time (lower is better).' },
];

// BAPX recruitment KPIs (from the Bapx KPI Framework doc) — company-scoped to BAPX,
// grouped under one "BAPX Recruitment" department with the four areas as categories.
const bapx = (metric: string, category: string, unit: string, higherIsBetter: boolean, order: number, definition: string): Record<string, unknown> =>
  ({ metric, department: 'BAPX Recruitment', category, unit, higherIsBetter, scope: 'COMPANY', company: 'BAPX', frequency: 'MONTHLY', order, definition });

const BAPX_KPIS: Record<string, unknown>[] = [
  // Pipeline & Sourcing
  bapx('Active Roles in Pipeline', 'Pipeline & Sourcing', 'COUNT', true, 10, 'Open Service Orders/roles currently being sourced, by stage.'),
  bapx('Candidates Sourced per Role', 'Pipeline & Sourcing', 'COUNT', true, 20, 'Number of candidates screened per open role.'),
  bapx('Time to Shortlist', 'Pipeline & Sourcing', 'DAYS', false, 30, 'Working days from job-spec receipt to shortlist presentation (21-day commitment).'),
  bapx('Shortlist-to-Interview Conversion', 'Pipeline & Sourcing', 'PERCENT', true, 40, 'Percentage of shortlisted candidates the client interviews.'),
  bapx('Roles at Risk of Missed SLA', 'Pipeline & Sourcing', 'COUNT', false, 50, 'Roles approaching the 21-day shortlist deadline (lower is better).'),
  // Placement Delivery
  bapx('Placements Completed', 'Placement Delivery', 'COUNT', true, 60, 'Candidates with written offer acceptance (MTD/QTD/YTD).'),
  bapx('Offer Acceptance Rate', 'Placement Delivery', 'PERCENT', true, 70, 'Percentage of extended offers accepted by candidates.'),
  bapx('Fill Rate', 'Placement Delivery', 'PERCENT', true, 80, 'Percentage of commissioned roles successfully closed.'),
  bapx('Average Time-to-Fill', 'Placement Delivery', 'DAYS', false, 90, 'Days from Service Order sign-off to placement (lower is better).'),
  bapx('Early Attrition Rate', 'Placement Delivery', 'PERCENT', false, 100, 'Percentage of placements exiting within the guarantee window (lower is better).'),
  bapx('Recruitment Drive Completion', 'Placement Delivery', 'PERCENT', true, 110, 'Percentage of drive roles closed within the agreed timeline.'),
  // Revenue
  bapx('Recruitment Fees Invoiced', 'Revenue', 'CURRENCY', true, 120, 'Total one-month-salary fees invoiced across closed placements.'),
  bapx('Commitment Fees Collected', 'Revenue', 'CURRENCY', true, 130, '40% upfront fees collected before sourcing begins.'),
  bapx('Outstanding Balances', 'Revenue', 'CURRENCY', false, 140, 'Unpaid 60%-on-placement balances past the 14-day term (lower is better).'),
  bapx('Talent Management Retainer Revenue', 'Revenue', 'CURRENCY', true, 150, 'Recurring monthly retainer revenue from active Talent Management clients.'),
  bapx('Success Bonus Revenue', 'Revenue', 'CURRENCY', true, 160, '15% bonus revenue on fully-delivered recruitment drives.'),
  // Post-Placement Talent Management
  bapx('Active Talent Management Clients', 'Post-Placement', 'COUNT', true, 170, 'Clients currently on a monthly retainer.'),
  bapx('Retention Rate at 90/180 Days', 'Post-Placement', 'PERCENT', true, 180, 'Percentage of placed candidates still active at each milestone.'),
  bapx('IRT Check-ins On Schedule', 'Post-Placement', 'PERCENT', true, 190, 'Percentage of monthly Implementation Review Team reviews held on time.'),
  bapx('Replacement Guarantee Invocations', 'Post-Placement', 'COUNT', false, 200, 'Guarantee claims made by clients (lower is better).'),
];

async function main() {
  const file = path.join(__dirname, 'kpiDefinitions.seed.json');
  const fromExcel = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>[];
  const defs = [...fromExcel, ...BDO_KPIS, ...BAPX_KPIS];

  await connectDB();
  let inserted = 0;
  for (const d of defs) {
    const r = await KpiDefinition.updateOne(
      { metric: d.metric, department: d.department },
      { $setOnInsert: { ...d, isActive: true } },
      { upsert: true },
    );
    if (r.upsertedCount) inserted += 1;
  }
  const total = await KpiDefinition.countDocuments({ isActive: true });
  console.log(`KPI seed complete — inserted ${inserted} new, ${total} active definitions total.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error('KPI seed failed:', err); process.exit(1); });
