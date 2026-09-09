import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  defaultBlockEnd,
  endOfWeek,
  formatShortDate,
  isISODate,
  startOfWeek,
  todayISO,
  weekdayLabel,
} from './week';

describe('week maths', () => {
  it('treats weeks as Monday to Sunday', () => {
    expect(startOfWeek('2026-08-31')).toBe('2026-08-31'); // a Monday
    expect(startOfWeek('2026-09-06')).toBe('2026-08-31'); // the Sunday after
    expect(endOfWeek('2026-08-31')).toBe('2026-09-06');
  });

  it('adds days across a month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('survives a DST transition without shifting the calendar day', () => {
    // EU clocks go back on the last Sunday in October.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('defaults a block to four weeks', () => {
    expect(defaultBlockEnd('2026-09-01')).toBe('2026-09-28');
    expect(daysBetween('2026-09-01', defaultBlockEnd('2026-09-01'))).toBe(27);
  });

  it('reads today in the app timezone, not the server locale', () => {
    // 22:30 UTC on the 31st is already the 1st in Nicosia (UTC+3 in summer).
    const lateEvening = new Date('2026-08-31T22:30:00Z');
    expect(todayISO(lateEvening, 'Asia/Nicosia')).toBe('2026-09-01');
    expect(todayISO(lateEvening, 'UTC')).toBe('2026-08-31');
  });

  it('labels and validates dates', () => {
    expect(weekdayLabel('2026-08-31')).toBe('Mon');
    expect(formatShortDate('2026-08-31')).toBe('Mon 31 Aug');
    expect(isISODate('2026-08-31')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('31/08/2026')).toBe(false);
  });
});
