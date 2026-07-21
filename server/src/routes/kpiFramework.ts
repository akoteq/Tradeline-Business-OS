import { Router, Request, Response } from 'express';
import { KpiDefinition, computeAttainment } from '../models/KpiDefinition';
import { KpiEntry } from '../models/KpiEntry';
import { KpiAuditLog } from '../models/KpiAuditLog';
import { User, ADMIN_ROLES } from '../models/User';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { qs, param } from '../lib/query';
import { computeAutoFeed, AUTO_KEYS } from '../lib/kpiAutoFeed';

const router = Router();

// Managers who may verify submitted actuals (team leads + executives + admins).
const MANAGER_ROLES = ['SENIOR_BDO', 'MANAGING_PARTNER', 'SENIOR_PARTNER', 'ADMIN', 'CEO'];

async function actorInfo(req: Request): Promise<{ actorId: string | null; actorEmail: string | null; actorRole: string | null }> {
  let actorEmail: string | null = null;
  try {
    const u = req.user ? await User.findById(req.user.userId) : null;
    actorEmail = u?.get('email') ?? null;
  } catch { /* userId not a valid ObjectId / user removed — log without email */ }
  return { actorId: req.user?.userId ?? null, actorEmail, actorRole: req.user?.role ?? null };
}

// Best-effort: audit logging must never fail the underlying data operation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logAudit(req: Request, entry: any, action: string, extra: Record<string, unknown> = {}) {
  try {
    const a = await actorInfo(req);
    await KpiAuditLog.create({
      entryId: entry.id, definitionId: entry.get('definitionId'),
      ...a, action, reviewStatus: entry.get('reviewStatus'), ...extra,
    });
  } catch (err) {
    console.error('KPI audit log write failed:', err);
  }
}

// Parse a YYYY-MM (or ISO) period into the [start, end) bounds of that month.
function monthBounds(period?: string): { start: Date; end: Date } {
  const base = period ? new Date(period.length === 7 ? `${period}-01` : period) : new Date();
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  return { start, end };
}

function trendOf(cur: number | null, prev: number | null, higherIsBetter: boolean): string {
  if (prev == null || cur == null) return 'NEW';
  if (cur === prev) return 'STABLE';
  const up = cur > prev;
  return (higherIsBetter ? up : !up) ? 'IMPROVING' : 'NEEDS_ATTENTION';
}

// ─── Definitions (the registry) ─────────────────────────────────────────────
router.get('/definitions', async (req: Request, res: Response) => {
  try {
    const query: Record<string, unknown> = { isActive: true };
    const department = qs(req, 'department'); if (department) query.department = department;
    const company = qs(req, 'company'); if (company) query.company = company;
    const scope = qs(req, 'scope'); if (scope) query.scope = scope;
    const defs = await KpiDefinition.find(query).sort({ department: 1, order: 1, metric: 1 });
    res.json(defs.map((d) => d.toJSON()));
  } catch {
    res.status(500).json({ error: 'Failed to fetch KPI definitions' });
  }
});

// The catalog of auto-feed metrics an AUTO KPI can be wired to (for the admin form).
router.get('/auto-keys', (_req: Request, res: Response) => {
  res.json(AUTO_KEYS);
});

// Distinct departments (with definition counts) — optional sub-grouping within a company.
// Pass ?company= to list only that company's departments.
router.get('/departments', async (req: Request, res: Response) => {
  try {
    const match: Record<string, unknown> = { isActive: true, department: { $ne: null } };
    const company = qs(req, 'company'); if (company) match.company = company;
    const rows = await KpiDefinition.aggregate([
      { $match: match },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json(rows.map((r) => ({ department: r._id, count: r.count })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.post('/definitions', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!req.body.metric) { res.status(400).json({ error: 'Metric name is required' }); return; }
    const def = await new KpiDefinition(req.body).save();
    res.status(201).json(def.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create KPI definition', detail: String(err) });
  }
});

router.put('/definitions/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const def = await KpiDefinition.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!def) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(def.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update KPI definition', detail: String(err) });
  }
});

router.delete('/definitions/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await KpiDefinition.findByIdAndUpdate(param(req, 'id'), { isActive: false });
    res.status(204).send();
  } catch {
    res.status(400).json({ error: 'Failed to archive KPI definition' });
  }
});

// ─── Board (the read model dashboards consume) ──────────────────────────────
// For every matching definition, returns its entry for the period with computed
// variance / attainment / status / trend. Filter by department, company, bdoId, scope.
router.get('/board', async (req: Request, res: Response) => {
  try {
    // A KPI belongs to a company (or the group). Company is the primary filter; department optional.
    const company = qs(req, 'company') || 'GROUP';
    const defQuery: Record<string, unknown> = { isActive: true, company };
    const department = qs(req, 'department'); if (department) defQuery.department = department;
    const bdoId = qs(req, 'bdoId');

    const { start, end } = monthBounds(qs(req, 'period'));
    const defs = await KpiDefinition.find(defQuery).sort({ department: 1, order: 1, metric: 1 });
    const defIds = defs.map((d) => d.id);

    // Live auto-feed for this company scope (GROUP ⇒ whole group). Only computed if any AUTO defs show.
    const hasAuto = defs.some((d) => d.get('source') === 'AUTO' && d.get('autoKey'));
    const feed = hasAuto ? await computeAutoFeed(company !== 'GROUP' ? company : undefined) : {};

    const entryMatch: Record<string, unknown> = { definitionId: { $in: defIds } };
    if (bdoId) entryMatch.bdoId = bdoId;

    // Entries for the requested period, plus prior entries (for trend).
    const [periodEntries, priorEntries] = await Promise.all([
      KpiEntry.find({ ...entryMatch, period: { $gte: start, $lt: end } }),
      KpiEntry.find({ ...entryMatch, period: { $lt: start } }).sort({ period: -1 }),
    ]);
    const entryByDef: Record<string, ReturnType<typeof KpiEntry.hydrate> | undefined> = {};
    periodEntries.forEach((e) => { entryByDef[e.get('definitionId')] = e; });
    const priorByDef: Record<string, number | null> = {};
    priorEntries.forEach((e) => { const k = e.get('definitionId'); if (!(k in priorByDef)) priorByDef[k] = e.get('current') ?? null; });

    const rows = defs.map((d) => {
      const e = entryByDef[d.id];
      const isAuto = d.get('source') === 'AUTO' && d.get('autoKey');
      // AUTO KPIs take their actual from the live feed; the entry only supplies the target.
      const current = isAuto ? (feed[d.get('autoKey')] ?? null) : (e ? e.get('current') : null);
      const target = e ? e.get('target') : null;
      const hib = d.get('higherIsBetter');
      const { variance, attainment, status } = computeAttainment(current, target, hib);
      return {
        definition: d.toJSON(),
        entry: e ? e.toJSON() : null,
        current, target, variance, attainment, status,
        trend: trendOf(current, priorByDef[d.id] ?? null, hib),
      };
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch KPI board', detail: String(err) });
  }
});

// ─── Entries (period values) ────────────────────────────────────────────────
router.post('/entries', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.body.definitionId || !req.body.period) { res.status(400).json({ error: 'definitionId and period are required' }); return; }
    const entry = await new KpiEntry(req.body).save();
    await logAudit(req, entry, 'create', { newValue: JSON.stringify({ current: entry.get('current'), target: entry.get('target') }) });
    res.status(201).json(entry.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create KPI entry', detail: String(err) });
  }
});

router.put('/entries/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const existing = await KpiEntry.findById(param(req, 'id'));
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

    // Detect value changes so we can both enforce the lock and log them.
    const changes: { field: string; previousValue: string; newValue: string }[] = [];
    for (const f of ['current', 'target'] as const) {
      if (f in req.body && req.body[f] !== existing.get(f)) {
        changes.push({ field: f, previousValue: String(existing.get(f) ?? ''), newValue: String(req.body[f] ?? '') });
      }
    }
    if (existing.get('reviewStatus') === 'LOCKED' && changes.length) {
      res.status(403).json({ error: 'This scorecard is locked. Reopen it before editing values.' });
      return;
    }

    // reviewStatus only moves via the workflow endpoint, never a plain PUT.
    const body = { ...req.body };
    delete body.reviewStatus;
    const entry = await KpiEntry.findByIdAndUpdate(param(req, 'id'), body, { new: true, runValidators: true });
    for (const c of changes) await logAudit(req, entry, 'update', c);
    res.json(entry!.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update KPI entry', detail: String(err) });
  }
});

// Workflow: DRAFT → TARGET_SET → ACTUAL_SUBMITTED → VERIFIED → LOCKED (reopen back to DRAFT).
const TRANSITIONS: Record<string, { from: string[]; to: string; roles: string[] | null }> = {
  submit_target: { from: ['DRAFT'], to: 'TARGET_SET', roles: null },
  submit_actual: { from: ['DRAFT', 'TARGET_SET'], to: 'ACTUAL_SUBMITTED', roles: null },
  verify:        { from: ['ACTUAL_SUBMITTED'], to: 'VERIFIED', roles: MANAGER_ROLES },
  lock:          { from: ['VERIFIED'], to: 'LOCKED', roles: [...ADMIN_ROLES] },
  reopen:        { from: ['TARGET_SET', 'ACTUAL_SUBMITTED', 'VERIFIED', 'LOCKED'], to: 'DRAFT', roles: [...ADMIN_ROLES] },
};

router.post('/entries/:id/transition', requireAuth, async (req: Request, res: Response) => {
  try {
    const t = TRANSITIONS[req.body.action];
    if (!t) { res.status(400).json({ error: 'Invalid action' }); return; }
    const entry = await KpiEntry.findById(param(req, 'id'));
    if (!entry) { res.status(404).json({ error: 'Not found' }); return; }
    const from = entry.get('reviewStatus');
    if (!t.from.includes(from)) { res.status(400).json({ error: `Cannot ${req.body.action} from ${from}` }); return; }
    if (t.roles && !t.roles.includes(req.user!.role)) { res.status(403).json({ error: 'You are not allowed to perform this step' }); return; }
    entry.set('reviewStatus', t.to);
    await entry.save();
    await logAudit(req, entry, req.body.action, { previousValue: from, newValue: t.to, note: req.body.note });
    res.json(entry.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update workflow state', detail: String(err) });
  }
});

// The change history for one entry.
router.get('/entries/:id/audit', requireAuth, async (req: Request, res: Response) => {
  try {
    const logs = await KpiAuditLog.find({ entryId: param(req, 'id') }).sort({ createdAt: -1 });
    res.json(logs.map((l) => l.toJSON()));
  } catch {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

router.delete('/entries/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await KpiEntry.findByIdAndDelete(param(req, 'id'));
    await KpiAuditLog.deleteMany({ entryId: param(req, 'id') });
    res.status(204).send();
  } catch {
    res.status(400).json({ error: 'Failed to delete KPI entry' });
  }
});

export default router;
