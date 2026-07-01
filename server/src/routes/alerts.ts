import { Router, Request, Response } from 'express';
import { TradelineDeal } from '../models/TradelineDeal';
import { BapxDeal } from '../models/BapxDeal';
import { CompanyDeal } from '../models/CompanyDeal';
import { withBdo, bdoIdsByName } from '../lib/mongoUtils';
import { qs } from '../lib/query';

const router = Router();

const STALE_DAYS = 14;
const DEADLINE_WINDOW_DAYS = 7;
const OPEN_HEALTH = { $nin: ['CLOSED_WON', 'CLOSED_LOST'] };

type Urgency = 'overdue' | 'today' | '1day' | '3days' | 'week';

function daysBetween(later: Date, earlier: Date) {
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyForDaysUntil(days: number): Urgency {
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 1) return '1day';
  if (days <= 3) return '3days';
  return 'week';
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), bdoId = qs(req, 'bdoId');
    const dealFilter: Record<string, unknown> = {};
    if (bdo) {
      const ids = await bdoIdsByName(bdo);
      dealFilter.bdoId = { $in: ids };
    }
    if (bdoId) dealFilter.bdoId = bdoId;

    const now = new Date();
    const windowEnd = new Date(now.getTime() + DEADLINE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const staleThreshold = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);

    // Deadlines — only TradelineDeal currently tracks a real due date
    const dueSoonDocs = await TradelineDeal.find({
      ...dealFilter,
      dueDate: { $ne: null, $lte: windowEnd },
      dealStage: OPEN_HEALTH,
      dealHealth: OPEN_HEALTH,
    }).sort({ dueDate: 1 });

    const dueSoonJson = await withBdo(dueSoonDocs);
    const deadlines = dueSoonJson.map((d) => {
      const dueDate = new Date(d.dueDate as string);
      const days = daysBetween(dueDate, now);
      return {
        id: d.id as string,
        type: 'TRADELINE' as const,
        businessName: d.businessName as string,
        dueDate: d.dueDate,
        daysUntil: days,
        urgency: urgencyForDaysUntil(days),
        bdo: d.bdo as { id: string; name: string } | null,
      };
    });

    // Stale deals — open deals with no updates in a while
    const [staleBapx, staleTradeline, staleCompany] = await Promise.all([
      BapxDeal.find({ ...dealFilter, updatedAt: { $lte: staleThreshold }, dealHealth: OPEN_HEALTH }).sort({ updatedAt: 1 }),
      TradelineDeal.find({ ...dealFilter, updatedAt: { $lte: staleThreshold }, dealHealth: OPEN_HEALTH }).sort({ updatedAt: 1 }),
      CompanyDeal.find({ ...dealFilter, updatedAt: { $lte: staleThreshold }, dealHealth: OPEN_HEALTH }).sort({ updatedAt: 1 }),
    ]);

    const toStale = async (docs: typeof staleBapx | typeof staleTradeline | typeof staleCompany, type: 'BAPX' | 'TRADELINE' | 'COMPANY') => {
      const json = await withBdo(docs);
      return json.map((d) => ({
        id: d.id as string,
        type,
        businessName: d.businessName as string,
        dealHealth: d.dealHealth as string,
        lastUpdated: d.updatedAt,
        daysSinceUpdate: daysBetween(now, new Date(d.updatedAt as string)),
        bdo: d.bdo as { id: string; name: string } | null,
      }));
    };

    const stale = [
      ...(await toStale(staleBapx, 'BAPX')),
      ...(await toStale(staleTradeline, 'TRADELINE')),
      ...(await toStale(staleCompany, 'COMPANY')),
    ].sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

    res.json({ deadlines, stale });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

export default router;
