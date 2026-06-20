import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { GrantLoanStatus } from '@prisma/client';
import { qs, param } from '../lib/query';

const router = Router();

const INCLUDE = { bdo: true } as const;

function pickFields(body: Record<string, unknown>) {
  const {
    clientName, bdoId, grantLoanType, funderDfi, sectorValueChain,
    amountApplied, amountApproved, disbursed, applicationDate, decisionDate,
    status, commissionPct, commissionReceived, notes, smeId,
  } = body;

  return {
    ...(clientName !== undefined ? { clientName: clientName as string } : {}),
    ...(bdoId !== undefined ? { bdoId: (bdoId as string | null) || null } : {}),
    ...(grantLoanType !== undefined ? { grantLoanType: (grantLoanType as string | null) || null } : {}),
    ...(funderDfi !== undefined ? { funderDfi: (funderDfi as string | null) || null } : {}),
    ...(sectorValueChain !== undefined ? { sectorValueChain: (sectorValueChain as string | null) || null } : {}),
    ...(amountApplied !== undefined ? { amountApplied: (amountApplied as string | null) || null } : {}),
    ...(amountApproved !== undefined ? { amountApproved: amountApproved != null && amountApproved !== '' ? Number(amountApproved) : null } : {}),
    ...(disbursed !== undefined ? { disbursed: disbursed != null && disbursed !== '' ? Number(disbursed) : null } : {}),
    ...(applicationDate !== undefined ? { applicationDate: applicationDate ? new Date(applicationDate as string) : null } : {}),
    ...(decisionDate !== undefined ? { decisionDate: decisionDate ? new Date(decisionDate as string) : null } : {}),
    ...(status !== undefined ? { status: status as GrantLoanStatus } : {}),
    ...(commissionPct !== undefined ? { commissionPct: commissionPct != null && commissionPct !== '' ? Number(commissionPct) : null } : {}),
    ...(commissionReceived !== undefined ? { commissionReceived: commissionReceived != null && commissionReceived !== '' ? Number(commissionReceived) : null } : {}),
    ...(notes !== undefined ? { notes: (notes as string | null) || null } : {}),
    ...(smeId !== undefined ? { smeId: (smeId as string | null) || null } : {}),
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), status = qs(req, 'status'), search = qs(req, 'search');
    const grants = await prisma.grantLoanTracker.findMany({
      where: {
        ...(bdo ? { bdo: { name: { contains: bdo, mode: 'insensitive' } } } : {}),
        ...(status ? { status: status as GrantLoanStatus } : {}),
        ...(search ? { clientName: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    res.json(grants);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch grant/loan records' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const g = await prisma.grantLoanTracker.findUnique({ where: { id: param(req, 'id') }, include: INCLUDE });
    if (!g) return res.status(404).json({ error: 'Not found' });
    res.json(g);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    if (!data.clientName) return res.status(400).json({ error: 'clientName is required' });
    const g = await prisma.grantLoanTracker.create({ data, include: INCLUDE });
    res.status(201).json(g);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create record', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    const g = await prisma.grantLoanTracker.update({ where: { id: param(req, 'id') }, data, include: INCLUDE });
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
