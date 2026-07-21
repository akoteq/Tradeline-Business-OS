import { BapxDeal } from '../models/BapxDeal';
import { TradelineDeal } from '../models/TradelineDeal';
import { CompanyDeal } from '../models/CompanyDeal';
import { Lead } from '../models/Lead';
import { Referral } from '../models/Referral';
import { Partnership } from '../models/Partnership';
import { GrantLoanTracker } from '../models/GrantLoanTracker';

// Auto-feed: computes KPI *actuals* live from the app's own data (snapshot / current
// cumulative values, not per-period deltas). A KpiDefinition with source='AUTO' and a
// matching `autoKey` gets its current value from here. Everything honours the board's
// company filter where the underlying data carries a company; sources without a company
// field (leads, grants) fall back to the group total.

// The catalog of available feeds, surfaced to the admin UI so AUTO KPIs can be wired up.
export const AUTO_KEYS: { key: string; label: string; unit: string }[] = [
  { key: 'revenue_received',     label: 'Revenue Received (cumulative)',      unit: 'CURRENCY' },
  { key: 'revenue_outstanding',  label: 'Outstanding Revenue',               unit: 'CURRENCY' },
  { key: 'pipeline_value',       label: 'Pipeline Value (open deals)',       unit: 'CURRENCY' },
  { key: 'deals_total',          label: 'Total Deals',                       unit: 'COUNT' },
  { key: 'deals_closed_won',     label: 'Deals Closed (Won)',                unit: 'COUNT' },
  { key: 'won_value',            label: 'Closed-Won Value',                  unit: 'CURRENCY' },
  { key: 'leads_total',          label: 'Leads',                             unit: 'COUNT' },
  { key: 'leads_qualified',      label: 'Qualified Leads',                   unit: 'COUNT' },
  { key: 'leads_converted',      label: 'Converted Leads',                   unit: 'COUNT' },
  { key: 'cross_sell_revenue',   label: 'Cross-sell Revenue (converted)',   unit: 'CURRENCY' },
  { key: 'cross_sell_converted', label: 'Cross-sell Conversions',           unit: 'COUNT' },
  { key: 'active_partnerships',  label: 'Active Partnerships',              unit: 'COUNT' },
  { key: 'capital_mobilised',    label: 'Capital Mobilised (approved)',     unit: 'CURRENCY' },
];

export type AutoFeed = Record<string, number>;

type DealStats = { received: number; outstanding: number; pipeline: number; total: number; closedWon: number; wonValue: number };
const EMPTY: DealStats = { received: 0, outstanding: 0, pipeline: 0, total: 0, closedWon: 0, wonValue: 0 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function aggDeals(Model: any, match: Record<string, unknown>, potentialField: string, hasRevenue: boolean): Promise<DealStats> {
  const [row] = await Model.aggregate([
    { $match: match },
    { $group: {
      _id: null,
      total: { $sum: 1 },
      closedWon: { $sum: { $cond: [{ $eq: ['$dealStage', 'CLOSED_WON'] }, 1, 0] } },
      received: { $sum: hasRevenue ? '$revenueReceivedGhs' : 0 },
      outstanding: { $sum: hasRevenue ? '$balanceGhs' : 0 },
      pipeline: { $sum: { $cond: [{ $in: ['$dealStage', ['CLOSED_WON', 'CLOSED_LOST']] }, 0, { $ifNull: [`$${potentialField}`, 0] }] } },
      wonValue: { $sum: { $cond: [{ $eq: ['$dealStage', 'CLOSED_WON'] }, { $ifNull: [`$${potentialField}`, 0] }, 0] } },
    } },
  ]);
  return row ? { ...EMPTY, ...row, _id: undefined } as DealStats : EMPTY;
}

// Combines the right deal collection(s) for a company filter. No filter ⇒ whole group.
async function dealStats(company?: string): Promise<DealStats> {
  const parts: DealStats[] = [];
  const all = !company;
  if (all || company === 'BAPX') parts.push(await aggDeals(BapxDeal, {}, 'targetGhs', false));
  if (all || company === 'TRADELINE') parts.push(await aggDeals(TradelineDeal, {}, 'revenuePotentialGhs', true));
  if (all) parts.push(await aggDeals(CompanyDeal, {}, 'revenuePotentialGhs', true));
  else if (company !== 'BAPX' && company !== 'TRADELINE') parts.push(await aggDeals(CompanyDeal, { company }, 'revenuePotentialGhs', true));
  return parts.reduce((a, s) => ({
    received: a.received + s.received, outstanding: a.outstanding + s.outstanding, pipeline: a.pipeline + s.pipeline,
    total: a.total + s.total, closedWon: a.closedWon + s.closedWon, wonValue: a.wonValue + s.wonValue,
  }), EMPTY);
}

const countBy = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Model: any, match: Record<string, unknown>,
): Promise<number> => Model.countDocuments(match);

// Computes every auto-feed value for the given company filter, in one pass.
export async function computeAutoFeed(company?: string): Promise<AutoFeed> {
  const deals = await dealStats(company);

  // Referrals (company-aware: involving the company either side)
  const refMatch: Record<string, unknown> = company ? { $or: [{ toCompany: company }, { fromCompany: company }] } : {};
  const [crossConverted, crossRevAgg] = await Promise.all([
    countBy(Referral, { ...refMatch, status: 'CONVERTED' }),
    Referral.aggregate([{ $match: { ...refMatch, status: 'CONVERTED' } }, { $group: { _id: null, v: { $sum: '$revenueGhs' } } }]),
  ]);

  // Partnerships (only BAPX/TRADELINE carry an entity; otherwise group total)
  const partMatch: Record<string, unknown> = { status: 'ACTIVE' };
  if (company === 'BAPX' || company === 'TRADELINE') partMatch.tradelineEntity = company;
  const activePartnerships = await countBy(Partnership, partMatch);

  // Leads & grants have no company field — group totals regardless of filter.
  const [leadsTotal, leadsQualified, leadsConverted, capitalAgg] = await Promise.all([
    countBy(Lead, {}),
    countBy(Lead, { status: 'QUALIFIED' }),
    countBy(Lead, { status: 'CONVERTED' }),
    GrantLoanTracker.aggregate([{ $match: { status: { $in: ['APPROVED', 'DISBURSED'] } } }, { $group: { _id: null, v: { $sum: '$amountApproved' } } }]),
  ]);

  return {
    revenue_received: deals.received,
    revenue_outstanding: deals.outstanding,
    pipeline_value: deals.pipeline,
    deals_total: deals.total,
    deals_closed_won: deals.closedWon,
    won_value: deals.wonValue,
    leads_total: leadsTotal,
    leads_qualified: leadsQualified,
    leads_converted: leadsConverted,
    cross_sell_revenue: crossRevAgg[0]?.v ?? 0,
    cross_sell_converted: crossConverted,
    active_partnerships: activePartnerships,
    capital_mobilised: capitalAgg[0]?.v ?? 0,
  };
}
