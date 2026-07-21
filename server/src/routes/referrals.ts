import { Router, Request, Response } from 'express';
import { Referral } from '../models/Referral';
import { withBdo } from '../lib/mongoUtils';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const query: Record<string, unknown> = {};
    const status = qs(req, 'status'); if (status) query.status = status;
    const fromCompany = qs(req, 'fromCompany'); if (fromCompany) query.fromCompany = fromCompany;
    const toCompany = qs(req, 'toCompany'); if (toCompany) query.toCompany = toCompany;
    const bdoId = qs(req, 'bdoId'); if (bdoId) query.bdoId = bdoId;
    const search = qs(req, 'search'); if (search) query.clientName = { $regex: search, $options: 'i' };
    const referrals = await Referral.find(query).sort({ updatedAt: -1 });
    res.json(await withBdo(referrals));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch referrals', detail: String(err) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.body.clientName) { res.status(400).json({ error: 'Client name is required' }); return; }
    const body = { ...req.body };
    if (body.status === 'CONVERTED' && !body.convertedAt) body.convertedAt = new Date();
    const referral = await new Referral(body).save();
    const [result] = await withBdo([referral]);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create referral', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await Referral.findById(param(req, 'id'));
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    const body = { ...req.body };
    if (body.status === 'CONVERTED' && existing.get('status') !== 'CONVERTED' && !body.convertedAt) {
      body.convertedAt = new Date();
    }
    const referral = await Referral.findByIdAndUpdate(param(req, 'id'), body, { new: true, runValidators: true });
    const [result] = await withBdo([referral]);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update referral', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await Referral.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch {
    res.status(400).json({ error: 'Failed to delete referral' });
  }
});

export default router;
