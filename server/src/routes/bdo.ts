import { Router, Request, Response } from 'express';
import { BDO } from '../models/BDO';
import { BapxDeal } from '../models/BapxDeal';
import { TradelineDeal } from '../models/TradelineDeal';
import { Lead } from '../models/Lead';
import { Task } from '../models/Task';
import { qs, param } from '../lib/query';
import { requireAuth, companyFilter, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const company = qs(req, 'company');
    const query: Record<string, unknown> = { isActive: true };

    const forcedCompany = companyFilter(req);
    if (forcedCompany) {
      query.company = forcedCompany;
    } else if (company) {
      query.company = company;
    }

    const bdos = await BDO.find(query).sort({ name: 1 });
    res.json(bdos.map((b) => b.toJSON()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BDOs' });
  }
});

// Per-BDO performance rollup. Admin/CEO only — group-wide view.
router.get('/performance', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const bdos = await BDO.find({ isActive: true }).sort({ name: 1 });

    const countMap = (rows: { _id: string | null; count: number }[]) => {
      const m: Record<string, number> = {};
      rows.forEach((r) => { if (r._id) m[String(r._id)] = r.count; });
      return m;
    };

    const [bapxAgg, tlAgg, leadAgg, taskAgg, revenueAgg] = await Promise.all([
      BapxDeal.aggregate([{ $group: { _id: '$bdoId', count: { $sum: 1 } } }]),
      TradelineDeal.aggregate([{ $group: { _id: '$bdoId', count: { $sum: 1 } } }]),
      Lead.aggregate([{ $group: { _id: '$bdoId', count: { $sum: 1 } } }]),
      Task.aggregate([{ $group: {
        _id: '$bdoId',
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
        overdue: { $sum: { $cond: [{ $eq: ['$status', 'OVERDUE'] }, 1, 0] } },
        open: { $sum: { $cond: [{ $in: ['$status', ['PENDING', 'IN_PROGRESS', 'OVERDUE']] }, 1, 0] } },
      } }]),
      TradelineDeal.aggregate([{ $group: {
        _id: '$bdoId',
        received: { $sum: '$revenueReceivedGhs' },
        potential: { $sum: '$revenuePotentialGhs' },
      } }]),
    ]);

    const bapxMap = countMap(bapxAgg);
    const tlMap = countMap(tlAgg);
    const leadMap = countMap(leadAgg);
    const taskMap: Record<string, { total: number; open: number; completed: number; overdue: number }> = {};
    taskAgg.forEach((t) => { if (t._id) taskMap[String(t._id)] = { total: t.total, open: t.open, completed: t.completed, overdue: t.overdue }; });
    const revMap: Record<string, { received: number; potential: number }> = {};
    revenueAgg.forEach((r) => { if (r._id) revMap[String(r._id)] = { received: r.received ?? 0, potential: r.potential ?? 0 }; });

    res.json(bdos.map((b) => {
      const id = b.id as string;
      return {
        bdo: {
          id,
          name: b.get('name'),
          email: b.get('email') ?? null,
          phone: b.get('phone') ?? null,
          company: b.get('company'),
          role: b.get('role') ?? null,
          managerId: b.get('managerId') ?? null,
          isActive: b.get('isActive'),
        },
        bapxDeals: bapxMap[id] ?? 0,
        tradelineDeals: tlMap[id] ?? 0,
        leads: leadMap[id] ?? 0,
        tasks: taskMap[id] ?? { total: 0, open: 0, completed: 0, overdue: 0 },
        revenue: revMap[id] ?? { received: 0, potential: 0 },
      };
    }));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BDO performance', detail: String(err) });
  }
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const bdo = await BDO.findById(param(req, 'id'));
    if (!bdo) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(bdo.toJSON());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BDO' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const bdo = await new BDO(req.body).save();
    res.status(201).json(bdo.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create BDO', detail: String(err) });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const bdo = await BDO.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!bdo) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(bdo.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update BDO', detail: String(err) });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await BDO.findByIdAndUpdate(param(req, 'id'), { isActive: false });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to deactivate BDO' });
  }
});

export default router;
