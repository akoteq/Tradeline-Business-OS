import 'dotenv/config';
import path from 'path';
import { prisma } from './lib/prisma';
import type {
  DealHealth, DealStage, Priority, Tier, PaymentStatus,
  LeadStatus, GrantLoanStatus, TaskStatus, SMEStatus,
  BankabilityTier, Company, PartnershipStatus,
} from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx');

const DATA_DIR = path.resolve(__dirname, '../../data');

const FILES = {
  main: path.join(DATA_DIR, 'Africa_SME_OS_v2_FINAL (version 2).xlsx'),
  bd: path.join(DATA_DIR, 'BUSINESS DEVELOPMENT DATABASE-2 (1).xlsx'),
  sow: path.join(DATA_DIR, 'Scheme of Work_ ACTIONS_ AND_TASK_7.10.24 (1).xlsx'),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readSheet(file: string, sheetName: string): Record<string, unknown>[] {
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

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

function normDealHealth(v: unknown): DealHealth {
  const s = String(v ?? '').toUpperCase().replace(/\s+/g, '_');
  if (s.includes('STALE')) return 'STALE';
  if (s.includes('AT_RISK') || s.includes('AT RISK')) return 'AT_RISK';
  if (s.includes('CLOSED_WON') || s.includes('CLOSED WON') || s.includes('WON')) return 'CLOSED_WON';
  if (s.includes('CLOSED_LOST') || s.includes('CLOSED LOST') || s.includes('LOST')) return 'CLOSED_LOST';
  return 'ACTIVE';
}

function normDealStage(v: unknown): DealStage {
  const s = String(v ?? '').toUpperCase().replace(/[\s/\-]+/g, '_');
  if (s.includes('QUALIF')) return 'QUALIFICATION';
  if (s.includes('DISCOVERY')) return 'DISCOVERY';
  if (s.includes('PROPOSAL')) return 'PROPOSAL_SENT';
  if (s.includes('NEGOT')) return 'NEGOTIATION';
  if (s.includes('CONTRACT') || s.includes('REVIEW')) return 'CONTRACT_REVIEW';
  if (s.includes('WON')) return 'CLOSED_WON';
  if (s.includes('LOST')) return 'CLOSED_LOST';
  if (s.includes('HOLD')) return 'ON_HOLD';
  return 'QUALIFICATION';
}

function normPriority(v: unknown): Priority {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('HIGH')) return 'HIGH';
  if (s.includes('LOW')) return 'LOW';
  return 'MEDIUM';
}

function normTier(v: unknown): Tier {
  const s = String(v ?? '').toUpperCase().replace(/\s+/g, '_');
  if (s.includes('TIER_1') || s === 'TIER 1' || s === 'T1') return 'TIER_1';
  if (s.includes('TIER_2') || s === 'TIER 2' || s === 'T2') return 'TIER_2';
  if (s.includes('TIER_3') || s === 'TIER 3' || s === 'T3') return 'TIER_3';
  return 'TIER_1';
}

function normLeadStatus(v: unknown): LeadStatus {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('CONTACT')) return 'CONTACTED';
  if (s.includes('QUALIF')) return 'QUALIFIED';
  if (s.includes('PROGRESS') || s.includes('IN_PROG')) return 'IN_PROGRESS';
  if (s.includes('CONVERT')) return 'CONVERTED';
  if (s.includes('LOST')) return 'LOST';
  return 'NEW';
}

function normPaymentStatus(v: unknown): PaymentStatus {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('PARTIAL')) return 'PARTIAL';
  if (s.includes('PAID')) return 'PAID';
  if (s.includes('OVERDUE')) return 'OVERDUE';
  return 'UNPAID';
}

function normGrantStatus(v: unknown): GrantLoanStatus {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('DISBURS')) return 'DISBURSED';
  if (s.includes('APPROV')) return 'APPROVED';
  if (s.includes('REVIEW')) return 'UNDER_REVIEW';
  if (s.includes('SUBMIT')) return 'SUBMITTED';
  if (s.includes('REJECT')) return 'REJECTED';
  if (s.includes('WITHDR')) return 'WITHDRAWN';
  return 'SUBMITTED';
}

function normTaskStatus(v: unknown): TaskStatus {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('DONE') || s.includes('COMPLET')) return 'COMPLETED';
  if (s.includes('PROGRESS')) return 'IN_PROGRESS';
  if (s.includes('OVERDUE') || s.includes('LATE')) return 'OVERDUE';
  if (s.includes('CANCEL')) return 'CANCELLED';
  return 'PENDING';
}

function normSmeStatus(v: unknown): SMEStatus {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('ACTIVE')) return 'ACTIVE';
  if (s.includes('INACTIVE')) return 'INACTIVE';
  return 'IN_PROGRESS';
}

function normBankabilityTier(v: unknown): BankabilityTier {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('TIER_1') || s.includes('TIER 1')) return 'TIER_1';
  if (s.includes('TIER_2') || s.includes('TIER 2')) return 'TIER_2';
  if (s.includes('TIER_3') || s.includes('TIER 3')) return 'TIER_3';
  return 'UNSCORED';
}

function normPartnershipStatus(v: unknown): PartnershipStatus {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('PEND')) return 'PENDING';
  if (s.includes('EXPIR')) return 'EXPIRED';
  if (s.includes('SUSPEND')) return 'SUSPENDED';
  return 'ACTIVE';
}

function normCompany(v: unknown): Company {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('BAPX')) return 'BAPX';
  return 'TRADELINE';
}

// ─── BDO upsert cache ─────────────────────────────────────────────────────────

const bdoCache = new Map<string, string>(); // name → id

async function getOrCreateBdo(name: string | null, company: Company): Promise<string | null> {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  if (bdoCache.has(key)) return bdoCache.get(key)!;

  const bdo = await prisma.bDO.upsert({
    where: { email: `${key.replace(/\s+/g, '.')}@internal` },
    update: {},
    create: {
      name: name.trim(),
      email: `${key.replace(/\s+/g, '.')}@internal`,
      company,
    },
  });
  bdoCache.set(key, bdo.id);
  return bdo.id;
}

// ─── Seed functions ───────────────────────────────────────────────────────────

async function seedBdos() {
  console.log('Seeding BDOs...');
  const bdos: Array<{ name: string; company: Company; role?: string }> = [
    { name: 'Joshua Mensah', company: 'TRADELINE', role: 'Business Development Officer' },
    { name: 'Frederick Phillips', company: 'TRADELINE', role: 'Project Management & Strategic Partnership Consultant' },
    { name: 'Whitney', company: 'TRADELINE', role: 'Business Development Officer' },
    { name: 'Silas', company: 'BAPX', role: 'Business Development Officer' },
    { name: 'Christabel Benyo', company: 'BAPX', role: 'Business Development Officer' },
    { name: 'Ebo', company: 'TRADELINE', role: 'Business Development Officer' },
    { name: 'Prince Antwi', company: 'BAPX', role: 'Business Development Officer' },
  ];
  for (const bdo of bdos) {
    const key = bdo.name.toLowerCase();
    const email = `${key.replace(/\s+/g, '.')}@internal`;
    const created = await prisma.bDO.upsert({
      where: { email },
      update: {},
      create: { name: bdo.name, email, company: bdo.company, role: bdo.role },
    });
    bdoCache.set(key, created.id);
  }
  console.log(`  ${bdoCache.size} BDOs ready`);
}

async function seedBapxPipeline() {
  console.log('Seeding BAPX pipeline...');
  const rows = readSheetRaw(FILES.main, '🟢 BAPX PIPELINE');

  const headerRow = rows[4] as string[];
  if (!headerRow) { console.log('  BAPX pipeline: header not found, skipping'); return; }

  const dataRows = rows.slice(5).filter((r) => {
    const arr = r as unknown[];
    return arr[2] && String(arr[2]).trim();
  });

  let count = 0;
  for (const raw of dataRows) {
    const r = raw as unknown[];
    const businessName = str(r[2]);
    if (!businessName) continue;

    const bdoId = await getOrCreateBdo(str(r[9]), 'BAPX');

    await prisma.bapxDeal.create({
      data: {
        dealHealth: normDealHealth(r[0]),
        date: parseDate(r[1]),
        businessName,
        clientName: str(r[3]),
        holdingFirm: str(r[4]),
        industry: str(r[5]),
        telephone: str(r[6]),
        region: str(r[7]),
        email: str(r[8]),
        bdoId,
        activityType: str(r[10]),
        keyTopics: str(r[11]),
        callOutcome: str(r[12]),
        product: str(r[13]),
        dealStage: normDealStage(r[14]),
        priority: normPriority(r[15]),
        nextSteps: str(r[16]),
        nextCallDate: parseDate(r[17]),
        targetGhs: num(r[18]),
        daysSinceLastContact: num(r[19]) ? Math.round(num(r[19])!) : null,
        aiCoachRecommendation: str(r[20]),
        bizId: str(r[21]),
      },
    }).catch(() => {});
    count++;
  }
  console.log(`  ${count} BAPX deals seeded`);
}

async function seedTradelinePipeline() {
  console.log('Seeding Tradeline pipeline...');
  const rows = readSheetRaw(FILES.main, '🔶 TRADELINE PIPELINE');

  const dataRows = rows.slice(5).filter((r) => {
    const arr = r as unknown[];
    return arr[2] && String(arr[2]).trim();
  });

  let count = 0;
  for (const raw of dataRows) {
    const r = raw as unknown[];
    const businessName = str(r[2]);
    if (!businessName) continue;

    const primaryBdo = str(r[4])?.split('/')[0]?.trim() ?? null;
    const bdoId = await getOrCreateBdo(primaryBdo, 'TRADELINE');

    await prisma.tradelineDeal.create({
      data: {
        serialNo: num(r[1]) ? Math.round(num(r[1])!) : null,
        businessName,
        valueChain: str(r[3]),
        bdoId,
        tier: normTier(r[5]),
        email: str(r[6]),
        telephone: str(r[7]),
        currentStatus: str(r[8]),
        nextAction: str(r[9]),
        requiredInvestment: str(r[10]),
        revenuePotentialGhs: num(r[11]),
        dueDate: parseDate(r[12]),
        revenueReceivedGhs: num(r[13]) ?? 0,
        balanceGhs: num(r[14]),
        paymentStatus: normPaymentStatus(r[15]),
        dealStage: normDealStage(r[16]),
        priority: normPriority(r[17]),
        dealHealth: normDealHealth(r[18]),
        bizId: str(r[19]),
      },
    }).catch(() => {});
    count++;
  }
  console.log(`  ${count} Tradeline deals seeded`);
}

async function seedLeads() {
  console.log('Seeding Leads DB...');
  const rows = readSheetRaw(FILES.main, '🔵 LEADS DB');
  const dataRows = rows.slice(4).filter((r) => {
    const arr = r as unknown[];
    return arr[1] && String(arr[1]).trim();
  });

  // Resolve all BDO IDs upfront (uses cache after first lookup)
  const records: Parameters<typeof prisma.lead.create>[0]['data'][] = [];
  for (const raw of dataRows) {
    const r = raw as unknown[];
    const businessName = str(r[1]);
    if (!businessName) continue;
    const bdoId = await getOrCreateBdo(str(r[7]), 'BAPX');
    records.push({
      businessName,
      email: str(r[2]),
      contactPerson: str(r[3]),
      roleTitle: str(r[4]),
      status: normLeadStatus(r[5]),
      source: str(r[6]),
      bdoId,
      priority: r[8] ? normPriority(r[8]) : null,
      dateAdded: parseDate(r[9]),
      followUpDate: parseDate(r[10]),
      notes: str(r[11]),
      bizId: str(r[12]),
    });
  }

  // Insert in parallel chunks of 20
  const CHUNK = 20;
  let count = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    await Promise.all(records.slice(i, i + CHUNK).map((data) => prisma.lead.create({ data }).catch(() => {})));
    count += Math.min(CHUNK, records.length - i);
  }
  console.log(`  ${count} leads seeded`);
}

async function seedSme() {
  console.log('Seeding SME Database...');
  const rows = readSheetRaw(FILES.main, '🏢 SME DATABASE');
  const dataRows = rows.slice(5).filter((r) => {
    const arr = r as unknown[];
    return arr[1] && String(arr[1]).trim();
  });

  let count = 0;
  for (const raw of dataRows) {
    const r = raw as unknown[];
    const companyName = str(r[1]);
    if (!companyName) continue;

    await prisma.sME.create({
      data: {
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
      },
    }).catch(() => {});
    count++;
  }
  console.log(`  ${count} SMEs seeded`);
}

async function seedPartnerships() {
  console.log('Seeding Partnerships...');
  const rows = readSheetRaw(FILES.main, '🤝 PARTNERSHIPS');
  const dataRows = rows.slice(4).filter((r) => {
    const arr = r as unknown[];
    return arr[1] && String(arr[1]).trim();
  });

  let count = 0;
  for (const raw of dataRows) {
    const r = raw as unknown[];
    const partnerOrg = str(r[1]);
    if (!partnerOrg) continue;

    await prisma.partnership.create({
      data: {
        partnerOrganisation: partnerOrg,
        contactPerson: str(r[2]),
        contactEmailPhone: str(r[3]),
        partnershipType: str(r[4]),
        tradelineEntity: normCompany(r[5]),
        valueChainSector: str(r[6]),
        country: str(r[7]),
        agreementType: str(r[8]),
        startDate: parseDate(r[9]),
        endRenewalDate: parseDate(r[10]),
        status: normPartnershipStatus(r[11]),
        revenueSharePct: num(r[12]),
        revenueGeneratedGhs: num(r[13]),
        notes: str(r[14]),
      },
    }).catch(() => {});
    count++;
  }
  console.log(`  ${count} partnerships seeded`);
}

async function seedGrantLoans() {
  console.log('Seeding Grant & Loan Tracker...');
  const rows = readSheetRaw(FILES.main, '💰 GRANT & LOAN TRACKER');
  const dataRows = rows.slice(4).filter((r) => {
    const arr = r as unknown[];
    return arr[1] && String(arr[1]).trim();
  });

  let count = 0;
  for (const raw of dataRows) {
    const r = raw as unknown[];
    const clientName = str(r[1]);
    if (!clientName) continue;

    const bdoId = await getOrCreateBdo(str(r[2]), 'TRADELINE');

    await prisma.grantLoanTracker.create({
      data: {
        clientName,
        bdoId,
        grantLoanType: str(r[3]),
        funderDfi: str(r[4]),
        sectorValueChain: str(r[5]),
        amountApplied: str(r[6]),
        amountApproved: num(r[7]),
        disbursed: num(r[8]),
        applicationDate: parseDate(r[9]),
        decisionDate: parseDate(r[10]),
        status: normGrantStatus(r[11]),
        commissionPct: 10,
        commissionReceived: num(r[13]),
        notes: str(r[14]),
      },
    }).catch(() => {});
    count++;
  }
  console.log(`  ${count} grant/loan records seeded`);
}

async function seedConsolidated() {
  console.log('Seeding Consolidated Registry...');
  const rows = readSheetRaw(FILES.main, '🔗 CONSOLIDATED');
  const dataRows = rows.slice(4).filter((r) => {
    const arr = r as unknown[];
    return arr[1] && String(arr[1]).trim();
  });

  let count = 0;
  for (const raw of dataRows) {
    const r = raw as unknown[];
    const businessName = str(r[1]);
    if (!businessName) continue;

    const sourceFirmRaw = String(r[10] ?? '').toUpperCase();
    const sourceFirm: Company | null = sourceFirmRaw.includes('BAPX') ? 'BAPX'
      : sourceFirmRaw.includes('TRADELINE') ? 'TRADELINE' : null;

    const dupRaw = String(r[9] ?? '').toLowerCase();
    const duplicateFlag = dupRaw === 'yes' || dupRaw === 'true' || dupRaw === 'duplicate';

    await prisma.consolidatedRecord.create({
      data: {
        serialNo: num(r[0]) ? Math.round(num(r[0])!) : null,
        businessName,
        contactPerson: str(r[2]),
        emailPhone: str(r[3]),
        region: str(r[4]),
        valueChain: str(r[5]),
        dealValue: num(r[6]),
        priority: r[7] ? normPriority(r[7]) : null,
        pipelineStatus: str(r[8]),
        duplicateFlag,
        sourceFirm,
        assignedBdo: str(r[11]),
      },
    }).catch(() => {});
    count++;
  }
  console.log(`  ${count} consolidated records seeded`);
}

async function seedFredActivityLog() {
  console.log('Seeding Fred Activity Log...');
  const rows = readSheetRaw(FILES.main, '👤 FRED — ACTIVITY LOG');
  const dataRows = rows.slice(3).filter((r) => {
    const arr = r as unknown[];
    return arr[2] && String(arr[2]).trim();
  });

  const fredId = bdoCache.get('frederick phillips') ?? bdoCache.get('fred') ?? null;

  let count = 0;
  for (const raw of dataRows) {
    const r = raw as unknown[];
    const description = str(r[2]);
    if (!description) continue;

    await prisma.activityLog.create({
      data: {
        taskNo: num(r[0]) ? Math.round(num(r[0])!) : null,
        category: str(r[1]),
        description,
        startWeek: str(r[3]),
        endWeek: str(r[4]),
        progress: num(r[5]) ?? 0,
        status: normTaskStatus(r[6]),
        notes: str(r[7]),
        bdoId: fredId,
      },
    }).catch(() => {});
    count++;
  }
  console.log(`  ${count} activity log entries seeded`);
}

async function seedSchemeOfWork() {
  console.log('Seeding Scheme of Work...');

  const mainRows = readSheetRaw(FILES.main, '📅 SCHEME OF WORK');
  const mainData = mainRows.slice(4).filter((r) => {
    const arr = r as unknown[];
    return arr[2] && String(arr[2]).trim();
  });

  const sowRows = readSheetRaw(FILES.sow, 'Jan-Dec 2026 (2)');
  const sowData = sowRows.slice(3).filter((r) => {
    const arr = r as unknown[];
    return arr[0] && String(arr[0]).trim();
  });

  let count = 0;

  for (const raw of mainData) {
    const r = raw as unknown[];
    const deliverable = str(r[2]);
    if (!deliverable) continue;

    const bdoId = await getOrCreateBdo(str(r[4]), 'TRADELINE');

    await prisma.task.create({
      data: {
        year: num(r[0]) ? Math.round(num(r[0])!) : 2026,
        priority: normPriority(r[1]),
        deliverable,
        targetDate: str(r[3]),
        bdoId,
        status: 'PENDING',
        company: 'TRADELINE',
      },
    }).catch(() => {});
    count++;
  }

  for (const raw of sowData) {
    const r = raw as unknown[];
    const deliverable = str(r[0]);
    if (!deliverable) continue;
    if (deliverable.toUpperCase().includes('SCHEME') || deliverable.toUpperCase().includes('HIGH')) continue;

    const bdoId = await getOrCreateBdo(str(r[2]), 'TRADELINE');

    await prisma.task.create({
      data: {
        year: 2026,
        priority: normPriority(r[3] ?? 'High'),
        deliverable,
        targetDate: str(r[5]),
        bdoId,
        status: 'PENDING',
        company: 'TRADELINE',
      },
    }).catch(() => {});
    count++;
  }

  console.log(`  ${count} tasks seeded`);
}

async function seedLeadsFromBdDb() {
  console.log('Seeding additional leads from BD Database...');
  const rows = readSheetRaw(FILES.bd, 'LEADS');
  const dataRows = rows.slice(1).filter((r) => {
    const arr = r as unknown[];
    return arr[0] && String(arr[0]).trim();
  });

  // Pre-fetch all existing business names in one query
  const existing = await prisma.lead.findMany({ select: { businessName: true } });
  const existingNames = new Set(existing.map((l) => l.businessName));

  const records = dataRows
    .map((raw) => {
      const r = raw as unknown[];
      const businessName = str(r[0]);
      if (!businessName || existingNames.has(businessName)) return null;
      return { businessName, email: str(r[1]), contactPerson: str(r[2]), roleTitle: str(r[3]), status: 'NEW' as const, source: 'Database' };
    })
    .filter(Boolean) as Parameters<typeof prisma.lead.create>[0]['data'][];

  const CHUNK = 20;
  let count = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    await Promise.all(records.slice(i, i + CHUNK).map((data) => prisma.lead.create({ data }).catch(() => {})));
    count += Math.min(CHUNK, records.length - i);
  }
  console.log(`  ${count} additional leads seeded from BD Database`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedKpi() {
  console.log('Seeding KPI Scorecard...');
  const rows = readSheetRaw(FILES.main, '📈 KPI SCORECARD');
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i] as unknown[];
    if (r && String(r[0] ?? '').toUpperCase().replace(/\s+/g, ' ').includes('KPI METRIC')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) { console.log('  KPI SCORECARD sheet headers not found'); return; }

  const month = new Date('2026-06-01');
  let count = 0;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const kpiMetric = str(r[0]);
    if (!kpiMetric) continue;

    const company: Company = kpiMetric.toLowerCase().includes('bapx') ? 'BAPX' : 'TRADELINE';
    const targetRaw = str(r[3]);
    let benchmarkTarget: number | null = null;
    if (targetRaw) {
      const m = targetRaw.replace(/,/g, '').match(/\d+\.?\d*/);
      if (m) benchmarkTarget = parseFloat(m[0]);
    }

    await prisma.kpiScorecard.create({
      data: { month, company, kpiMetric, currentValue: num(r[1]), unit: str(r[2]), benchmarkTarget, status: str(r[4]), managementNotes: str(r[5]) },
    }).catch(() => {});
    count++;
  }
  console.log(`  ${count} KPI records seeded`);
}

async function main() {
  console.log('\n🌱 Starting seed...\n');

  console.log('Clearing existing data...');
  await prisma.activityLog.deleteMany();
  await prisma.monthlyKpi.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.grantLoanTracker.deleteMany();
  await prisma.kpiScorecard.deleteMany();
  await prisma.task.deleteMany();
  await prisma.consolidatedRecord.deleteMany();
  await prisma.partnership.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.bapxDeal.deleteMany();
  await prisma.tradelineDeal.deleteMany();
  await prisma.sME.deleteMany();
  await prisma.bDO.deleteMany();
  console.log('  Done\n');

  await seedBdos();
  await seedSme();
  await seedBapxPipeline();
  await seedTradelinePipeline();
  await seedLeads();
  await seedLeadsFromBdDb();
  await seedPartnerships();
  await seedGrantLoans();
  await seedKpi();
  await seedConsolidated();
  await seedFredActivityLog();
  await seedSchemeOfWork();

  console.log('\n✅ Seed complete!\n');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
