import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Tier, DealStage, Priority, DealHealth } from '@prisma/client';

const router = Router();

// GET /api/tradeline?bdo=&tier=&stage=&health=&priority=
router.get('/', async (req: Request, res: Response) => {
  try {
    const { bdo, tier, stage, health, priority, search } = req.query;
    const deals = await prisma.tradelineDeal.findMany({
      where: {
        ...(bdo ? { bdo: { name: { contains: String(bdo), mode: 'insensitive' } } } : {}),
        ...(tier ? { tier: tier as Tier } : {}),
        ...(stage ? { dealStage: stage as DealStage } : {}),
        ...(health ? { dealHealth: health as DealHealth } : {}),
        ...(priority ? { priority: priority as Priority } : {}),
        ...(search ? { businessName: { contains: String(search), mode: 'insensitive' } } : {}),
      },
      include: { bdo: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Tradeline deals' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const deal = await prisma.tradelineDeal.findUnique({
      where: { id: req.params.id },
      include: { bdo: true, sme: true },
    });
    if (!deal) return res.status(404).json({ error: 'Not found' });
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const deal = await prisma.tradelineDeal.create({ data: req.body });
    res.status(201).json(deal);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create deal', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const deal = await prisma.tradelineDeal.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(deal);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update deal', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.tradelineDeal.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete deal' });
  }
});

export default router;
