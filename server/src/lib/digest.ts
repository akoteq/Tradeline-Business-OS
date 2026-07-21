import { computeAlerts } from '../routes/alerts';
import { sendEmail } from './mailer';
import { User, INDIVIDUAL_ROLES, UserRole } from '../models/User';
import { BDO } from '../models/BDO';

// Builds and sends the twice-daily personalised alert digest. Each recipient gets a warm,
// first-name-addressed email listing only the items that are actually theirs to act on.
// Individual contributors are scoped to their own pipeline; executives/admins get the
// group-wide picture. People with nothing pending are skipped (no empty "all clear" spam).

export type TimeOfDay = 'morning' | 'evening';
type Alerts = Awaited<ReturnType<typeof computeAlerts>>;

const fmtGhs = (n: number) => 'GHS ' + (n ?? 0).toLocaleString('en-GH', { maximumFractionDigits: 0 });

function firstName(full?: string | null): string {
  if (!full) return 'there';
  return full.trim().split(/\s+/)[0] || 'there';
}

function isIndividual(role: UserRole): boolean {
  return INDIVIDUAL_ROLES.includes(role);
}

// ── Copy ─────────────────────────────────────────────────────────────────────
const INTRO: Record<TimeOfDay, string> = {
  morning:
    "Good morning! Here's your briefing to start the day. A few things need your attention — kindly take a look when you get a moment:",
  evening:
    "Good evening! Before you wrap up, here's a quick look at what still needs action. A little follow-up now keeps things moving tomorrow:",
};

const CLOSING =
  "You've got this. If you need any support on any of these, just reply to this email or reach out to your lead.";

// ── HTML ─────────────────────────────────────────────────────────────────────
const td = (s: string, extra = '') =>
  `<td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;${extra}">${s}</td>`;

function block(title: string, blurb: string, rowsHtml: string, count: number): string {
  if (count === 0) return '';
  return `
    <div style="margin:20px 0 4px">
      <div style="font-size:14px;font-weight:600;color:#111">${title}</div>
      <div style="font-size:13px;color:#6b7280;margin:2px 0 8px">${blurb}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">${rowsHtml}</table>
    </div>`;
}

function daysLabel(days: number): string {
  if (days < 0) return `<span style="color:#dc2626;font-weight:600">${-days}d overdue</span>`;
  if (days === 0) return `<span style="color:#d97706;font-weight:600">due today</span>`;
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

function buildHtml(name: string, timeOfDay: TimeOfDay, a: Alerts): string {
  const deadlines = a.deadlines.slice(0, 20).map((d) =>
    `<tr>${td(d.businessName)}${td(d.subtype, 'color:#6b7280')}${td(daysLabel(d.daysUntil), 'text-align:right')}</tr>`).join('');
  const payments = a.payments.slice(0, 20).map((p) =>
    `<tr>${td(p.businessName)}${td(p.company, 'color:#6b7280')}${td(fmtGhs(p.balance), 'text-align:right')}</tr>`).join('');
  const risks = a.highValueRisks.slice(0, 20).map((r) =>
    `<tr>${td(r.businessName)}${td(r.company, 'color:#6b7280')}${td(fmtGhs(r.value), 'text-align:right')}</tr>`).join('');
  const stale = a.stale.slice(0, 20).map((s) =>
    `<tr>${td(s.businessName)}${td(s.type, 'color:#6b7280')}${td(`${s.daysSinceUpdate}d idle`, 'text-align:right')}</tr>`).join('');

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:8px">
    <p style="font-size:16px;margin:0 0 6px"><strong>Hello ${name},</strong></p>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 4px">${INTRO[timeOfDay]}</p>

    ${block('⏰ Deadlines approaching', 'Deals, tasks & proposals coming due — kindly look into them before the date passes.', deadlines, a.deadlines.length)}
    ${block('💰 Payments overdue', 'Please follow up with these clients on outstanding balances.', payments, a.payments.length)}
    ${block('⚠️ High-value deals at risk', 'Worth your priority attention — a nudge here protects real revenue.', risks, a.highValueRisks.length)}
    ${block('🕓 Deals gone quiet', "These haven’t moved in a while; a quick check-in could get them going again.", stale, a.stale.length)}

    ${a.kpiRisks.length ? `<p style="font-size:13px;color:#6b7280;margin:18px 0 0">📉 You also have <strong>${a.kpiRisks.length}</strong> KPI${a.kpiRisks.length === 1 ? '' : 's'} off track this month.</p>` : ''}

    <p style="font-size:14px;color:#374151;line-height:1.6;margin:22px 0 4px">${CLOSING}</p>
    <p style="font-size:13px;color:#9ca3af;margin:16px 0 0">— Tradeline &amp; BAPX</p>
  </div>`;
}

function buildText(name: string, timeOfDay: TimeOfDay, a: Alerts): string {
  return [
    `Hello ${name},`,
    '',
    INTRO[timeOfDay],
    '',
    `- Deadlines approaching: ${a.deadlines.length}`,
    `- Payments overdue: ${a.payments.length}`,
    `- High-value deals at risk: ${a.highValueRisks.length}`,
    `- Deals gone quiet: ${a.stale.length}`,
    `- KPIs off track: ${a.kpiRisks.length}`,
    '',
    CLOSING,
    '— Tradeline & BAPX',
  ].join('\n');
}

// Renders the full email (subject/html/text) for a recipient. Exposed so it can be
// previewed/tested without running the whole batch.
export function renderDigest(name: string, timeOfDay: TimeOfDay, a: Alerts): { subject: string; html: string; text: string } {
  const critical = a.summary.critical > 0 ? ` — ${a.summary.critical} critical` : '';
  return {
    subject: `${timeOfDay === 'morning' ? 'Morning' : 'Evening'} briefing: ${a.summary.total} item${a.summary.total === 1 ? '' : 's'} need attention${critical}`,
    html: buildHtml(firstName(name), timeOfDay, a),
    text: buildText(firstName(name), timeOfDay, a),
  };
}

export type DigestRunResult = {
  timeOfDay: TimeOfDay;
  candidates: number;
  sent: number;
  skippedEmpty: number;
  failed: number;
  recipients: string[];
};

// Runs the digest for every user with an email. Returns a summary of what happened.
export async function runDailyDigests(timeOfDay: TimeOfDay): Promise<DigestRunResult> {
  const users = await User.find({ email: { $ne: null } });

  // Resolve BDO display names for greeting, in one query.
  const bdoIds = users.map((u) => u.get('bdoId')).filter(Boolean) as string[];
  const bdos = bdoIds.length ? await BDO.find({ _id: { $in: bdoIds } }) : [];
  const nameById: Record<string, string> = {};
  bdos.forEach((b) => { nameById[b.id] = b.get('name'); });

  const result: DigestRunResult = { timeOfDay, candidates: users.length, sent: 0, skippedEmpty: 0, failed: 0, recipients: [] };

  for (const user of users) {
    const email = user.get('email') as string;
    const role = user.get('role') as UserRole;
    const bdoId = user.get('bdoId') as string | null;

    // Individual contributors see only their own; everyone else gets the group view.
    const scoped = isIndividual(role) && bdoId;
    if (isIndividual(role) && !bdoId) { result.skippedEmpty += 1; continue; } // no profile → nothing to scope

    const alerts = await computeAlerts(scoped ? { bdoId } : {});
    if (alerts.summary.total === 0) { result.skippedEmpty += 1; continue; }

    const rendered = renderDigest(bdoId ? nameById[bdoId] : 'there', timeOfDay, alerts);
    const send = await sendEmail({ to: email, ...rendered });

    if (send.sent) { result.sent += 1; result.recipients.push(email); }
    else result.failed += 1;
  }

  console.log(`[digest] ${timeOfDay}: sent ${result.sent}, skipped ${result.skippedEmpty}, failed ${result.failed} (of ${result.candidates})`);
  return result;
}
