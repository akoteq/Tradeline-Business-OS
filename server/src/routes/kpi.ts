import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Company } from '@prisma/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { company, month } = req.query;
    const kpis = await prisma.kpiScorecard.findMany({
      where: {
        ...(company ? { company: company as Company } : {}),
        ...(month ? { month: { gte: new Date(String(month)) } } : {}),
      },
      orderBy: { month: 'desc' },
    });
    res.json(kpis);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const kpi = await prisma.kpiScorecard.create({ data: req.body });
    res.status(201).json(kpi);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create KPI', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const kpi = await prisma.kpiScorecard.update({ where: { id: req.params.id }, data: req.body });
    res.json(kpi);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update KPI', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.kpiScorecard.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete KPI' });
  }
});

export default router;
