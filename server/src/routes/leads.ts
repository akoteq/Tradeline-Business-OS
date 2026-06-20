import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { LeadStatus, Priority } from '@prisma/client';
import { qs, param } from '../lib/query';

const router = Router();

const INCLUDE = { bdo: true } as const;

function pickFields(body: Record<string, unknown>) {
  const {
    bizId, businessName, email, contactPerson, roleTitle, status,
    source, bdoId, priority, dateAdded, followUpDate, notes, smeId,
  } = body;

  return {
    ...(bizId !== undefined ? { bizId: bizId as string | null } : {}),
    ...(businessName !== undefined ? { businessName: businessName as string } : {}),
    ...(email !== undefined ? { email: (email as string | null) || null } : {}),
    ...(contactPerson !== undefined ? { contactPerson: (contactPerson as string | null) || null } : {}),
    ...(roleTitle !== undefined ? { roleTitle: (roleTitle as string | null) || null } : {}),
    ...(status !== undefined ? { status: status as LeadStatus } : {}),
    ...(source !== undefined ? { source: (source as string | null) || null } : {}),
    ...(bdoId !== undefined ? { bdoId: (bdoId as string | null) || null } : {}),
    ...(priority !== undefined ? { priority: priority ? priority as Priority : null } : {}),
    ...(dateAdded !== undefined ? { dateAdded: dateAdded ? new Date(dateAdded as string) : null } : {}),
    ...(followUpDate !== undefined ? { followUpDate: followUpDate ? new Date(followUpDate as string) : null } : {}),
    ...(notes !== undefined ? { notes: (notes as string | null) || null } : {}),
    ...(smeId !== undefined ? { smeId: (smeId as string | null) || null } : {}),
  };
}

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const groups = await prisma.lead.groupBy({ by: ['status'], _count: { _all: true } });
    const stats = Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
    res.json(stats);
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), status = qs(req, 'status'), priority = qs(req, 'priority');
    const search = qs(req, 'search'), source = qs(req, 'source');
    const limit = Math.min(parseInt(qs(req, 'limit') ?? '100'), 500);
    const skip = parseInt(qs(req, 'skip') ?? '0');
    const where = {
      ...(bdo ? { bdo: { name: { contains: bdo, mode: 'insensitive' as const } } } : {}),
      ...(status ? { status: status as LeadStatus } : {}),
      ...(priority ? { priority: priority as Priority } : {}),
      ...(search ? { businessName: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(source ? { source: { contains: source, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.lead.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, take: limit, skip }),
      prisma.lead.count({ where }),
    ]);
    res.json({ data, total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: param(req, 'id') }, include: INCLUDE });
    if (!lead) return res.status(404).json({ error: 'Not found' });
    res.json(lead);
  } catch {
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    if (!data.businessName) return res.status(400).json({ error: 'businessName is required' });
    const lead = await prisma.lead.create({ data: data as any, include: INCLUDE });
    res.status(201).json(lead);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create lead', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    const lead = await prisma.lead.update({ where: { id: param(req, 'id') }, data, include: INCLUDE });
    res.json(lead);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update lead', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.lead.delete({ where: { id: param(req, 'id') } });
    res.status(204).send();
  } catch {
    res.status(400).json({ error: 'Failed to delete lead' });
  }
});

export default router;
