import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { SMEStatus, BankabilityTier } from '@prisma/client';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const status = qs(req, 'status'), tier = qs(req, 'tier'), valueChain = qs(req, 'valueChain'), region = qs(req, 'region'), search = qs(req, 'search');
    const smes = await prisma.sME.findMany({
      where: {
        ...(status ? { status: status as SMEStatus } : {}),
        ...(tier ? { bankabilityTier: tier as BankabilityTier } : {}),
        ...(valueChain ? { valueChain: { contains: valueChain, mode: 'insensitive' } } : {}),
        ...(region ? { region: { contains: region, mode: 'insensitive' } } : {}),
        ...(search ? { companyName: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { companyName: 'asc' },
    });
    res.json(smes);
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
    const sme = await prisma.sME.create({ data: req.body });
    res.status(201).json(sme);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create SME', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const sme = await prisma.sME.update({ where: { id: param(req, 'id') }, data: req.body });
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
