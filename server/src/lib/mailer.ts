import nodemailer, { Transporter } from 'nodemailer';

// Centralised SMTP mailer. All email in the app goes through here so there is a single
// place to configure the transport (Gmail SMTP via nodemailer by default) and to keep
// sending non-fatal — a mail failure should never crash a request.

const EMAIL_ENABLED = (process.env.EMAIL_ENABLED ?? 'false').toLowerCase() === 'true';
const SMTP_HOST = process.env.SMTP_HOST ?? 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const SMTP_SECURE = (process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true';
// Gmail App Passwords are displayed with spaces; strip them so either form works.
const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = (process.env.SMTP_PASS ?? '').replace(/\s+/g, '');
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

let transporter: Transporter | null = null;

export function isEmailConfigured(): boolean {
  return EMAIL_ENABLED && Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (!isEmailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export type MailOptions = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
};

export type SendResult = { sent: boolean; skipped?: boolean; messageId?: string; error?: string };

// Sends an email. Never throws — returns a result object so callers can decide what to do.
export async function sendEmail(opts: MailOptions): Promise<SendResult> {
  const tx = getTransporter();
  if (!tx) {
    console.warn('[mailer] Email not configured or disabled — skipping send to', opts.to);
    return { sent: false, skipped: true, error: 'Email not configured' };
  }
  try {
    const info = await tx.sendMail({
      from: SMTP_FROM,
      to: opts.to,
      cc: opts.cc,
      bcc: opts.bcc,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] Failed to send email:', err);
    return { sent: false, error: String(err) };
  }
}

// Verifies the SMTP connection/credentials. Called on startup to surface misconfiguration early.
export async function verifyEmailTransport(): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) {
    console.log('[mailer] Email disabled or not configured (set EMAIL_ENABLED=true and SMTP_* vars to enable).');
    return false;
  }
  try {
    await tx.verify();
    console.log(`[mailer] SMTP ready — ${SMTP_HOST}:${SMTP_PORT} as ${SMTP_USER}`);
    return true;
  } catch (err) {
    console.error('[mailer] SMTP verification failed:', err);
    return false;
  }
}
