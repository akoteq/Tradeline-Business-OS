import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { LeadStatus, Priority } from '@prisma/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { bdo, status, priority, search } = req.query;
    const leads = await prisma.lead.findMany({
      where: {
        ...(bdo ? { bdo: { name: { contains: String(bdo), mode: 'insensitive' } } } : {}),
        ...(status ? { status: status as LeadStatus } : {}),
        ...(priority ? { priority: priority as Priority } : {}),
        ...(search ? { businessName: { contains: String(search), mode: 'insensitive' } } : {}),
      },
      include: { bdo: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, include: { bdo: true } });
    if (!lead) return res.status(404).json({ error: 'Not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const lead = await prisma.lead.create({ data: req.body });
    res.status(201).json(lead);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create lead', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: req.body });
    res.json(lead);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update lead', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete lead' });
  }
});

export default router;
