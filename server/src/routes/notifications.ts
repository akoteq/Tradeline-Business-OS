import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { sendEmail, isEmailConfigured } from '../lib/mailer';
import { computeAlerts } from './alerts';
import { runDailyDigests, TimeOfDay } from '../lib/digest';
import { User, ADMIN_ROLES } from '../models/User';

const router = Router();

const fmtGhs = (n: number) => 'GHS ' + (n ?? 0).toLocaleString('en-GH', { maximumFractionDigits: 0 });

// Resolves the recipient list: an explicit address/list wins, otherwise every admin/CEO login.
async function resolveRecipients(to?: string | string[]): Promise<string[]> {
  if (to) return (Array.isArray(to) ? to : [to]).map((s) => s.trim()).filter(Boolean);
  const admins = await User.find({ role: { $in: ADMIN_ROLES } });
  return admins.map((u) => u.get('email') as string).filter(Boolean);
}

// Reports whether email is turned on and fully configured.
router.get('/status', requireAuth, (_req: Request, res: Response) => {
  res.json({ configured: isEmailConfigured() });
});

// Sends a test email so config can be verified from the UI. Defaults to the caller's own address.
router.post('/test', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    let to = req.body?.to as string | undefined;
    if (!to && req.user?.userId) {
      const me = await User.findById(req.user.userId);
      to = me?.get('email');
    }
    if (!to) { res.status(400).json({ error: 'No recipient — provide "to" or set an email on your account.' }); return; }

    const result = await sendEmail({
      to,
      subject: 'Test email — Tradeline & BAPX',
      text: 'This is a test email. If you received this, SMTP notifications are working.',
      html: '<p>This is a test email.</p><p>If you received this, <strong>SMTP notifications are working.</strong></p>',
    });
    if (!result.sent) { res.status(result.skipped ? 503 : 500).json({ error: result.error ?? 'Failed to send', ...result }); return; }
    res.json({ ok: true, to, messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test email', detail: String(err) });
  }
});

// Sends a one-off custom notification email to explicit recipients.
router.post('/send', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { to, subject, message } = req.body ?? {};
    const recipients = await resolveRecipients(to);
    if (recipients.length === 0) { res.status(400).json({ error: 'No recipients' }); return; }
    if (!subject || !message) { res.status(400).json({ error: 'subject and message are required' }); return; }

    const result = await sendEmail({
      to: recipients,
      subject: String(subject),
      text: String(message),
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#111">${String(message).replace(/\n/g, '<br>')}</div>`,
    });
    if (!result.sent) { res.status(result.skipped ? 503 : 500).json({ error: result.error ?? 'Failed to send', ...result }); return; }
    res.json({ ok: true, recipients, messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send notification', detail: String(err) });
  }
});

// Builds and emails the current alerts digest (deadlines, stale deals, overdue
// payments, high-value risks, KPI risks). Defaults to all admin/CEO recipients.
router.post('/alerts-digest', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const recipients = await resolveRecipients(req.body?.to);
    if (recipients.length === 0) { res.status(400).json({ error: 'No recipients — no admin/CEO users with an email.' }); return; }

    const a = await computeAlerts();
    const html = buildDigestHtml(a);
    const subject = `Alerts digest — ${a.summary.total} open (${a.summary.critical} critical)`;

    const result = await sendEmail({ to: recipients, subject, html, text: buildDigestText(a) });
    if (!result.sent) { res.status(result.skipped ? 503 : 500).json({ error: result.error ?? 'Failed to send', ...result }); return; }
    res.json({ ok: true, recipients, summary: a.summary, messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send alerts digest', detail: String(err) });
  }
});

// Manually triggers the personalised twice-daily digest run (the same job cron fires).
// Handy for testing or an ad-hoc send. Body: { timeOfDay?: 'morning' | 'evening' }.
router.post('/run-digests', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const t = (req.body?.timeOfDay === 'evening' ? 'evening' : 'morning') as TimeOfDay;
    const result = await runDailyDigests(t);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to run digests', detail: String(err) });
  }
});

type Alerts = Awaited<ReturnType<typeof computeAlerts>>;

function buildDigestText(a: Alerts): string {
  const lines = [
    `Alerts digest — ${a.summary.total} open items (${a.summary.critical} critical)`,
    '',
    `Deadlines approaching: ${a.deadlines.length}`,
    `Stale deals: ${a.stale.length}`,
    `Overdue payments: ${a.payments.length}`,
    `High-value deals at risk: ${a.highValueRisks.length}`,
    `KPIs off track: ${a.kpiRisks.length}`,
  ];
  return lines.join('\n');
}

function section(title: string, count: number, rowsHtml: string): string {
  return `
    <h3 style="margin:18px 0 6px;font-size:14px;color:#111">${title} <span style="color:#6b7280;font-weight:400">(${count})</span></h3>
    ${count === 0 ? '<p style="color:#9ca3af;font-size:13px;margin:0">None.</p>' : `<table style="width:100%;border-collapse:collapse;font-size:13px">${rowsHtml}</table>`}
  `;
}

const td = (s: string, extra = '') => `<td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;${extra}">${s}</td>`;

function buildDigestHtml(a: Alerts): string {
  const deadlines = a.deadlines.slice(0, 15).map((d) =>
    `<tr>${td(d.businessName)}${td(d.subtype, 'color:#6b7280')}${td(d.daysUntil < 0 ? `${-d.daysUntil}d overdue` : `in ${d.daysUntil}d`, 'text-align:right')}</tr>`).join('');
  const payments = a.payments.slice(0, 15).map((p) =>
    `<tr>${td(p.businessName)}${td(p.company, 'color:#6b7280')}${td(fmtGhs(p.balance), 'text-align:right')}</tr>`).join('');
  const risks = a.highValueRisks.slice(0, 15).map((r) =>
    `<tr>${td(r.businessName)}${td(r.company, 'color:#6b7280')}${td(fmtGhs(r.value), 'text-align:right')}</tr>`).join('');
  const stale = a.stale.slice(0, 15).map((s) =>
    `<tr>${td(s.businessName)}${td(s.type, 'color:#6b7280')}${td(`${s.daysSinceUpdate}d idle`, 'text-align:right')}</tr>`).join('');

  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;color:#111;max-width:640px;margin:0 auto">
    <h2 style="margin:0 0 4px">Alerts Digest</h2>
    <p style="color:#6b7280;font-size:13px;margin:0 0 8px">
      ${a.summary.total} open items · <strong style="color:#dc2626">${a.summary.critical} critical</strong>
    </p>
    ${section('Deadlines approaching', a.deadlines.length, deadlines)}
    ${section('Overdue payments', a.payments.length, payments)}
    ${section('High-value deals at risk', a.highValueRisks.length, risks)}
    ${section('Stale deals', a.stale.length, stale)}
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">KPIs off track this month: ${a.kpiRisks.length}</p>
  </div>`;
}

export default router;
