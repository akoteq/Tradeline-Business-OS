import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Company } from '@prisma/client';
import { qs, param } from '../lib/query';

const router = Router();

function pickFields(body: Record<string, unknown>) {
  const { name, email, phone, company, role, isActive } = body;
  return {
    ...(name !== undefined ? { name: name as string } : {}),
    ...(email !== undefined ? { email: (email as string | null) || null } : {}),
    ...(phone !== undefined ? { phone: (phone as string | null) || null } : {}),
    ...(company !== undefined ? { company: company as Company } : {}),
    ...(role !== undefined ? { role: (role as string | null) || null } : {}),
    ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
  };
}

// Must be defined before /:id to avoid "performance" being treated as an id
router.get('/performance', async (_req: Request, res: Response) => {
  try {
    const [bdos, bapxDeals, tradelineDeals, leads, tasks] = await Promise.all([
      prisma.bDO.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.bapxDeal.findMany({ select: { bdoId: true } }),
      prisma.tradelineDeal.findMany({ select: { bdoId: true, revenueReceivedGhs: true, revenuePotentialGhs: true } }),
      prisma.lead.findMany({ select: { bdoId: true } }),
      prisma.task.findMany({ select: { bdoId: true, status: true } }),
    ]);

    const result = bdos.map((bdo) => {
      const bdoTasks = tasks.filter((t) => t.bdoId === bdo.id);
      const completed = bdoTasks.filter((t) => t.status === 'COMPLETED').length;
      const open = bdoTasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status)).length;
      const overdue = bdoTasks.filter((t) => t.status === 'OVERDUE').length;
      const bdoTradeline = tradelineDeals.filter((t) => t.bdoId === bdo.id);

      return {
        bdo,
        bapxDeals: bapxDeals.filter((d) => d.bdoId === bdo.id).length,
        tradelineDeals: bdoTradeline.length,
        leads: leads.filter((l) => l.bdoId === bdo.id).length,
        tasks: { total: open + completed, open, completed, overdue },
        revenue: {
          received: bdoTradeline.reduce((s, t) => s + (t.revenueReceivedGhs ?? 0), 0),
          potential: bdoTradeline.reduce((s, t) => s + (t.revenuePotentialGhs ?? 0), 0),
        },
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BDO performance', detail: String(err) });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const company = qs(req, 'company');
    const bdos = await prisma.bDO.findMany({
      where: { ...(company ? { company: company as Company } : {}), isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(bdos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BDOs' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bdo = await prisma.bDO.findUnique({ where: { id: param(req, 'id') } });
    if (!bdo) return res.status(404).json({ error: 'Not found' });
    res.json(bdo);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BDO' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    if (!data.name) return res.status(400).json({ error: 'name is required' });
    if (!data.company) return res.status(400).json({ error: 'company is required' });
    const bdo = await prisma.bDO.create({ data: data as Parameters<typeof prisma.bDO.create>[0]['data'] });
    res.status(201).json(bdo);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create BDO', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    const bdo = await prisma.bDO.update({ where: { id: param(req, 'id') }, data });
    res.json(bdo);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update BDO', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = param(req, 'id');
    const [bapx, tradeline, leads] = await Promise.all([
      prisma.bapxDeal.count({ where: { bdoId: id } }),
      prisma.tradelineDeal.count({ where: { bdoId: id } }),
      prisma.lead.count({ where: { bdoId: id } }),
    ]);
    if (bapx + tradeline + leads > 0) {
      return res.status(409).json({ error: `Cannot delete: BDO still has ${bapx + tradeline} deals and ${leads} leads. Reassign them first.` });
    }
    await prisma.bDO.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete BDO', detail: String(err) });
  }
});

export default router;
