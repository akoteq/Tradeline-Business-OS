import { Router, Request, Response } from 'express';
import { ActivityLog } from '../models/ActivityLog';
import { withBdo, bdoIdsByName } from '../lib/mongoUtils';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), bdoId = qs(req, 'bdoId'), status = qs(req, 'status'), category = qs(req, 'category');
    const query: Record<string, unknown> = {};
    if (bdo) {
      const ids = await bdoIdsByName(bdo);
      query.bdoId = { $in: ids };
    }
    if (bdoId) query.bdoId = bdoId;
    if (status) query.status = status;
    if (category) query.category = { $regex: category, $options: 'i' };
    const logs = await ActivityLog.find(query).sort({ taskNo: 1 });
    res.json(await withBdo(logs));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const log = await new ActivityLog(req.body).save();
    res.status(201).json(log.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create log', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const log = await ActivityLog.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!log) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(log.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update log', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await ActivityLog.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete log' });
  }
});

export default router;
