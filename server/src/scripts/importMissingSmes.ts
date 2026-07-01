import 'dotenv/config';
import path from 'path';
import mongoose from 'mongoose';
import { connectDB } from '../lib/db';
import { SME } from '../models/SME';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx');

const DATA_DIR = path.resolve(__dirname, '../../../data');
const MAIN_FILE = path.join(DATA_DIR, 'Africa_SME_OS_v2_FINAL (version 2).xlsx');

function readSheetRaw(file: string, sheetName: string): unknown[][] {
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

function str(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v).trim() || null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function normSmeStatus(v: unknown): string {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('ACTIVE')) return 'ACTIVE';
  if (s.includes('INACTIVE')) return 'INACTIVE';
  return 'IN_PROGRESS';
}

function normBankabilityTier(v: unknown): string {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('TIER_1') || s.includes('TIER 1')) return 'TIER_1';
  if (s.includes('TIER_2') || s.includes('TIER 2')) return 'TIER_2';
  if (s.includes('TIER_3') || s.includes('TIER 3')) return 'TIER_3';
  return 'UNSCORED';
}

// This script is additive-only: it never deletes or overwrites existing SME
// records. It only inserts clients from the Excel SME sheet that don't
// already exist in the DB (matched case-insensitively on company name).
async function main() {
  console.log('Connecting to database...');
  await connectDB();

  console.log(`Reading '🏢 SME DATABASE' sheet from ${MAIN_FILE}`);
  const rows = readSheetRaw(MAIN_FILE, '🏢 SME DATABASE');
  const dataRows = rows.slice(5).filter((r) => r[1] && String(r[1]).trim());
  console.log(`Found ${dataRows.length} client rows in the sheet.`);

  const existing = await SME.find({}, 'companyName').lean();
  const existingNames = new Set(existing.map((s) => String(s.companyName).trim().toLowerCase()));
  console.log(`${existingNames.size} clients already exist in the database.`);

  let added = 0, skippedExisting = 0, skippedNoName = 0;
  const addedNames: string[] = [];

  for (const r of dataRows) {
    const companyName = str(r[1]);
    if (!companyName) { skippedNoName++; continue; }
    if (existingNames.has(companyName.trim().toLowerCase())) { skippedExisting++; continue; }

    await new SME({
      companyName,
      contactName: str(r[2]),
      email: str(r[3]),
      phone: str(r[4]),
      valueChain: str(r[5]),
      region: str(r[6]),
      district: str(r[7]),
      businessDescription: str(r[8]),
      status: normSmeStatus(r[9]),
      followUpDate: parseDate(r[10]),
      investorReadinessScore: num(r[11]) ? Math.round(num(r[11])!) : null,
      bankabilityTier: normBankabilityTier(r[12]),
      notes: str(r[13]),
      bizId: str(r[14]),
      // Newer fields (altPhone, address, dateOfIncorporation, yearsInOperation,
      // revenueGhs2023-2026, bdoId, collateralStatus) are intentionally left
      // blank here — the Excel sheet has no columns for them, so these will
      // need to be filled in manually.
    }).save();
    existingNames.add(companyName.trim().toLowerCase());
    addedNames.push(companyName);
    added++;
  }

  console.log('\nDone.');
  console.log(`  Added:              ${added}`);
  console.log(`  Already existed:    ${skippedExisting}`);
  console.log(`  Skipped (no name):  ${skippedNoName}`);
  if (addedNames.length) {
    console.log('\nNewly added clients:');
    addedNames.forEach((n) => console.log(`  - ${n}`));
  }
}

main()
  .catch((e) => { console.error('Import failed:', e); process.exit(1); })
  .finally(() => mongoose.disconnect());
