import { Router, Request, Response } from 'express';
import { Lead } from '../models/Lead';
import { withBdo, bdoIdsByName, bdoIdsByCompany } from '../lib/mongoUtils';
import { qs, param } from '../lib/query';
import { requireAuth, bdoFilter, companyFilter } from '../middleware/auth';

const router = Router();

router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const groups = await Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const stats = Object.fromEntries(groups.map((g) => [g._id, g.count]));
    res.json(stats);
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), bdoId = qs(req, 'bdoId'), status = qs(req, 'status'), priority = qs(req, 'priority'), search = qs(req, 'search');
    const limit = Math.min(parseInt(qs(req, 'limit') ?? '100'), 500);
    const skip = parseInt(qs(req, 'skip') ?? '0');
    const query: Record<string, unknown> = {};

    const forcedBdoId = bdoFilter(req);
    const forcedCompany = companyFilter(req);

    if (forcedBdoId) {
      query.bdoId = forcedBdoId;
    } else if (forcedCompany) {
      query.bdoId = { $in: await bdoIdsByCompany(forcedCompany) };
    } else {
      if (bdo) { query.bdoId = { $in: await bdoIdsByName(bdo) }; }
      if (bdoId) query.bdoId = bdoId;
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) query.businessName = { $regex: search, $options: 'i' };
    const [data, total] = await Promise.all([
      Lead.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Lead.countDocuments(query),
    ]);
    res.json({ data: await withBdo(data), total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const lead = await Lead.findById(param(req, 'id'));
    if (!lead) { res.status(404).json({ error: 'Not found' }); return; }
    const [result] = await withBdo([lead]);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const lead = await new Lead(req.body).save();
    res.status(201).json(lead.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create lead', detail: String(err) });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const lead = await Lead.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!lead) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(lead.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update lead', detail: String(err) });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await Lead.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch {
    res.status(400).json({ error: 'Failed to delete lead' });
  }
});

export default router;
