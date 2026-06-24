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

const router = Router();

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
