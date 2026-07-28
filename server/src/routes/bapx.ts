import { Router, Request, Response } from 'express';
import { BapxDeal } from '../models/BapxDeal';
import { withBdo, bdoIdsByName, bdoIdsByCompany } from '../lib/mongoUtils';
import { qs, param } from '../lib/query';
import { backfillSmeRegion } from '../lib/smeSync';
import { requireAuth, bdoFilter, companyFilter } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), bdoId = qs(req, 'bdoId'), stage = qs(req, 'stage'), health = qs(req, 'health'), priority = qs(req, 'priority'), search = qs(req, 'search');
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

    if (stage) query.dealStage = stage;
    if (health) query.dealHealth = health;
    if (priority) query.priority = priority;
    if (search) query.businessName = { $regex: search, $options: 'i' };
    const deals = await BapxDeal.find(query).sort({ updatedAt: -1 });
    res.json(await withBdo(deals));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BAPX deals' });
  }
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const deal = await BapxDeal.findById(param(req, 'id'));
    if (!deal) { res.status(404).json({ error: 'Not found' }); return; }
    const [result] = await withBdo([deal]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const deal = await new BapxDeal(req.body).save();
    await backfillSmeRegion(req.body.smeId, req.body.region).catch(() => {});
    res.status(201).json(deal.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create deal', detail: String(err) });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const deal = await BapxDeal.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!deal) { res.status(404).json({ error: 'Not found' }); return; }
    await backfillSmeRegion(req.body.smeId, req.body.region).catch(() => {});
    res.json(deal.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update deal', detail: String(err) });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await BapxDeal.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete deal' });
  }
});

export default router;
