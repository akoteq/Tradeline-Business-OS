import { Router, Request, Response } from 'express';
import { Task } from '../models/Task';
import { withBdo, bdoIdsByName, bdoIdsByCompany } from '../lib/mongoUtils';
import { qs, param } from '../lib/query';
import { requireAuth, bdoFilter, companyFilter } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), bdoId = qs(req, 'bdoId'), priority = qs(req, 'priority'), status = qs(req, 'status'), company = qs(req, 'company'), year = qs(req, 'year'), type = qs(req, 'type');
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
      if (company) query.company = company;
    }

    if (priority) query.priority = priority;
    if (status) query.status = status;
    if (year) query.year = parseInt(year);
    if (type) query.type = type;
    const tasks = await Task.find(query).sort({ createdAt: -1 });
    res.json(await withBdo(tasks));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const task = await new Task(req.body).save();
    res.status(201).json(task.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create task', detail: String(err) });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const task = await Task.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!task) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(task.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update task', detail: String(err) });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await Task.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete task' });
  }
});

export default router;
