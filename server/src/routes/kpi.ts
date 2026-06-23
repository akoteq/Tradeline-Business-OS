import { Router, Request, Response } from 'express';
import { KpiScorecard } from '../models/KpiScorecard';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const company = qs(req, 'company'), month = qs(req, 'month');
    const query: Record<string, unknown> = {};
    if (company) query.company = company;
    if (month) query.month = { $gte: new Date(month) };
    const kpis = await KpiScorecard.find(query).sort({ month: -1 });
    res.json(kpis.map((k) => k.toJSON()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const kpi = await new KpiScorecard(req.body).save();
    res.status(201).json(kpi.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create KPI', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const kpi = await KpiScorecard.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!kpi) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(kpi.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update KPI', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await KpiScorecard.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete KPI' });
  }
});

export default router;
