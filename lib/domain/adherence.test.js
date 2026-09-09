import { describe, expect, it } from 'vitest';
import { calculateAdherence, estimateOneRepMax, sortByRisk } from './adherence';

const week = { weekStart: '2026-08-31', weekEnd: '2026-09-06', today: '2026-09-03' };

function player(id, overrides = {}) {
  return {
    playerId: id,
    playerName: id,
    teamId: 'team-pal',
    teamName: 'Palestine',
    positionGroup: 'forward',
    programName: 'September Block',
    sessionsScheduled: 4,
    ...overrides,
  };
}

describe('calculateAdherence', () => {
  it('counts distinct program days trained this week', () => {
    const [row] = calculateAdherence({
      players: [player('sami')],
      loggedSessions: [
        { playerId: 'sami', date: '2026-08-31', programDayId: 'd1' },
        { playerId: 'sami', date: '2026-09-01', programDayId: 'd2' },
      ],
      ...week,
    });
    expect(row.sessionsLogged).toBe(2);
    expect(row.adherencePct).toBe(50);
    expect(row.status).toBe('on_track');
  });

  it('does not double-count a program day reopened later in the week', () => {
    const [row] = calculateAdherence({
      players: [player('sami')],
      loggedSessions: [
        { playerId: 'sami', date: '2026-08-31', programDayId: 'd1' },
        { playerId: 'sami', date: '2026-09-02', programDayId: 'd1' },
      ],
      ...week,
    });
    expect(row.sessionsLogged).toBe(1);
  });

  it('ignores sessions outside the week but still reports the last log', () => {
    const [row] = calculateAdherence({
      players: [player('omar')],
      loggedSessions: [{ playerId: 'omar', date: '2026-08-20', programDayId: 'd1' }],
      ...week,
    });
    expect(row.sessionsLogged).toBe(0);
    expect(row.status).toBe('not_started');
    expect(row.lastLogDate).toBe('2026-08-20');
    expect(row.daysSinceLastLog).toBe(14);
  });

  it('reports a player who has never logged', () => {
    const [row] = calculateAdherence({ players: [player('new')], loggedSessions: [], ...week });
    expect(row.lastLogDate).toBeNull();
    expect(row.daysSinceLastLog).toBeNull();
    expect(row.adherencePct).toBe(0);
  });

  it('caps adherence at 100 when a player trains more than scheduled', () => {
    const [row] = calculateAdherence({
      players: [player('keen', { sessionsScheduled: 2 })],
      loggedSessions: [
        { playerId: 'keen', date: '2026-08-31', programDayId: 'd1' },
        { playerId: 'keen', date: '2026-09-01', programDayId: 'd2' },
        { playerId: 'keen', date: '2026-09-02', programDayId: 'd3' },
      ],
      ...week,
    });
    expect(row.adherencePct).toBe(100);
    expect(row.status).toBe('complete');
  });

  it('does not divide by zero for a player with no live program', () => {
    const [row] = calculateAdherence({
      players: [player('noprog', { sessionsScheduled: 0, programName: null })],
      loggedSessions: [],
      ...week,
    });
    expect(row.adherencePct).toBe(0);
    expect(row.status).toBe('not_started');
  });
});

describe('sortByRisk', () => {
  it('floats the people falling behind to the top', () => {
    const rows = calculateAdherence({
      players: [player('done'), player('behind'), player('missing')],
      loggedSessions: [
        { playerId: 'done', date: '2026-08-31', programDayId: 'd1' },
        { playerId: 'done', date: '2026-09-01', programDayId: 'd2' },
        { playerId: 'done', date: '2026-09-02', programDayId: 'd3' },
        { playerId: 'done', date: '2026-09-03', programDayId: 'd4' },
        { playerId: 'behind', date: '2026-08-31', programDayId: 'd1' },
      ],
      ...week,
    });
    expect(sortByRisk(rows).map((row) => row.playerId)).toEqual(['missing', 'behind', 'done']);
  });
});

describe('estimateOneRepMax', () => {
  it('returns the lifted weight for a single', () => {
    expect(estimateOneRepMax(140, 1)).toBe(140);
  });

  it('extrapolates multi-rep sets', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.7, 1);
  });
});
