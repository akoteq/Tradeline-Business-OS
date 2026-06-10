import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { GrantLoanStatus } from '@prisma/client';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), status = qs(req, 'status'), search = qs(req, 'search');
    const grants = await prisma.grantLoanTracker.findMany({
      where: {
        ...(bdo ? { bdo: { name: { contains: bdo, mode: 'insensitive' } } } : {}),
        ...(status ? { status: status as GrantLoanStatus } : {}),
        ...(search ? { clientName: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { bdo: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(grants);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch grant/loan records' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const g = await prisma.grantLoanTracker.findUnique({ where: { id: param(req, 'id') }, include: { bdo: true } });
    if (!g) return res.status(404).json({ error: 'Not found' });
    res.json(g);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const g = await prisma.grantLoanTracker.create({ data: req.body });
    res.status(201).json(g);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create record', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const g = await prisma.grantLoanTracker.update({ where: { id: param(req, 'id') }, data: req.body });
    res.json(g);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update record', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.grantLoanTracker.delete({ where: { id: param(req, 'id') } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete record' });
  }
});

export default router;
