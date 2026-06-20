import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { PartnershipStatus, Company } from '@prisma/client';
import { qs, param } from '../lib/query';

const router = Router();

function pickFields(body: Record<string, unknown>) {
  const {
    partnerOrganisation, contactPerson, contactEmailPhone, partnershipType,
    tradelineEntity, valueChainSector, country, agreementType,
    startDate, endRenewalDate, status, revenueSharePct, revenueGeneratedGhs, notes,
  } = body;

  return {
    ...(partnerOrganisation !== undefined ? { partnerOrganisation: partnerOrganisation as string } : {}),
    ...(contactPerson !== undefined ? { contactPerson: (contactPerson as string | null) || null } : {}),
    ...(contactEmailPhone !== undefined ? { contactEmailPhone: (contactEmailPhone as string | null) || null } : {}),
    ...(partnershipType !== undefined ? { partnershipType: (partnershipType as string | null) || null } : {}),
    ...(tradelineEntity !== undefined ? { tradelineEntity: (tradelineEntity as string | null) ? tradelineEntity as Company : null } : {}),
    ...(valueChainSector !== undefined ? { valueChainSector: (valueChainSector as string | null) || null } : {}),
    ...(country !== undefined ? { country: (country as string | null) || null } : {}),
    ...(agreementType !== undefined ? { agreementType: (agreementType as string | null) || null } : {}),
    ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate as string) : null } : {}),
    ...(endRenewalDate !== undefined ? { endRenewalDate: endRenewalDate ? new Date(endRenewalDate as string) : null } : {}),
    ...(status !== undefined ? { status: status as PartnershipStatus } : {}),
    ...(revenueSharePct !== undefined ? { revenueSharePct: revenueSharePct != null && revenueSharePct !== '' ? Number(revenueSharePct) : null } : {}),
    ...(revenueGeneratedGhs !== undefined ? { revenueGeneratedGhs: revenueGeneratedGhs != null && revenueGeneratedGhs !== '' ? Number(revenueGeneratedGhs) : null } : {}),
    ...(notes !== undefined ? { notes: (notes as string | null) || null } : {}),
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const status = qs(req, 'status'), country = qs(req, 'country');
    const entity = qs(req, 'entity'), search = qs(req, 'search');
    const partnerships = await prisma.partnership.findMany({
      where: {
        ...(status ? { status: status as PartnershipStatus } : {}),
        ...(entity ? { tradelineEntity: entity as Company } : {}),
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
    const data = pickFields(req.body);
    if (!data.partnerOrganisation) return res.status(400).json({ error: 'partnerOrganisation is required' });
    const p = await prisma.partnership.create({ data: data as any });
    res.status(201).json(p);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create partnership', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    const p = await prisma.partnership.update({ where: { id: param(req, 'id') }, data });
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
