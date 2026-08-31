import { describe, expect, it } from 'vitest';
import { resolveActiveProgram, type ProgramLike } from './activeProgram';

const base: Omit<ProgramLike, 'id' | 'startDate' | 'endDate'> = {
  teamId: 'team-pal',
  positionGroup: 'forward',
  isActiveOverride: null,
};

const september: ProgramLike = { ...base, id: 'sep', startDate: '2026-09-01', endDate: '2026-09-28' };
const october: ProgramLike = { ...base, id: 'oct', startDate: '2026-09-29', endDate: '2026-10-26' };

describe('resolveActiveProgram', () => {
  it('picks the block covering the date', () => {
    expect(resolveActiveProgram([september, october], '2026-09-15')?.id).toBe('sep');
    expect(resolveActiveProgram([september, october], '2026-10-01')?.id).toBe('oct');
  });

  it('switches over on its own at the block boundary', () => {
    expect(resolveActiveProgram([september, october], '2026-09-28')?.id).toBe('sep');
    expect(resolveActiveProgram([september, october], '2026-09-29')?.id).toBe('oct');
  });

  it('returns null in a gap between blocks', () => {
    expect(resolveActiveProgram([september], '2026-10-05')).toBeNull();
    expect(resolveActiveProgram([], '2026-09-15')).toBeNull();
  });

  it('honours a forced override outside the date window', () => {
    const forced = { ...october, isActiveOverride: true };
    expect(resolveActiveProgram([september, forced], '2026-09-15')?.id).toBe('oct');
  });

  it('takes a block out of rotation when the override is false', () => {
    const disabled = { ...september, isActiveOverride: false };
    expect(resolveActiveProgram([disabled, october], '2026-09-15')).toBeNull();
  });

  it('keeps teams and position groups apart', () => {
    const cyprusBacks: ProgramLike = {
      ...september,
      id: 'cyp',
      teamId: 'team-cyp',
      positionGroup: 'back',
    };
    const found = resolveActiveProgram([september, cyprusBacks], '2026-09-15', {
      teamId: 'team-cyp',
      positionGroup: 'back',
    });
    expect(found?.id).toBe('cyp');

    expect(
      resolveActiveProgram([cyprusBacks], '2026-09-15', { teamId: 'team-pal', positionGroup: 'forward' }),
    ).toBeNull();
  });

  it('gives an overlapping shorter block priority', () => {
    const deload: ProgramLike = { ...base, id: 'deload', startDate: '2026-09-15', endDate: '2026-09-21' };
    expect(resolveActiveProgram([september, deload], '2026-09-16')?.id).toBe('deload');
  });
});
