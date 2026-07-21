import cron from 'node-cron';
import { runDailyDigests } from './digest';
import { isEmailConfigured } from './mailer';

// Schedules the twice-daily personalised alert digests. Times are Ghana time (Africa/Accra,
// UTC+0) by default and configurable via env. Runs in-process — fine for a single always-on
// server (Railway). If you scale to multiple instances, move this to an external cron/worker
// so digests aren't sent N times.

const TZ = process.env.DIGEST_TIMEZONE || 'Africa/Accra';
const MORNING_CRON = process.env.DIGEST_MORNING_CRON || '0 7 * * *';  // 07:00 daily
const EVENING_CRON = process.env.DIGEST_EVENING_CRON || '0 17 * * *'; // 17:00 daily
const DIGEST_ENABLED = (process.env.DIGEST_ENABLED ?? 'true').toLowerCase() === 'true';

export function startScheduler(): void {
  if (!DIGEST_ENABLED) {
    console.log('[scheduler] Daily digests disabled (DIGEST_ENABLED=false).');
    return;
  }
  if (!isEmailConfigured()) {
    console.log('[scheduler] Email not configured — daily digests will not run.');
    return;
  }
  if (!cron.validate(MORNING_CRON) || !cron.validate(EVENING_CRON)) {
    console.error('[scheduler] Invalid cron expression — digests not scheduled.', { MORNING_CRON, EVENING_CRON });
    return;
  }

  cron.schedule(MORNING_CRON, () => { runDailyDigests('morning').catch((e) => console.error('[scheduler] morning digest failed:', e)); }, { timezone: TZ });
  cron.schedule(EVENING_CRON, () => { runDailyDigests('evening').catch((e) => console.error('[scheduler] evening digest failed:', e)); }, { timezone: TZ });

  const nowInTz = new Date().toLocaleString('en-GB', { timeZone: TZ });
  console.log(`[scheduler] Digests scheduled in ${TZ}. Time now: ${nowInTz}`);
  console.log(`[scheduler]   morning cron: "${MORNING_CRON}"`);
  console.log(`[scheduler]   evening cron: "${EVENING_CRON}"`);
}
