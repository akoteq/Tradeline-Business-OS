import { Router, Request, Response } from 'express';
import { Company } from '../models/Company';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { qs, param } from '../lib/query';

const router = Router();

const toKey = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const toSlug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// List companies. Active only by default; pass ?all=1 to include archived.
// Open to any authenticated page — every company dropdown in the app reads from here.
router.get('/', async (req: Request, res: Response) => {
  try {
    const all = qs(req, 'all');
    const companies = await Company.find(all ? {} : { isActive: true }).sort({ order: 1, name: 1 });
    res.json(companies.map((c) => c.toJSON()));
  } catch {
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Create a company (admin). Admin-added companies always use the shared CompanyDeal collection.
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, key, slug, color, order } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'Company name is required' }); return; }
    const k = key ? toKey(key) : toKey(name);
    const s = slug ? toSlug(slug) : toSlug(name);
    if (!k || !s) { res.status(400).json({ error: 'Could not derive a valid key/slug from the name' }); return; }
    const clash = await Company.findOne({ $or: [{ key: k }, { slug: s }] });
    if (clash) { res.status(400).json({ error: `A company with that key or slug already exists (${clash.get('name')})` }); return; }
    const company = await new Company({
      name: name.trim(), key: k, slug: s, dealSource: 'COMPANY',
      color: color || 'teal', order: order ?? 100, isActive: true,
    }).save();
    res.status(201).json(company.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create company', detail: String(err) });
  }
});

// Update a company (admin). Key & dealSource are immutable — they anchor existing deals.
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, slug, color, order, isActive } = req.body;
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = String(name).trim();
    if (slug !== undefined) update.slug = toSlug(slug);
    if (color !== undefined) update.color = color;
    if (order !== undefined) update.order = order;
    if (isActive !== undefined) update.isActive = isActive;
    if (update.slug) {
      const clash = await Company.findOne({ slug: update.slug, _id: { $ne: param(req, 'id') } });
      if (clash) { res.status(400).json({ error: 'Another company already uses that slug' }); return; }
    }
    const company = await Company.findByIdAndUpdate(param(req, 'id'), update, { new: true, runValidators: true });
    if (!company) { res.status(404).json({ error: 'Company not found' }); return; }
    res.json(company.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update company', detail: String(err) });
  }
});

// Archive a company (admin) — soft delete so existing deals are never orphaned.
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await Company.findByIdAndUpdate(param(req, 'id'), { isActive: false });
    res.status(204).send();
  } catch {
    res.status(400).json({ error: 'Failed to archive company' });
  }
});

export default router;
