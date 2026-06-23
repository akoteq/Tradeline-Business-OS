import { Router, Request, Response } from 'express';
import { BDO } from '../models/BDO';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const company = qs(req, 'company');
    const query: Record<string, unknown> = { isActive: true };
    if (company) query.company = company;
    const bdos = await BDO.find(query).sort({ name: 1 });
    res.json(bdos.map((b) => b.toJSON()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BDOs' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bdo = await BDO.findById(param(req, 'id'));
    if (!bdo) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(bdo.toJSON());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BDO' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const bdo = await new BDO(req.body).save();
    res.status(201).json(bdo.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create BDO', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const bdo = await BDO.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!bdo) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(bdo.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update BDO', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await BDO.findByIdAndUpdate(param(req, 'id'), { isActive: false });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to deactivate BDO' });
  }
});

export default router;
