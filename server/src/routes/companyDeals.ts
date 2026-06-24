import { Router, Request, Response } from 'express';
import { CompanyDeal, COMPANY_KEYS } from '../models/CompanyDeal';
import { withBdo, bdoIdsByName } from '../lib/mongoUtils';
import { qs, param } from '../lib/query';

const router = Router();

// GET /api/company-deals?company=ALPHA_AFRICA&stage=...&health=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const company = qs(req, 'company');
    const bdo = qs(req, 'bdo'), bdoId = qs(req, 'bdoId');
    const stage = qs(req, 'stage'), health = qs(req, 'health'), priority = qs(req, 'priority');
    const search = qs(req, 'search');

    // company is required unless filtering by bdoId (BDO dashboard fetches across all companies)
    if (company && !(COMPANY_KEYS as readonly string[]).includes(company)) {
      res.status(400).json({ error: 'Invalid company value', valid: COMPANY_KEYS });
      return;
    }
    if (!company && !bdoId) {
      res.status(400).json({ error: 'Provide ?company= or ?bdoId=', valid: COMPANY_KEYS });
      return;
    }

    const query: Record<string, unknown> = {};
    if (company) query.company = company;
    if (bdo) { const ids = await bdoIdsByName(bdo); query.bdoId = { $in: ids }; }
    if (bdoId) query.bdoId = bdoId;
    if (stage) query.dealStage = stage;
    if (health) query.dealHealth = health;
    if (priority) query.priority = priority;
    if (search) query.businessName = { $regex: search, $options: 'i' };

    const deals = await CompanyDeal.find(query).sort({ updatedAt: -1 });
    res.json(await withBdo(deals));
  } catch {
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const deal = await CompanyDeal.findById(param(req, 'id'));
    if (!deal) { res.status(404).json({ error: 'Not found' }); return; }
    const [result] = await withBdo([deal]);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const deal = await new CompanyDeal(req.body).save();
    res.status(201).json(deal.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create deal', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const deal = await CompanyDeal.findByIdAndUpdate(
      param(req, 'id'), req.body, { new: true, runValidators: true },
    );
    if (!deal) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(deal.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update deal', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await CompanyDeal.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch {
    res.status(400).json({ error: 'Failed to delete deal' });
  }
});

export default router;
