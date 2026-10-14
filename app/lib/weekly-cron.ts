import { timingSafeEqual, createHash } from 'node:crypto';

export function isAuthorizedCronRequest(authorization: string | null, secret: string | undefined) {
  if (!secret) return false;
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  const received = createHash('sha256').update(authorization ?? '').digest();
  return timingSafeEqual(expected, received);
}

// Monday (Europe/Madrid) of the week containing `now`, as YYYY-MM-DD.
export function getMadridWeekStart(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const date = new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
