import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Tier, DealStage, Priority, DealHealth, PaymentStatus } from '@prisma/client';
import { qs, param } from '../lib/query';

const router = Router();

const INCLUDE = { bdo: true } as const;

function pickFields(body: Record<string, unknown>) {
  const {
    bizId, serialNo, businessName, valueChain, bdoId, tier, email, telephone,
    currentStatus, nextAction, requiredInvestment, revenuePotentialGhs, dueDate,
    revenueReceivedGhs, balanceGhs, paymentStatus, dealStage, priority, dealHealth, smeId,
  } = body;

  return {
    ...(bizId !== undefined ? { bizId: bizId as string | null } : {}),
    ...(serialNo !== undefined ? { serialNo: serialNo != null ? Number(serialNo) : null } : {}),
    ...(businessName !== undefined ? { businessName: businessName as string } : {}),
    ...(valueChain !== undefined ? { valueChain: (valueChain as string | null) || null } : {}),
    ...(bdoId !== undefined ? { bdoId: (bdoId as string | null) || null } : {}),
    ...(tier !== undefined ? { tier: tier as Tier } : {}),
    ...(email !== undefined ? { email: (email as string | null) || null } : {}),
    ...(telephone !== undefined ? { telephone: (telephone as string | null) || null } : {}),
    ...(currentStatus !== undefined ? { currentStatus: (currentStatus as string | null) || null } : {}),
    ...(nextAction !== undefined ? { nextAction: (nextAction as string | null) || null } : {}),
    ...(requiredInvestment !== undefined ? { requiredInvestment: (requiredInvestment as string | null) || null } : {}),
    ...(revenuePotentialGhs !== undefined ? { revenuePotentialGhs: revenuePotentialGhs != null && revenuePotentialGhs !== '' ? Number(revenuePotentialGhs) : null } : {}),
    ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate as string) : null } : {}),
    ...(revenueReceivedGhs !== undefined ? { revenueReceivedGhs: revenueReceivedGhs != null && revenueReceivedGhs !== '' ? Number(revenueReceivedGhs) : null } : {}),
    ...(balanceGhs !== undefined ? { balanceGhs: balanceGhs != null && balanceGhs !== '' ? Number(balanceGhs) : null } : {}),
    ...(paymentStatus !== undefined ? { paymentStatus: paymentStatus as PaymentStatus } : {}),
    ...(dealStage !== undefined ? { dealStage: dealStage as DealStage } : {}),
    ...(priority !== undefined ? { priority: priority as Priority } : {}),
    ...(dealHealth !== undefined ? { dealHealth: dealHealth as DealHealth } : {}),
    ...(smeId !== undefined ? { smeId: (smeId as string | null) || null } : {}),
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), tier = qs(req, 'tier'), stage = qs(req, 'stage'), health = qs(req, 'health'), priority = qs(req, 'priority'), search = qs(req, 'search');
    const deals = await prisma.tradelineDeal.findMany({
      where: {
        ...(bdo ? { bdo: { name: { contains: bdo, mode: 'insensitive' } } } : {}),
        ...(tier ? { tier: tier as Tier } : {}),
        ...(stage ? { dealStage: stage as DealStage } : {}),
        ...(health ? { dealHealth: health as DealHealth } : {}),
        ...(priority ? { priority: priority as Priority } : {}),
        ...(search ? { businessName: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Tradeline deals' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const deal = await prisma.tradelineDeal.findUnique({ where: { id: param(req, 'id') }, include: { bdo: true, sme: true } });
    if (!deal) return res.status(404).json({ error: 'Not found' });
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    if (!data.businessName) return res.status(400).json({ error: 'businessName is required' });
    const deal = await prisma.tradelineDeal.create({ data, include: INCLUDE });
    res.status(201).json(deal);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create deal', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    const deal = await prisma.tradelineDeal.update({ where: { id: param(req, 'id') }, data, include: INCLUDE });
    res.json(deal);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update deal', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.tradelineDeal.delete({ where: { id: param(req, 'id') } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete deal' });
  }
});

export default router;
