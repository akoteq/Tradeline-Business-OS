import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Company } from '@prisma/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { company } = req.query;
    const bdos = await prisma.bDO.findMany({
      where: {
        ...(company ? { company: company as Company } : {}),
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(bdos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BDOs' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const bdo = await prisma.bDO.create({ data: req.body });
    res.status(201).json(bdo);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create BDO', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const bdo = await prisma.bDO.update({ where: { id: req.params.id }, data: req.body });
    res.json(bdo);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update BDO', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.bDO.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to deactivate BDO' });
  }
});

export default router;
