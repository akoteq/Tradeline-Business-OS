import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { DealHealth, DealStage, Priority } from '@prisma/client';
import { qs, param } from '../lib/query';

const router = Router();

const INCLUDE = { bdo: true } as const;

function pickFields(body: Record<string, unknown>) {
  const {
    bizId, dealHealth, date, businessName, clientName, holdingFirm, industry,
    telephone, region, email, bdoId, activityType, keyTopics, callOutcome,
    product, dealStage, priority, nextSteps, nextCallDate, targetGhs,
    daysSinceLastContact, aiCoachRecommendation, smeId,
  } = body;

  return {
    ...(bizId !== undefined ? { bizId: bizId as string | null } : {}),
    ...(dealHealth !== undefined ? { dealHealth: dealHealth as DealHealth } : {}),
    ...(date !== undefined ? { date: date ? new Date(date as string) : null } : {}),
    ...(businessName !== undefined ? { businessName: businessName as string } : {}),
    ...(clientName !== undefined ? { clientName: clientName as string | null } : {}),
    ...(holdingFirm !== undefined ? { holdingFirm: holdingFirm as string | null } : {}),
    ...(industry !== undefined ? { industry: industry as string | null } : {}),
    ...(telephone !== undefined ? { telephone: telephone as string | null } : {}),
    ...(region !== undefined ? { region: region as string | null } : {}),
    ...(email !== undefined ? { email: email as string | null } : {}),
    ...(bdoId !== undefined ? { bdoId: (bdoId as string | null) || null } : {}),
    ...(activityType !== undefined ? { activityType: activityType as string | null } : {}),
    ...(keyTopics !== undefined ? { keyTopics: keyTopics as string | null } : {}),
    ...(callOutcome !== undefined ? { callOutcome: callOutcome as string | null } : {}),
    ...(product !== undefined ? { product: product as string | null } : {}),
    ...(dealStage !== undefined ? { dealStage: dealStage as DealStage } : {}),
    ...(priority !== undefined ? { priority: priority as Priority } : {}),
    ...(nextSteps !== undefined ? { nextSteps: nextSteps as string | null } : {}),
    ...(nextCallDate !== undefined ? { nextCallDate: nextCallDate ? new Date(nextCallDate as string) : null } : {}),
    ...(targetGhs !== undefined ? { targetGhs: targetGhs != null && targetGhs !== '' ? Number(targetGhs) : null } : {}),
    ...(daysSinceLastContact !== undefined ? { daysSinceLastContact: daysSinceLastContact != null ? Number(daysSinceLastContact) : null } : {}),
    ...(aiCoachRecommendation !== undefined ? { aiCoachRecommendation: aiCoachRecommendation as string | null } : {}),
    ...(smeId !== undefined ? { smeId: (smeId as string | null) || null } : {}),
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), stage = qs(req, 'stage'), health = qs(req, 'health'), priority = qs(req, 'priority'), search = qs(req, 'search');
    const deals = await prisma.bapxDeal.findMany({
      where: {
        ...(bdo ? { bdo: { name: { contains: bdo, mode: 'insensitive' } } } : {}),
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
    res.status(500).json({ error: 'Failed to fetch BAPX deals' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const deal = await prisma.bapxDeal.findUnique({ where: { id: param(req, 'id') }, include: { bdo: true, sme: true } });
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
    const deal = await prisma.bapxDeal.create({ data, include: INCLUDE });
    res.status(201).json(deal);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create deal', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    const deal = await prisma.bapxDeal.update({ where: { id: param(req, 'id') }, data, include: INCLUDE });
    res.json(deal);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update deal', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.bapxDeal.delete({ where: { id: param(req, 'id') } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete deal' });
  }
});

export default router;
