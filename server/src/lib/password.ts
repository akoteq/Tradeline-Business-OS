import crypto from 'crypto';

// Generates a readable but reasonably strong temporary password. Ambiguous characters
// (0/O, 1/l/I) are excluded so it's easy to read off an email and type once. Always
// includes at least one uppercase letter and one digit.
export function generateTempPassword(): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const pick = (set: string) => set[crypto.randomInt(set.length)];

  const chars = [pick(upper), pick(digits)];
  const pool = lower + upper + digits;
  for (let i = 0; i < 8; i++) chars.push(pick(pool));
  // Shuffle so the guaranteed upper/digit aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
