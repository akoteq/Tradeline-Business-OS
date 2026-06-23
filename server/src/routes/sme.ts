import { Router, Request, Response } from 'express';
import { SME } from '../models/SME';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const status = qs(req, 'status'), tier = qs(req, 'tier'), valueChain = qs(req, 'valueChain'), region = qs(req, 'region'), search = qs(req, 'search');
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (tier) query.bankabilityTier = tier;
    if (valueChain) query.valueChain = { $regex: valueChain, $options: 'i' };
    if (region) query.region = { $regex: region, $options: 'i' };
    if (search) query.companyName = { $regex: search, $options: 'i' };
    const smes = await SME.find(query).sort({ companyName: 1 });
    res.json(smes.map((s) => s.toJSON()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch SMEs' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const sme = await SME.findById(param(req, 'id'));
    if (!sme) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(sme.toJSON());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch SME' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const sme = await new SME(req.body).save();
    res.status(201).json(sme.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create SME', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const sme = await SME.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!sme) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(sme.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update SME', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await SME.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete SME' });
  }
});

export default router;
