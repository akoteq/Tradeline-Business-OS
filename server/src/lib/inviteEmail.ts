import { sendEmail, SendResult } from './mailer';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://afrca-osss-client-w9vb.vercel.app';

// Sends the onboarding invite: greets by first name, gives the login email + temporary
// password + dashboard link, and explains the first-login password change.
export async function sendInviteEmail(opts: { to: string; name?: string | null; password: string; resend?: boolean }): Promise<SendResult> {
  const first = (opts.name ?? '').trim().split(/\s+/)[0] || 'there';
  const heading = opts.resend ? 'Your login has been reset' : 'Welcome to Africa SME-OS';
  const intro = opts.resend
    ? 'Your access has been refreshed. Here are your updated login details:'
    : "An account has been created for you on Africa SME-OS — the dashboard for BAPX, Tradeline and the group. Here are your login details:";

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:8px">
    <h2 style="margin:0 0 6px">${heading}</h2>
    <p style="font-size:15px;margin:0 0 4px"><strong>Hello ${first},</strong></p>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 14px">${intro}</p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px">
      <tr><td style="padding:8px 10px;background:#f8fafc;border:1px solid #eef2f7;color:#6b7280;width:150px">Email</td>
          <td style="padding:8px 10px;border:1px solid #eef2f7;font-weight:600">${opts.to}</td></tr>
      <tr><td style="padding:8px 10px;background:#f8fafc;border:1px solid #eef2f7;color:#6b7280">Temporary password</td>
          <td style="padding:8px 10px;border:1px solid #eef2f7;font-family:monospace;font-weight:700;letter-spacing:0.5px">${opts.password}</td></tr>
    </table>

    <a href="${DASHBOARD_URL}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px">Open the dashboard →</a>
    <p style="font-size:12px;color:#9ca3af;margin:8px 0 16px">${DASHBOARD_URL}</p>

    <p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 4px">
      For your security, you'll be asked to <strong>set your own password</strong> the first time you log in.
    </p>
    <p style="font-size:13px;color:#9ca3af;margin:16px 0 0">— Tradeline &amp; BAPX</p>
  </div>`;

  const text = [
    `Hello ${first},`,
    '',
    intro,
    '',
    `Email: ${opts.to}`,
    `Temporary password: ${opts.password}`,
    `Dashboard: ${DASHBOARD_URL}`,
    '',
    "You'll be asked to set your own password the first time you log in.",
    '— Tradeline & BAPX',
  ].join('\n');

  return sendEmail({ to: opts.to, subject: opts.resend ? 'Your Africa SME-OS login was reset' : 'Your Africa SME-OS account', html, text });
}
