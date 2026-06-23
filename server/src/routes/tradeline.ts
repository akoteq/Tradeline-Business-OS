import { Router, Request, Response } from 'express';
import { TradelineDeal } from '../models/TradelineDeal';
import { withBdo, bdoIdsByName } from '../lib/mongoUtils';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), bdoId = qs(req, 'bdoId'), tier = qs(req, 'tier'), stage = qs(req, 'stage'), health = qs(req, 'health'), priority = qs(req, 'priority'), search = qs(req, 'search');
    const query: Record<string, unknown> = {};
    if (bdo) {
      const ids = await bdoIdsByName(bdo);
      query.bdoId = { $in: ids };
    }
    if (bdoId) query.bdoId = bdoId;
    if (tier) query.tier = tier;
    if (stage) query.dealStage = stage;
    if (health) query.dealHealth = health;
    if (priority) query.priority = priority;
    if (search) query.businessName = { $regex: search, $options: 'i' };
    const deals = await TradelineDeal.find(query).sort({ updatedAt: -1 });
    res.json(await withBdo(deals));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Tradeline deals' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const deal = await TradelineDeal.findById(param(req, 'id'));
    if (!deal) { res.status(404).json({ error: 'Not found' }); return; }
    const [result] = await withBdo([deal]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const deal = await new TradelineDeal(req.body).save();
    res.status(201).json(deal.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create deal', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const deal = await TradelineDeal.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!deal) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(deal.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update deal', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await TradelineDeal.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete deal' });
  }
});

export default router;
