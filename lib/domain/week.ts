import type { ISODate } from '@/types/common';

/**
 * Both squads sit in the same clock (Palestine and Cyprus are EET/EEST), so the
 * app has one training day boundary rather than per-team timezones.
 */
export const APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE ?? 'Asia/Nicosia';

/**
 * Date maths runs on 'YYYY-MM-DD' strings anchored at UTC noon, so adding days
 * can never trip over a DST transition and shift the calendar day.
 */
function toUtcNoon(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function toISO(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = toUtcNoon(value);
  return !Number.isNaN(parsed.getTime()) && toISO(parsed) === value;
}

/** Today's calendar date in the app timezone, independent of server locale. */
export function todayISO(now: Date = new Date(), timeZone: string = APP_TIME_ZONE): ISODate {
  // 'en-CA' formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = toUtcNoon(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const ms = toUtcNoon(to).getTime() - toUtcNoon(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: ISODate): number {
  return (toUtcNoon(date).getUTCDay() + 6) % 7;
}

/** Weeks run Monday → Sunday. */
export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -weekdayIndex(date));
}

export function endOfWeek(date: ISODate): ISODate {
  return addDays(startOfWeek(date), 6);
}

export function isWithin(date: ISODate, start: ISODate, end: ISODate): boolean {
  return date >= start && date <= end;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function weekdayLabel(date: ISODate): string {
  return WEEKDAY_LABELS[weekdayIndex(date)];
}

/** "Mon 31 Aug" — short, unambiguous, no locale surprises. */
export function formatShortDate(date: ISODate): string {
  const d = toUtcNoon(date);
  const month = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${weekdayLabel(date)} ${d.getUTCDate()} ${month}`;
}

/** A 4-week block is the standard mesocycle; end date defaults to 27 days on. */
export function defaultBlockEnd(startDate: ISODate): ISODate {
  return addDays(startDate, 27);
}
