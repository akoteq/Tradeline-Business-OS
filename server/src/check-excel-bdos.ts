import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx');

const FILE = path.resolve(__dirname, '../../data/Africa_SME_OS_v2_FINAL (version 2).xlsx');

function readSheetRaw(sheetName: string): unknown[][] {
  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets[sheetName];
  if (!ws) { console.log(`Sheet "${sheetName}" not found`); return []; }
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

function str(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v).trim() || null;
}

// BAPX pipeline: BDO is column index 9
console.log('\n=== BAPX PIPELINE — BDO column (col 9) ===');
const bapxRows = readSheetRaw('🟢 BAPX PIPELINE');
const bapxBdos = new Map<string, number>();
for (const r of bapxRows.slice(5)) {
  const row = r as unknown[];
  const bdo = str(row[9]);
  if (bdo) bapxBdos.set(bdo, (bapxBdos.get(bdo) ?? 0) + 1);
}
[...bapxBdos.entries()].sort((a, b) => b[1] - a[1]).forEach(([n, c]) => console.log(`  "${n}" → ${c} deals`));

// Tradeline pipeline: BDO is column index 4
console.log('\n=== TRADELINE PIPELINE — BDO column (col 4) ===');
const tlRows = readSheetRaw('🔶 TRADELINE PIPELINE');
const tlBdos = new Map<string, number>();
let tlNoBdo = 0;
for (const r of tlRows.slice(5)) {
  const row = r as unknown[];
  if (!str(row[2])) continue; // skip empty rows
  const raw = str(row[4]);
  const bdo = raw?.split('/')[0]?.trim() ?? null;
  if (bdo) tlBdos.set(bdo, (tlBdos.get(bdo) ?? 0) + 1);
  else tlNoBdo++;
}
[...tlBdos.entries()].sort((a, b) => b[1] - a[1]).forEach(([n, c]) => console.log(`  "${n}" → ${c} deals`));
console.log(`  (blank BDO) → ${tlNoBdo} deals`);

// BAPX blank BDO count
let bapxNoBdo = 0;
for (const r of bapxRows.slice(5)) {
  const row = r as unknown[];
  if (!str(row[2])) continue;
  if (!str(row[9])) bapxNoBdo++;
}
console.log(`\nBAPX rows with blank BDO: ${bapxNoBdo}`);
