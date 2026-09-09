import { describe, expect, it } from 'vitest';
import { formatMeasure, parseMeasure, parseRepRange } from './repRange';

describe('parseRepRange', () => {
  it('parses ranges, single numbers and gives up on prose', () => {
    expect(parseRepRange('8-10')).toEqual({ min: 8, max: 10 });
    expect(parseRepRange('3 - 6')).toEqual({ min: 3, max: 6 });
    expect(parseRepRange('8–10')).toEqual({ min: 8, max: 10 });
    expect(parseRepRange('5')).toEqual({ min: 5, max: 5 });
    expect(parseRepRange('AMRAP')).toBeNull();
    expect(parseRepRange('')).toBeNull();
  });

  it('normalises a backwards range', () => {
    expect(parseRepRange('10-8')).toEqual({ min: 8, max: 10 });
  });
});

describe('parseMeasure', () => {
  it('splits a value from its unit', () => {
    expect(parseMeasure('40m')).toEqual({ value: 40, unit: 'm' });
    expect(parseMeasure('30 s')).toEqual({ value: 30, unit: 's' });
    expect(parseMeasure('12')).toEqual({ value: 12, unit: 'reps' });
    expect(parseMeasure('as far as you can')).toBeNull();
  });

  it('round-trips through formatMeasure', () => {
    expect(formatMeasure({ value: 44, unit: 'm' })).toBe('44m');
    expect(formatMeasure({ value: 12, unit: 'reps' })).toBe('12');
  });
});
