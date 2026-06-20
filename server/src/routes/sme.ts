import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { SMEStatus, BankabilityTier } from '@prisma/client';
import { qs, param } from '../lib/query';

const router = Router();

function pickFields(body: Record<string, unknown>) {
  const {
    bizId, companyName, contactName, email, phone, valueChain, region, district,
    businessDescription, status, followUpDate, investorReadinessScore, bankabilityTier, notes,
  } = body;

  return {
    ...(bizId !== undefined ? { bizId: bizId as string | null } : {}),
    ...(companyName !== undefined ? { companyName: companyName as string } : {}),
    ...(contactName !== undefined ? { contactName: (contactName as string | null) || null } : {}),
    ...(email !== undefined ? { email: (email as string | null) || null } : {}),
    ...(phone !== undefined ? { phone: (phone as string | null) || null } : {}),
    ...(valueChain !== undefined ? { valueChain: (valueChain as string | null) || null } : {}),
    ...(region !== undefined ? { region: (region as string | null) || null } : {}),
    ...(district !== undefined ? { district: (district as string | null) || null } : {}),
    ...(businessDescription !== undefined ? { businessDescription: (businessDescription as string | null) || null } : {}),
    ...(status !== undefined ? { status: status as SMEStatus } : {}),
    ...(followUpDate !== undefined ? { followUpDate: followUpDate ? new Date(followUpDate as string) : null } : {}),
    ...(investorReadinessScore !== undefined ? { investorReadinessScore: investorReadinessScore != null && investorReadinessScore !== '' ? Number(investorReadinessScore) : null } : {}),
    ...(bankabilityTier !== undefined ? { bankabilityTier: bankabilityTier as BankabilityTier } : {}),
    ...(notes !== undefined ? { notes: (notes as string | null) || null } : {}),
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const status = qs(req, 'status'), tier = qs(req, 'tier');
    const valueChain = qs(req, 'valueChain'), region = qs(req, 'region'), search = qs(req, 'search');
    const limit = Math.min(parseInt(qs(req, 'limit') ?? '100'), 500);
    const skip = parseInt(qs(req, 'skip') ?? '0');

    const where = {
      ...(status ? { status: status as SMEStatus } : {}),
      ...(tier ? { bankabilityTier: tier as BankabilityTier } : {}),
      ...(valueChain ? { valueChain: { contains: valueChain, mode: 'insensitive' as const } } : {}),
      ...(region ? { region: { contains: region, mode: 'insensitive' as const } } : {}),
      ...(search ? { companyName: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.sME.findMany({ where, orderBy: { companyName: 'asc' }, take: limit, skip }),
      prisma.sME.count({ where }),
    ]);
    res.json({ data, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch SMEs' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const sme = await prisma.sME.findUnique({ where: { id: param(req, 'id') } });
    if (!sme) return res.status(404).json({ error: 'Not found' });
    res.json(sme);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch SME' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    if (!data.companyName) return res.status(400).json({ error: 'companyName is required' });
    const sme = await prisma.sME.create({ data: data as any });
    res.status(201).json(sme);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create SME', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    const sme = await prisma.sME.update({ where: { id: param(req, 'id') }, data });
    res.json(sme);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update SME', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.sME.delete({ where: { id: param(req, 'id') } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete SME' });
  }
});

export default router;
