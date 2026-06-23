import { Router, Request, Response } from 'express';
import { ConsolidatedRecord } from '../models/ConsolidatedRecord';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const priority = qs(req, 'priority'), source = qs(req, 'source'), duplicate = qs(req, 'duplicate'), search = qs(req, 'search');
    const query: Record<string, unknown> = {};
    if (priority) query.priority = priority;
    if (source) query.sourceFirm = source;
    if (duplicate !== undefined) query.duplicateFlag = duplicate === 'true';
    if (search) query.businessName = { $regex: search, $options: 'i' };
    const records = await ConsolidatedRecord.find(query).sort({ serialNo: 1 });
    res.json(records.map((r) => r.toJSON()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch consolidated records' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const r = await new ConsolidatedRecord(req.body).save();
    res.status(201).json(r.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create record', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const r = await ConsolidatedRecord.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!r) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(r.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update record', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await ConsolidatedRecord.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete record' });
  }
});

export default router;
