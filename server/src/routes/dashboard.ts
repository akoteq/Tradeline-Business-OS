import { Router, Request, Response } from 'express';
import { BapxDeal } from '../models/BapxDeal';
import { TradelineDeal } from '../models/TradelineDeal';
import { CompanyDeal, COMPANY_KEYS } from '../models/CompanyDeal';
import { Lead } from '../models/Lead';
import { SME } from '../models/SME';
import { Partnership } from '../models/Partnership';
import { GrantLoanTracker } from '../models/GrantLoanTracker';
import { Task } from '../models/Task';
import { ActivityLog } from '../models/ActivityLog';
import { BDO } from '../models/BDO';
import { Project } from '../models/Project';
import { Company } from '../models/Company';
import { KpiEntry } from '../models/KpiEntry';
import { KpiDefinition, computeAttainment } from '../models/KpiDefinition';

const router = Router();

function monthBounds(period?: string): { start: Date; end: Date } {
  const base = period ? new Date(period.length === 7 ? `${period}-01` : period) : new Date();
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  return { start, end };
}

async function companyStats(company: string) {
  const [total, byStage, byHealth, revenue] = await Promise.all([
    CompanyDeal.countDocuments({ company }),
    CompanyDeal.aggregate([{ $match: { company } }, { $group: { _id: '$dealStage', count: { $sum: 1 } } }]),
    CompanyDeal.aggregate([{ $match: { company } }, { $group: { _id: '$dealHealth', count: { $sum: 1 } } }]),
    CompanyDeal.aggregate([{ $match: { company } }, { $group: { _id: null, revenueReceived: { $sum: '$revenueReceivedGhs' }, revenuePotential: { $sum: '$revenuePotentialGhs' }, balance: { $sum: '$balanceGhs' } } }]),
  ]);
  const rev = revenue[0] ?? { revenueReceived: 0, revenuePotential: 0, balance: 0 };
  return {
    total,
    byStage: byStage.map((s) => ({ dealStage: s._id, _count: { _all: s.count } })),
    byHealth: byHealth.map((s) => ({ dealHealth: s._id, _count: { _all: s.count } })),
    revenueReceived:  rev.revenueReceived  ?? 0,
    revenuePotential: rev.revenuePotential ?? 0,
    outstanding:      rev.balance          ?? 0,
  };
}

router.get('/ceo', async (_req: Request, res: Response) => {
  try {
    const [
      bapxTotal,
      bapxByStage,
      bapxByHealth,
      tradelineTotal,
      tradelineByStage,
      tradelineRevenue,
      totalLeads,
      leadsByStatus,
      totalSmes,
      totalPartnerships,
      grantsInFlight,
      overdueTasks,
      projectsTotal,
      projectsByStatus,
      projectsList,
      ...companyResults
    ] = await Promise.all([
      BapxDeal.countDocuments(),
      BapxDeal.aggregate([{ $group: { _id: '$dealStage', count: { $sum: 1 } } }]),
      BapxDeal.aggregate([{ $group: { _id: '$dealHealth', count: { $sum: 1 } } }]),
      TradelineDeal.countDocuments(),
      TradelineDeal.aggregate([{ $group: { _id: '$dealStage', count: { $sum: 1 } } }]),
      TradelineDeal.aggregate([{ $group: { _id: null, revenueReceived: { $sum: '$revenueReceivedGhs' }, revenuePotential: { $sum: '$revenuePotentialGhs' }, balance: { $sum: '$balanceGhs' } } }]),
      Lead.countDocuments(),
      Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      SME.countDocuments(),
      Partnership.countDocuments({ status: 'ACTIVE' }),
      GrantLoanTracker.countDocuments({ status: { $in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] } }),
      Task.countDocuments({ status: 'OVERDUE' }),
      Project.countDocuments(),
      Project.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Project.find().sort({ createdAt: 1 }),
      ...COMPANY_KEYS.map((c) => companyStats(c)),
    ]);

    const rev = tradelineRevenue[0] ?? { revenueReceived: 0, revenuePotential: 0, balance: 0 };

    const companies = Object.fromEntries(
      COMPANY_KEYS.map((key, i) => [key, companyResults[i]])
    );

    res.json({
      bapx: {
        total: bapxTotal,
        byStage: bapxByStage.map((s) => ({ dealStage: s._id, _count: { _all: s.count } })),
        byHealth: bapxByHealth.map((s) => ({ dealHealth: s._id, _count: { _all: s.count } })),
      },
      tradeline: {
        total: tradelineTotal,
        byStage: tradelineByStage.map((s) => ({ dealStage: s._id, _count: { _all: s.count } })),
        revenueReceived: rev.revenueReceived ?? 0,
        revenuePotential: rev.revenuePotential ?? 0,
        outstanding: rev.balance ?? 0,
      },
      companies,
      leads: {
        total: totalLeads,
        byStatus: leadsByStatus.map((s) => ({ status: s._id, _count: { _all: s.count } })),
      },
      smes: { total: totalSmes },
      partnerships: { active: totalPartnerships },
      grants: { inFlight: grantsInFlight },
      tasks: { overdue: overdueTasks },
      projects: {
        total: projectsTotal,
        byStatus: projectsByStatus.map((s) => ({ status: s._id, count: s.count })),
        list: projectsList.map((p) => p.toJSON()),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch CEO dashboard data' });
  }
});

// Normalized one-line summary for a company (used by the executive & all-companies views).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function companySummary(company: any) {
  const key = company.get('key');
  const source = company.get('dealSource') as 'BAPX' | 'TRADELINE' | 'COMPANY';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Model: any = CompanyDeal;
  let match: Record<string, unknown> = { company: key };
  if (source === 'BAPX') { Model = BapxDeal; match = {}; }
  else if (source === 'TRADELINE') { Model = TradelineDeal; match = {}; }

  const [total, active, closedWon, rev] = await Promise.all([
    Model.countDocuments(match),
    Model.countDocuments({ ...match, dealHealth: 'ACTIVE' }),
    Model.countDocuments({ ...match, dealStage: 'CLOSED_WON' }),
    source === 'BAPX'
      ? BapxDeal.aggregate([{ $group: { _id: null, t: { $sum: '$targetGhs' } } }])
      : Model.aggregate([{ $match: match }, { $group: { _id: null, p: { $sum: '$revenuePotentialGhs' }, rec: { $sum: '$revenueReceivedGhs' }, bal: { $sum: '$balanceGhs' } } }]),
  ]);
  const r = rev[0] ?? {};
  const revenue = source === 'BAPX'
    ? { potential: r.t ?? 0, received: 0, outstanding: 0 }
    : { potential: r.p ?? 0, received: r.rec ?? 0, outstanding: r.bal ?? 0 };
  return {
    key, name: company.get('name'), slug: company.get('slug'), color: company.get('color'),
    dealSource: source, total, active, closedWon, revenue,
  };
}

// Executive dashboard — group-wide roll-up across every company, KPI health for the period,
// and auto-surfaced top deals & top risks. Powers both /executive and /companies.
router.get('/executive', async (req: Request, res: Response) => {
  try {
    const companies = await Company.find({ isActive: true }).sort({ order: 1, name: 1 });
    const summaries = await Promise.all(companies.map(companySummary));
    const totals = summaries.reduce((a, s) => ({
      deals: a.deals + s.total,
      active: a.active + s.active,
      closedWon: a.closedWon + s.closedWon,
      potential: a.potential + s.revenue.potential,
      received: a.received + s.revenue.received,
      outstanding: a.outstanding + s.revenue.outstanding,
    }), { deals: 0, active: 0, closedWon: 0, potential: 0, received: 0, outstanding: 0 });

    // KPI health across all entries for the period
    const { start, end } = monthBounds(String(req.query.period ?? ''));
    const entries = await KpiEntry.find({ period: { $gte: start, $lt: end } });
    const defIds = [...new Set(entries.map((e) => e.get('definitionId')))];
    const defs = defIds.length ? await KpiDefinition.find({ _id: { $in: defIds } }) : [];
    const hib: Record<string, boolean> = {};
    defs.forEach((d) => { hib[d.id] = d.get('higherIsBetter'); });
    const kpiHealth = { onTrack: 0, atRisk: 0, offTrack: 0, noTarget: 0 };
    entries.forEach((e) => {
      const { status } = computeAttainment(e.get('current'), e.get('target'), hib[e.get('definitionId')] ?? true);
      if (status === 'ON_TRACK') kpiHealth.onTrack += 1;
      else if (status === 'AT_RISK') kpiHealth.atRisk += 1;
      else if (status === 'OFF_TRACK') kpiHealth.offTrack += 1;
      else kpiHealth.noTarget += 1;
    });

    const companyByKey: Record<string, string> = {};
    companies.forEach((c) => { companyByKey[c.get('key')] = c.get('name'); });

    // Top deals (by revenue potential) and top risks (at-risk/stale, by value) across pipelines.
    // BAPX deals use targetGhs as their revenue-potential figure.
    const risk = { dealHealth: { $in: ['AT_RISK', 'STALE'] } };
    const [tlTop, coTop, bapxTop, tlRisk, coRisk, bapxRisk] = await Promise.all([
      TradelineDeal.find().sort({ revenuePotentialGhs: -1 }).limit(6),
      CompanyDeal.find().sort({ revenuePotentialGhs: -1 }).limit(6),
      BapxDeal.find().sort({ targetGhs: -1 }).limit(6),
      TradelineDeal.find(risk).sort({ revenuePotentialGhs: -1 }).limit(6),
      CompanyDeal.find(risk).sort({ revenuePotentialGhs: -1 }).limit(6),
      BapxDeal.find(risk).sort({ targetGhs: -1 }).limit(6),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealRow = (d: any, company: string, amount: number) => ({
      businessName: d.get('businessName'), company, amount, dealStage: d.get('dealStage'), dealHealth: d.get('dealHealth'),
    });
    const topDeals = [
      ...tlTop.map((d) => dealRow(d, 'Tradeline Consult', d.get('revenuePotentialGhs') ?? 0)),
      ...coTop.map((d) => dealRow(d, companyByKey[d.get('company')] ?? d.get('company'), d.get('revenuePotentialGhs') ?? 0)),
      ...bapxTop.map((d) => dealRow(d, 'BAPX', d.get('targetGhs') ?? 0)),
    ].sort((a, b) => b.amount - a.amount).slice(0, 6);
    const topRisks = [
      ...tlRisk.map((d) => dealRow(d, 'Tradeline Consult', d.get('revenuePotentialGhs') ?? 0)),
      ...coRisk.map((d) => dealRow(d, companyByKey[d.get('company')] ?? d.get('company'), d.get('revenuePotentialGhs') ?? 0)),
      ...bapxRisk.map((d) => dealRow(d, 'BAPX', d.get('targetGhs') ?? 0)),
    ].sort((a, b) => b.amount - a.amount).slice(0, 8);

    res.json({ totals, companies: summaries, kpiHealth, topDeals, topRisks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch executive dashboard', detail: String(err) });
  }
});

// Per-company dashboard — normalizes the three deal shapes (BapxDeal / TradelineDeal / CompanyDeal)
// into one summary so any company (including admin-added ones) has its own dashboard.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dealAgg(Model: any, match: Record<string, unknown>) {
  const [total, byStage, byHealth, active, closedWon, invoiceAgg] = await Promise.all([
    Model.countDocuments(match),
    Model.aggregate([{ $match: match }, { $group: { _id: '$dealStage', count: { $sum: 1 } } }]),
    Model.aggregate([{ $match: match }, { $group: { _id: '$dealHealth', count: { $sum: 1 } } }]),
    Model.countDocuments({ ...match, dealHealth: 'ACTIVE' }),
    Model.countDocuments({ ...match, dealStage: 'CLOSED_WON' }),
    Model.aggregate([{ $match: match }, { $group: { _id: '$invoiceStatus', count: { $sum: 1 } } }]),
  ]);
  return { total, byStage, byHealth, active, closedWon, invoiceAgg };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dealCard = (d: any, amountField: 'revenueReceivedGhs' | 'targetGhs') => ({
  id: d.id,
  businessName: d.get('businessName'),
  dealStage: d.get('dealStage'),
  dealHealth: d.get('dealHealth'),
  received: amountField === 'revenueReceivedGhs' ? (d.get('revenueReceivedGhs') ?? 0) : 0,
  potential: d.get(amountField === 'revenueReceivedGhs' ? 'revenuePotentialGhs' : 'targetGhs') ?? 0,
  invoiceStatus: d.get('invoiceStatus') ?? 'NOT_INVOICED',
});

router.get('/company/:key', async (req: Request, res: Response) => {
  try {
    const key = String(req.params.key ?? '');
    const company = await Company.findOne({ key });
    if (!company) { res.status(404).json({ error: 'Company not found' }); return; }
    const source = company.get('dealSource') as 'BAPX' | 'TRADELINE' | 'COMPANY';

    let base;
    let revenue = { revenuePotential: 0, revenueReceived: 0, outstanding: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let topDeals: any[] = [];

    if (source === 'BAPX') {
      base = await dealAgg(BapxDeal, {});
      const r = await BapxDeal.aggregate([{ $group: { _id: null, t: { $sum: '$targetGhs' } } }]);
      revenue = { revenuePotential: r[0]?.t ?? 0, revenueReceived: 0, outstanding: 0 };
      topDeals = (await BapxDeal.find().sort({ targetGhs: -1 }).limit(10)).map((d) => dealCard(d, 'targetGhs'));
    } else if (source === 'TRADELINE') {
      base = await dealAgg(TradelineDeal, {});
      const r = await TradelineDeal.aggregate([{ $group: { _id: null, p: { $sum: '$revenuePotentialGhs' }, rec: { $sum: '$revenueReceivedGhs' }, bal: { $sum: '$balanceGhs' } } }]);
      const rr = r[0] ?? {}; revenue = { revenuePotential: rr.p ?? 0, revenueReceived: rr.rec ?? 0, outstanding: rr.bal ?? 0 };
      topDeals = (await TradelineDeal.find().sort({ revenuePotentialGhs: -1 }).limit(10)).map((d) => dealCard(d, 'revenueReceivedGhs'));
    } else {
      const match = { company: key };
      base = await dealAgg(CompanyDeal, match);
      const r = await CompanyDeal.aggregate([{ $match: match }, { $group: { _id: null, p: { $sum: '$revenuePotentialGhs' }, rec: { $sum: '$revenueReceivedGhs' }, bal: { $sum: '$balanceGhs' } } }]);
      const rr = r[0] ?? {}; revenue = { revenuePotential: rr.p ?? 0, revenueReceived: rr.rec ?? 0, outstanding: rr.bal ?? 0 };
      topDeals = (await CompanyDeal.find(match).sort({ revenuePotentialGhs: -1 }).limit(10)).map((d) => dealCard(d, 'revenueReceivedGhs'));
    }

    const [taskOpen, taskOverdue, taskCompleted] = await Promise.all([
      Task.countDocuments({ company: key, status: { $in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] } }),
      Task.countDocuments({ company: key, status: 'OVERDUE' }),
      Task.countDocuments({ company: key, status: 'COMPLETED' }),
    ]);

    res.json({
      company: company.toJSON(),
      source,
      total: base.total,
      active: base.active,
      closedWon: base.closedWon,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      byStage: base.byStage.map((s: any) => ({ dealStage: s._id, count: s.count })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      byHealth: base.byHealth.map((s: any) => ({ dealHealth: s._id, count: s.count })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoice: base.invoiceAgg.map((s: any) => ({ status: s._id ?? 'NOT_INVOICED', count: s.count })),
      revenue,
      topDeals,
      tasks: { open: taskOpen, overdue: taskOverdue, completed: taskCompleted },
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch company dashboard' });
  }
});

// Senior BDO dashboard — the senior plus everyone whose managerId points to them,
// with per-member pipeline / revenue / task / KPI-health rollups and team totals.
router.get('/senior/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? '');
    const senior = await BDO.findById(id);
    if (!senior) { res.status(404).json({ error: 'Senior BDO not found' }); return; }
    const reports = await BDO.find({ managerId: id, isActive: true }).sort({ name: 1 });
    const members = [senior, ...reports];
    const memberIds = members.map((m) => m.id as string);
    const { start, end } = monthBounds(String(req.query.period ?? ''));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const countBy = async (Model: any): Promise<Record<string, number>> => {
      const rows = await Model.aggregate([{ $match: { bdoId: { $in: memberIds } } }, { $group: { _id: '$bdoId', c: { $sum: 1 } } }]);
      const m: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows.forEach((r: any) => { if (r._id) m[String(r._id)] = r.c; });
      return m;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const revBy = async (Model: any) =>
      Model.aggregate([{ $match: { bdoId: { $in: memberIds } } }, { $group: { _id: '$bdoId', rec: { $sum: '$revenueReceivedGhs' }, pot: { $sum: '$revenuePotentialGhs' } } }]);

    const [bapxC, tlC, coC, tlRev, coRev, taskRows, entries] = await Promise.all([
      countBy(BapxDeal), countBy(TradelineDeal), countBy(CompanyDeal),
      revBy(TradelineDeal), revBy(CompanyDeal),
      Task.aggregate([{ $match: { bdoId: { $in: memberIds } } }, { $group: {
        _id: '$bdoId',
        open: { $sum: { $cond: [{ $in: ['$status', ['PENDING', 'IN_PROGRESS', 'OVERDUE']] }, 1, 0] } },
        overdue: { $sum: { $cond: [{ $eq: ['$status', 'OVERDUE'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
      } }]),
      KpiEntry.find({ bdoId: { $in: memberIds }, period: { $gte: start, $lt: end } }),
    ]);

    const revMap: Record<string, { rec: number; pot: number }> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [...tlRev, ...coRev].forEach((r: any) => {
      if (!r._id) return;
      const k = String(r._id);
      revMap[k] = revMap[k] || { rec: 0, pot: 0 };
      revMap[k].rec += r.rec || 0; revMap[k].pot += r.pot || 0;
    });
    const taskMap: Record<string, { open: number; overdue: number; completed: number }> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    taskRows.forEach((t: any) => { if (t._id) taskMap[String(t._id)] = { open: t.open, overdue: t.overdue, completed: t.completed }; });

    // KPI health per member for the period
    const defIds = [...new Set(entries.map((e) => e.get('definitionId')))];
    const defs = defIds.length ? await KpiDefinition.find({ _id: { $in: defIds } }) : [];
    const hib: Record<string, boolean> = {};
    defs.forEach((d) => { hib[d.id] = d.get('higherIsBetter'); });
    const kpiMap: Record<string, { onTrack: number; atRisk: number; offTrack: number }> = {};
    entries.forEach((e) => {
      const bId = e.get('bdoId'); if (!bId) return;
      const { status } = computeAttainment(e.get('current'), e.get('target'), hib[e.get('definitionId')] ?? true);
      const k = String(bId);
      kpiMap[k] = kpiMap[k] || { onTrack: 0, atRisk: 0, offTrack: 0 };
      if (status === 'ON_TRACK') kpiMap[k].onTrack += 1;
      else if (status === 'AT_RISK') kpiMap[k].atRisk += 1;
      else if (status === 'OFF_TRACK') kpiMap[k].offTrack += 1;
    });

    const memberRows = members.map((m) => {
      const mid = m.id as string;
      const deals = (bapxC[mid] || 0) + (tlC[mid] || 0) + (coC[mid] || 0);
      const rev = revMap[mid] || { rec: 0, pot: 0 };
      return {
        bdo: { id: mid, name: m.get('name'), company: m.get('company'), role: m.get('role') ?? null, isSelf: mid === id },
        deals,
        revenueReceived: rev.rec,
        revenuePotential: rev.pot,
        tasks: taskMap[mid] || { open: 0, overdue: 0, completed: 0 },
        kpi: kpiMap[mid] || { onTrack: 0, atRisk: 0, offTrack: 0 },
      };
    });

    const totals = memberRows.reduce((a, r) => ({
      members: a.members + 1,
      deals: a.deals + r.deals,
      revenueReceived: a.revenueReceived + r.revenueReceived,
      revenuePotential: a.revenuePotential + r.revenuePotential,
      tasksOpen: a.tasksOpen + r.tasks.open,
      tasksOverdue: a.tasksOverdue + r.tasks.overdue,
    }), { members: 0, deals: 0, revenueReceived: 0, revenuePotential: 0, tasksOpen: 0, tasksOverdue: 0 });

    res.json({
      senior: { id, name: senior.get('name'), company: senior.get('company'), role: senior.get('role') ?? null },
      members: memberRows,
      totals,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch senior BDO dashboard', detail: String(err) });
  }
});

router.get('/bdo/:id', async (req: Request, res: Response) => {
  try {
    const bdoId = String(req.params.id ?? '');
    const [bdo, bapxDeals, tradelineDeals, leads, tasks, activityLogs] = await Promise.all([
      BDO.findById(bdoId),
      BapxDeal.find({ bdoId }).sort({ updatedAt: -1 }),
      TradelineDeal.find({ bdoId }).sort({ updatedAt: -1 }),
      Lead.find({ bdoId }).sort({ createdAt: -1 }),
      Task.find({ bdoId }).sort({ createdAt: -1 }),
      ActivityLog.find({ bdoId }).sort({ taskNo: 1 }),
    ]);
    if (!bdo) { res.status(404).json({ error: 'BDO not found' }); return; }
    res.json({
      bdo: bdo.toJSON(),
      bapxDeals: bapxDeals.map((d) => d.toJSON()),
      tradelineDeals: tradelineDeals.map((d) => d.toJSON()),
      leads: leads.map((l) => l.toJSON()),
      tasks: tasks.map((t) => t.toJSON()),
      activityLogs: activityLogs.map((a) => a.toJSON()),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BDO dashboard' });
  }
});

export default router;
