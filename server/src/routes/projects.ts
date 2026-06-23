import { Router, Request, Response } from 'express';
import { Project } from '../models/Project';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { param } from '../lib/query';

const router = Router();

// Anyone authenticated can read projects
router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const projects = await Project.find().sort({ createdAt: 1 });
    res.json(projects.map((p) => p.toJSON()));
  } catch {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const project = await Project.findById(param(req, 'id'));
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(project.toJSON());
  } catch {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Only ADMIN / CEO can create, update, delete
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const project = await new Project(req.body).save();
    res.status(201).json(project.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create project', detail: String(err) });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const project = await Project.findByIdAndUpdate(
      param(req, 'id'),
      req.body,
      { new: true, runValidators: true },
    );
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(project.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update project', detail: String(err) });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await Project.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch {
    res.status(400).json({ error: 'Failed to delete project' });
  }
});

export default router;
