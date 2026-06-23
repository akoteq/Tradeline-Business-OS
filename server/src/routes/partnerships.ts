import { Router, Request, Response } from 'express';
import { Partnership } from '../models/Partnership';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const status = qs(req, 'status'), country = qs(req, 'country'), search = qs(req, 'search');
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (country) query.country = { $regex: country, $options: 'i' };
    if (search) query.partnerOrganisation = { $regex: search, $options: 'i' };
    const partnerships = await Partnership.find(query).sort({ updatedAt: -1 });
    res.json(partnerships.map((p) => p.toJSON()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch partnerships' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const p = await Partnership.findById(param(req, 'id'));
    if (!p) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(p.toJSON());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch partnership' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const p = await new Partnership(req.body).save();
    res.status(201).json(p.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create partnership', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const p = await Partnership.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!p) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(p.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update partnership', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await Partnership.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete partnership' });
  }
});

export default router;
