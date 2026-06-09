import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { TaskStatus } from '@prisma/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { bdo, status, category } = req.query;
    const logs = await prisma.activityLog.findMany({
      where: {
        ...(bdo ? { bdo: { name: { contains: String(bdo), mode: 'insensitive' } } } : {}),
        ...(status ? { status: status as TaskStatus } : {}),
        ...(category ? { category: { contains: String(category), mode: 'insensitive' } } : {}),
      },
      include: { bdo: true },
      orderBy: [{ taskNo: 'asc' }],
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const log = await prisma.activityLog.create({ data: req.body });
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create log', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const log = await prisma.activityLog.update({ where: { id: req.params.id }, data: req.body });
    res.json(log);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update log', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.activityLog.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete log' });
  }
});

export default router;
