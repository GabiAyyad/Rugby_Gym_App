/**
 * Both squads sit in the same clock (Palestine and Cyprus are EET/EEST), so the
 * app has one training day boundary rather than per-team timezones.
 */
export const APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE ?? 'Asia/Nicosia';

/**
 * Date maths runs on 'YYYY-MM-DD' strings anchored at UTC noon, so adding days
 * can never trip over a DST transition and shift the calendar day.
 * Parses a 'YYYY-MM-DD' string into a Date fixed at 12:00 UTC on that day.
 */
function toUtcNoon(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** Converts a Date back to its 'YYYY-MM-DD' calendar-day string (UTC). */
function toISO(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Checks that `value` is both shaped like 'YYYY-MM-DD' and an actual calendar
 * date (rejects things like '2026-02-30' that match the regex but don't exist).
 */
export function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = toUtcNoon(value);
  return !Number.isNaN(parsed.getTime()) && toISO(parsed) === value;
}

/** Today's calendar date in the app timezone, independent of server locale. */
export function todayISO(now = new Date(), timeZone = APP_TIME_ZONE) {
  // 'en-CA' formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Adds (or subtracts, for a negative `days`) whole days to a date string. */
export function addDays(date, days) {
  const d = toUtcNoon(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

/** Whole number of days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from, to) {
  const ms = toUtcNoon(to).getTime() - toUtcNoon(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date) {
  return (toUtcNoon(date).getUTCDay() + 6) % 7;
}

/** Weeks run Monday → Sunday. */
export function startOfWeek(date) {
  return addDays(date, -weekdayIndex(date));
}

/** The Sunday that closes the week `date` falls in. */
export function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

/** True when `date` falls on or between `start` and `end` (inclusive, string comparison). */
export function isWithin(date, start, end) {
  return date >= start && date <= end;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Three-letter weekday label ("Mon", "Tue", ...) for a date string. */
export function weekdayLabel(date) {
  return WEEKDAY_LABELS[weekdayIndex(date)];
}

/** "Mon 31 Aug" — short, unambiguous, no locale surprises. */
export function formatShortDate(date) {
  const d = toUtcNoon(date);
  const month = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${weekdayLabel(date)} ${d.getUTCDate()} ${month}`;
}

/** A 4-week block is the standard mesocycle; end date defaults to 27 days on. */
export function defaultBlockEnd(startDate) {
  return addDays(startDate, 27);
}
