import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// CEO overview — aggregated stats across both companies
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
    ] = await Promise.all([
      prisma.bapxDeal.count(),
      prisma.bapxDeal.groupBy({ by: ['dealStage'], _count: { _all: true } }),
      prisma.bapxDeal.groupBy({ by: ['dealHealth'], _count: { _all: true } }),
      prisma.tradelineDeal.count(),
      prisma.tradelineDeal.groupBy({ by: ['dealStage'], _count: { _all: true } }),
      prisma.tradelineDeal.aggregate({
        _sum: { revenueReceivedGhs: true, revenuePotentialGhs: true, balanceGhs: true },
      }),
      prisma.lead.count(),
      prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.sME.count(),
      prisma.partnership.count({ where: { status: 'ACTIVE' } }),
      prisma.grantLoanTracker.count({
        where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] } },
      }),
      prisma.task.count({ where: { status: 'OVERDUE' } }),
    ]);

    res.json({
      bapx: {
        total: bapxTotal,
        byStage: bapxByStage,
        byHealth: bapxByHealth,
      },
      tradeline: {
        total: tradelineTotal,
        byStage: tradelineByStage,
        revenueReceived: tradelineRevenue._sum.revenueReceivedGhs ?? 0,
        revenuePotential: tradelineRevenue._sum.revenuePotentialGhs ?? 0,
        outstanding: tradelineRevenue._sum.balanceGhs ?? 0,
      },
      leads: { total: totalLeads, byStatus: leadsByStatus },
      smes: { total: totalSmes },
      partnerships: { active: totalPartnerships },
      grants: { inFlight: grantsInFlight },
      tasks: { overdue: overdueTasks },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch CEO dashboard data' });
  }
});

// Per-BDO summary
router.get('/bdo/:id', async (req: Request, res: Response) => {
  try {
    const bdoId = String(req.params.id ?? '');
    const [bdo, bapxDeals, tradelineDeals, leads, tasks, activityLogs] = await Promise.all([
      prisma.bDO.findUnique({ where: { id: bdoId } }),
      prisma.bapxDeal.findMany({ where: { bdoId }, orderBy: { updatedAt: 'desc' } }),
      prisma.tradelineDeal.findMany({ where: { bdoId }, orderBy: { updatedAt: 'desc' } }),
      prisma.lead.findMany({ where: { bdoId }, orderBy: { createdAt: 'desc' } }),
      prisma.task.findMany({ where: { bdoId }, orderBy: { createdAt: 'desc' } }),
      prisma.activityLog.findMany({ where: { bdoId }, orderBy: { taskNo: 'asc' } }),
    ]);
    if (!bdo) return res.status(404).json({ error: 'BDO not found' });
    res.json({ bdo, bapxDeals, tradelineDeals, leads, tasks, activityLogs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BDO dashboard' });
  }
});

export default router;
