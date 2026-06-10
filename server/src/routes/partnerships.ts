import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { PartnershipStatus } from '@prisma/client';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const status = qs(req, 'status'), country = qs(req, 'country'), search = qs(req, 'search');
    const partnerships = await prisma.partnership.findMany({
      where: {
        ...(status ? { status: status as PartnershipStatus } : {}),
        ...(country ? { country: { contains: country, mode: 'insensitive' } } : {}),
        ...(search ? { partnerOrganisation: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(partnerships);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch partnerships' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const p = await prisma.partnership.findUnique({ where: { id: param(req, 'id') } });
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch partnership' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const p = await prisma.partnership.create({ data: req.body });
    res.status(201).json(p);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create partnership', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const p = await prisma.partnership.update({ where: { id: param(req, 'id') }, data: req.body });
    res.json(p);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update partnership', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.partnership.delete({ where: { id: param(req, 'id') } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete partnership' });
  }
});

export default router;
