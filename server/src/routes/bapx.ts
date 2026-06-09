import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { DealHealth, DealStage, Priority } from '@prisma/client';

const router = Router();

// GET /api/bapx?bdo=&stage=&health=&priority=
router.get('/', async (req: Request, res: Response) => {
  try {
    const { bdo, stage, health, priority, search } = req.query;
    const deals = await prisma.bapxDeal.findMany({
      where: {
        ...(bdo ? { bdo: { name: { contains: String(bdo), mode: 'insensitive' } } } : {}),
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
    res.status(500).json({ error: 'Failed to fetch BAPX deals' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const deal = await prisma.bapxDeal.findUnique({
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
    const deal = await prisma.bapxDeal.create({ data: req.body });
    res.status(201).json(deal);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create deal', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const deal = await prisma.bapxDeal.update({
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
    await prisma.bapxDeal.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete deal' });
  }
});

export default router;
