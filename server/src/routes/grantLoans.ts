import { Router, Request, Response } from 'express';
import { GrantLoanTracker } from '../models/GrantLoanTracker';
import { withBdo, bdoIdsByName } from '../lib/mongoUtils';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), bdoId = qs(req, 'bdoId'), status = qs(req, 'status'), search = qs(req, 'search');
    const query: Record<string, unknown> = {};
    if (bdo) {
      const ids = await bdoIdsByName(bdo);
      query.bdoId = { $in: ids };
    }
    if (bdoId) query.bdoId = bdoId;
    if (status) query.status = status;
    if (search) query.clientName = { $regex: search, $options: 'i' };
    const grants = await GrantLoanTracker.find(query).sort({ updatedAt: -1 });
    res.json(await withBdo(grants));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch grant/loan records' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const g = await GrantLoanTracker.findById(param(req, 'id'));
    if (!g) { res.status(404).json({ error: 'Not found' }); return; }
    const [result] = await withBdo([g]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const g = await new GrantLoanTracker(req.body).save();
    res.status(201).json(g.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create record', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const g = await GrantLoanTracker.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!g) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(g.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update record', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await GrantLoanTracker.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete record' });
  }
});

export default router;
