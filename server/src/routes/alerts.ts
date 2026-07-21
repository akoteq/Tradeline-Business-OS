import { Router, Request, Response } from 'express';
import { TradelineDeal } from '../models/TradelineDeal';
import { BapxDeal } from '../models/BapxDeal';
import { CompanyDeal } from '../models/CompanyDeal';
import { Task } from '../models/Task';
import { KpiEntry } from '../models/KpiEntry';
import { KpiDefinition, computeAttainment } from '../models/KpiDefinition';
import { withBdo, bdoIdsByName } from '../lib/mongoUtils';
import { qs } from '../lib/query';

const router = Router();

const STALE_DAYS = 14;
const DEADLINE_WINDOW_DAYS = 7;
const OPEN_HEALTH = { $nin: ['CLOSED_WON', 'CLOSED_LOST'] };
const HIGH_VALUE = 100000; // GHS — deals at or above this get escalated harder

type Urgency = 'overdue' | 'today' | '1day' | '3days' | 'week';

function daysBetween(later: Date, earlier: Date) {
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

// Escalation rises the longer an item is unactioned: BDO → Senior BDO → Company Head → Executive.
function escalate(daysOverdue: number): { severity: 'low' | 'medium' | 'high' | 'critical'; escalatedTo: string } {
  if (daysOverdue >= 14) return { severity: 'critical', escalatedTo: 'Executive' };
  if (daysOverdue >= 7) return { severity: 'high', escalatedTo: 'Company Head' };
  if (daysOverdue >= 3) return { severity: 'medium', escalatedTo: 'Senior BDO' };
  return { severity: 'low', escalatedTo: 'BDO' };
}

function monthBounds(): { start: Date; end: Date } {
  const n = new Date();
  return {
    start: new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)),
    end: new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1)),
  };
}

function urgencyForDaysUntil(days: number): Urgency {
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 1) return '1day';
  if (days <= 3) return '3days';
  return 'week';
}

// Computes every alert category for an optional BDO scope. Shared by the GET /api/alerts
// endpoint and the email-digest notification so both stay in sync.
export async function computeAlerts(opts: { bdo?: string | null; bdoId?: string | null } = {}) {
    const { bdo, bdoId } = opts;
    const dealFilter: Record<string, unknown> = {};
    if (bdo) {
      const ids = await bdoIdsByName(bdo);
      dealFilter.bdoId = { $in: ids };
    }
    if (bdoId) dealFilter.bdoId = bdoId;

    const now = new Date();
    const windowEnd = new Date(now.getTime() + DEADLINE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const staleThreshold = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);

    // Deadlines — only TradelineDeal currently tracks a real due date
    const dueSoonDocs = await TradelineDeal.find({
      ...dealFilter,
      dueDate: { $ne: null, $lte: windowEnd },
      dealStage: OPEN_HEALTH,
      dealHealth: OPEN_HEALTH,
    }).sort({ dueDate: 1 });

    const dueSoonJson = await withBdo(dueSoonDocs);
    const dealDeadlines = dueSoonJson.map((d) => {
      const dueDate = new Date(d.dueDate as string);
      const days = daysBetween(dueDate, now);
      return {
        id: d.id as string,
        type: 'TRADELINE' as const,
        subtype: 'Tradeline',
        businessName: d.businessName as string,
        dueDate: d.dueDate,
        daysUntil: days,
        urgency: urgencyForDaysUntil(days),
        bdo: d.bdo as { id: string; name: string } | null,
      };
    });

    // Scheme-of-Work deadlines — tasks/proposals with an approaching target date
    const dueSoonTasks = await Task.find({
      ...dealFilter,
      targetDate: { $ne: null, $lte: windowEnd },
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
    }).sort({ targetDate: 1 });

    const taskJson = await withBdo(dueSoonTasks);
    const taskDeadlines = taskJson.map((t) => {
      const dueDate = new Date(t.targetDate as string);
      const days = daysBetween(dueDate, now);
      return {
        id: t.id as string,
        type: 'TASK' as const,
        subtype: t.type === 'PROPOSAL' ? 'Proposal' : 'Task',
        businessName: t.deliverable as string,
        dueDate: t.targetDate,
        daysUntil: days,
        urgency: urgencyForDaysUntil(days),
        bdo: t.bdo as { id: string; name: string } | null,
      };
    });

    const deadlines = [...dealDeadlines, ...taskDeadlines].sort((a, b) => a.daysUntil - b.daysUntil);

    // Stale deals — open deals with no updates in a while
    const [staleBapx, staleTradeline, staleCompany] = await Promise.all([
      BapxDeal.find({ ...dealFilter, updatedAt: { $lte: staleThreshold }, dealHealth: OPEN_HEALTH }).sort({ updatedAt: 1 }),
      TradelineDeal.find({ ...dealFilter, updatedAt: { $lte: staleThreshold }, dealHealth: OPEN_HEALTH }).sort({ updatedAt: 1 }),
      CompanyDeal.find({ ...dealFilter, updatedAt: { $lte: staleThreshold }, dealHealth: OPEN_HEALTH }).sort({ updatedAt: 1 }),
    ]);

    const toStale = async (docs: typeof staleBapx | typeof staleTradeline | typeof staleCompany, type: 'BAPX' | 'TRADELINE' | 'COMPANY') => {
      const json = await withBdo(docs);
      return json.map((d) => ({
        id: d.id as string,
        type,
        businessName: d.businessName as string,
        dealHealth: d.dealHealth as string,
        lastUpdated: d.updatedAt,
        daysSinceUpdate: daysBetween(now, new Date(d.updatedAt as string)),
        bdo: d.bdo as { id: string; name: string } | null,
      }));
    };

    const stale = [
      ...(await toStale(staleBapx, 'BAPX')),
      ...(await toStale(staleTradeline, 'TRADELINE')),
      ...(await toStale(staleCompany, 'COMPANY')),
    ].sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

    // ── Overdue payments (Tradeline + Company deals) ──────────────────────────
    const [tlPay, coPay] = await Promise.all([
      TradelineDeal.find({ ...dealFilter, $or: [{ paymentStatus: 'OVERDUE' }, { invoiceStatus: 'OVERDUE' }] }),
      CompanyDeal.find({ ...dealFilter, $or: [{ paymentStatus: 'OVERDUE' }, { invoiceStatus: 'OVERDUE' }] }),
    ]);
    const payMap = async (docs: typeof tlPay, type: 'TRADELINE' | 'COMPANY') => (await withBdo(docs)).map((d) => {
      const balance = (d.balanceGhs as number) ?? 0;
      const sev = balance >= HIGH_VALUE ? escalate(7) : balance >= 20000 ? escalate(3) : escalate(0);
      return { id: d.id as string, type, businessName: d.businessName as string, company: (d.company as string) ?? type, balance, bdo: d.bdo as { id: string; name: string } | null, ...sev };
    });
    const payments = [...(await payMap(tlPay, 'TRADELINE')), ...(await payMap(coPay, 'COMPANY'))].sort((a, b) => b.balance - a.balance);

    // ── High-value deals at risk ──────────────────────────────────────────────
    const riskQuery = { ...dealFilter, dealHealth: { $in: ['AT_RISK', 'STALE'] } };
    const [tlRisk, coRisk] = await Promise.all([
      TradelineDeal.find({ ...riskQuery, revenuePotentialGhs: { $gte: HIGH_VALUE } }).sort({ revenuePotentialGhs: -1 }).limit(8),
      CompanyDeal.find({ ...riskQuery, revenuePotentialGhs: { $gte: HIGH_VALUE } }).sort({ revenuePotentialGhs: -1 }).limit(8),
    ]);
    const riskMap = async (docs: typeof tlRisk, type: 'TRADELINE' | 'COMPANY') => (await withBdo(docs)).map((d) => ({
      id: d.id as string, type, businessName: d.businessName as string, company: (d.company as string) ?? type,
      value: (d.revenuePotentialGhs as number) ?? 0, dealHealth: d.dealHealth as string,
      bdo: d.bdo as { id: string; name: string } | null,
      severity: 'high' as const, escalatedTo: 'Executive',
    }));
    const highValueRisks = [...(await riskMap(tlRisk, 'TRADELINE')), ...(await riskMap(coRisk, 'COMPANY'))].sort((a, b) => b.value - a.value);

    // ── KPIs below target this month ──────────────────────────────────────────
    const { start, end } = monthBounds();
    const entryFilter: Record<string, unknown> = { period: { $gte: start, $lt: end } };
    if (dealFilter.bdoId) entryFilter.bdoId = dealFilter.bdoId;
    const kpiEntries = await KpiEntry.find(entryFilter);
    const defIds = [...new Set(kpiEntries.map((e) => e.get('definitionId')))];
    const defs = defIds.length ? await KpiDefinition.find({ _id: { $in: defIds } }) : [];
    const defMap: Record<string, { metric: string; department: string; higherIsBetter: boolean }> = {};
    defs.forEach((d) => { defMap[d.id] = { metric: d.get('metric'), department: d.get('department'), higherIsBetter: d.get('higherIsBetter') }; });
    const kpiRisks = kpiEntries
      .map((e) => {
        const def = defMap[e.get('definitionId')];
        if (!def) return null;
        const { status, attainment } = computeAttainment(e.get('current'), e.get('target'), def.higherIsBetter);
        if (status !== 'OFF_TRACK') return null;
        return { id: e.id as string, metric: def.metric, department: def.department, current: e.get('current'), target: e.get('target'), attainment, bdoId: e.get('bdoId'), severity: 'high' as const, escalatedTo: 'Senior BDO' };
      })
      .filter(Boolean);

    const criticalCount = payments.filter((a) => a.severity === 'critical').length + highValueRisks.length;
    const total = deadlines.length + stale.length + payments.length + highValueRisks.length + kpiRisks.length;

    return { deadlines, stale, payments, highValueRisks, kpiRisks, summary: { total, critical: criticalCount } };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await computeAlerts({ bdo: qs(req, 'bdo'), bdoId: qs(req, 'bdoId') });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

export default router;
