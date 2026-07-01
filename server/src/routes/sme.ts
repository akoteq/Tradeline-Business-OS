import { Router, Request, Response } from 'express';
import { SME } from '../models/SME';
import { TradelineDeal } from '../models/TradelineDeal';
import { GrantLoanTracker } from '../models/GrantLoanTracker';
import { withBdo, bdoIdsByName } from '../lib/mongoUtils';
import { qs, param } from '../lib/query';

const router = Router();

type LinkedDeal = { id: string; type: 'TRADELINE' | 'GRANT'; label: string; status: string };

function norm(s: unknown) {
  return String(s ?? '').trim().toLowerCase();
}

function addTo(map: Map<string, LinkedDeal[]>, key: string | null | undefined, entry: LinkedDeal) {
  if (!key) return;
  const arr = map.get(key) ?? [];
  arr.push(entry);
  map.set(key, arr);
}

// Deals link to an SME either via `smeId` (going forward) or by matching business/client name
// (legacy records that predate the smeId field).
async function buildLinkMaps() {
  const [tradeline, grants] = await Promise.all([
    TradelineDeal.find({}, 'businessName smeId dealStage').lean(),
    GrantLoanTracker.find({}, 'clientName smeId status').lean(),
  ]);

  const byId = new Map<string, LinkedDeal[]>();
  const byName = new Map<string, LinkedDeal[]>();

  for (const d of tradeline) {
    const entry: LinkedDeal = { id: String(d._id), type: 'TRADELINE', label: String(d.businessName), status: String(d.dealStage) };
    addTo(byId, d.smeId as string | null, entry);
    addTo(byName, norm(d.businessName), entry);
  }
  for (const g of grants) {
    const entry: LinkedDeal = { id: String(g._id), type: 'GRANT', label: String(g.clientName), status: String(g.status) };
    addTo(byId, g.smeId as string | null, entry);
    addTo(byName, norm(g.clientName), entry);
  }

  return { byId, byName };
}

function linkedFor(sme: { id: string; companyName: string }, maps: Awaited<ReturnType<typeof buildLinkMaps>>): LinkedDeal[] {
  const combined = [...(maps.byId.get(sme.id) ?? []), ...(maps.byName.get(norm(sme.companyName)) ?? [])];
  const seen = new Set<string>();
  return combined.filter((d) => {
    const key = `${d.type}:${d.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const status = qs(req, 'status'), tier = qs(req, 'tier'), valueChain = qs(req, 'valueChain'), region = qs(req, 'region'), search = qs(req, 'search');
    const bdo = qs(req, 'bdo'), bdoId = qs(req, 'bdoId');
    const limitParam = qs(req, 'limit'), skipParam = qs(req, 'skip');

    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (tier) query.bankabilityTier = tier;
    if (valueChain) query.valueChain = { $regex: valueChain, $options: 'i' };
    if (region) query.region = { $regex: region, $options: 'i' };
    if (search) query.companyName = { $regex: search, $options: 'i' };
    if (bdo) {
      const ids = await bdoIdsByName(bdo);
      query.bdoId = { $in: ids };
    }
    if (bdoId) query.bdoId = bdoId;

    const total = await SME.countDocuments(query);
    let cursor = SME.find(query).sort({ companyName: 1 });
    if (skipParam) cursor = cursor.skip(Number(skipParam));
    if (limitParam) cursor = cursor.limit(Number(limitParam));
    const smes = await cursor;

    const [withBdoInfo, maps] = await Promise.all([withBdo(smes), buildLinkMaps()]);
    const data = withBdoInfo.map((s) => {
      const linked = linkedFor({ id: s.id as string, companyName: s.companyName as string }, maps);
      return {
        ...s,
        tradelineCount: linked.filter((d) => d.type === 'TRADELINE').length,
        grantCount: linked.filter((d) => d.type === 'GRANT').length,
      };
    });

    res.json({ data, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch SMEs' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const sme = await SME.findById(param(req, 'id'));
    if (!sme) { res.status(404).json({ error: 'Not found' }); return; }
    const [[result], maps] = await Promise.all([withBdo([sme]), buildLinkMaps()]);
    const linkedDeals = linkedFor({ id: result.id as string, companyName: result.companyName as string }, maps);
    res.json({ ...result, linkedDeals });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch SME' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const sme = await new SME(req.body).save();
    const [result] = await withBdo([sme]);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create SME', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const sme = await SME.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!sme) { res.status(404).json({ error: 'Not found' }); return; }
    const [result] = await withBdo([sme]);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update SME', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await SME.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete SME' });
  }
});

export default router;
