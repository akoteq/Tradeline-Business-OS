import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Priority, Company } from '@prisma/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { priority, source, duplicate, search } = req.query;
    const records = await prisma.consolidatedRecord.findMany({
      where: {
        ...(priority ? { priority: priority as Priority } : {}),
        ...(source ? { sourceFirm: source as Company } : {}),
        ...(duplicate !== undefined ? { duplicateFlag: duplicate === 'true' } : {}),
        ...(search ? { businessName: { contains: String(search), mode: 'insensitive' } } : {}),
      },
      orderBy: { serialNo: 'asc' },
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch consolidated records' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const r = await prisma.consolidatedRecord.create({ data: req.body });
    res.status(201).json(r);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create record', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const r = await prisma.consolidatedRecord.update({ where: { id: req.params.id }, data: req.body });
    res.json(r);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update record', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.consolidatedRecord.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete record' });
  }
});

export default router;
