import { describe, expect, it } from 'vitest';
import { suggestNextWeight } from './progression';

function sets(...entries) {
  return entries.map(([repsDone, weightUsed], index) => ({
    setNumber: index + 1,
    repsDone,
    weightUsed,
    distanceOrTime: null,
  }));
}

function input(overrides) {
  return {
    progressionType: 'heavy_compound',
    targetSets: 3,
    targetReps: '3-6',
    last: null,
    ...overrides,
  };
}

describe('heavy_compound', () => {
  it('adds 2.5kg once every set reaches the top of the range', () => {
    const result = suggestNextWeight(
      input({ last: { date: '2026-08-24', sets: sets([6, 100], [6, 100], [6, 100]) } }),
    );
    expect(result.weight).toBe(102.5);
    expect(result.reps).toBe(3);
    expect(result.isProgression).toBe(true);
  });

  it('holds the weight when a single set fell short', () => {
    const result = suggestNextWeight(
      input({ last: { date: '2026-08-24', sets: sets([6, 100], [6, 100], [4, 100]) } }),
    );
    expect(result.weight).toBe(100);
    expect(result.isProgression).toBe(false);
  });

  it('holds the weight when a set was skipped entirely', () => {
    const result = suggestNextWeight(input({ last: { date: '2026-08-24', sets: sets([6, 100], [6, 100]) } }));
    expect(result.weight).toBe(100);
    expect(result.isProgression).toBe(false);
  });

  it('asks for a baseline the first time', () => {
    const result = suggestNextWeight(input({ last: null }));
    expect(result.weight).toBeNull();
    expect(result.reps).toBe(3);
  });
});

describe('light_compound_isolation', () => {
  const isolation = { progressionType: 'light_compound_isolation', targetSets: 3, targetReps: '8-12' };

  it('adds 1kg and resets to the bottom of the range at the top', () => {
    const result = suggestNextWeight(
      input({ ...isolation, last: { date: '2026-08-24', sets: sets([12, 10], [12, 10], [12, 10]) } }),
    );
    expect(result.weight).toBe(11);
    expect(result.reps).toBe(8);
    expect(result.isProgression).toBe(true);
  });

  it('chases one more rep before adding load', () => {
    const result = suggestNextWeight(
      input({ ...isolation, last: { date: '2026-08-24', sets: sets([10, 10], [9, 10], [9, 10]) } }),
    );
    expect(result.weight).toBe(10);
    expect(result.reps).toBe(10);
  });

  it('never suggests more reps than the range allows', () => {
    const result = suggestNextWeight(
      input({ ...isolation, last: { date: '2026-08-24', sets: sets([12, 10], [12, 10], [11, 10]) } }),
    );
    expect(result.reps).toBe(12);
    expect(result.weight).toBe(10);
  });
});

describe('bodyweight_plyo', () => {
  it('gives the player a number to beat rather than a load', () => {
    const result = suggestNextWeight(
      input({
        progressionType: 'bodyweight_plyo',
        targetReps: '5',
        targetSets: 4,
        last: { date: '2026-08-24', sets: sets([5, null], [5, null], [4, null]) },
      }),
    );
    expect(result.weight).toBeNull();
    expect(result.reps).toBe(4);
    expect(result.reason).toContain('4 reps');
  });
});

describe('carry_loaded', () => {
  const carry = { progressionType: 'carry_loaded', targetSets: 2, targetReps: '40m' };

  it('adds load once the target distance is completed', () => {
    const result = suggestNextWeight(
      input({
        ...carry,
        last: {
          date: '2026-08-24',
          sets: [
            { setNumber: 1, repsDone: null, weightUsed: 60, distanceOrTime: '40m' },
            { setNumber: 2, repsDone: null, weightUsed: 60, distanceOrTime: '40m' },
          ],
        },
      }),
    );
    expect(result.weight).toBe(62.5);
    expect(result.distanceOrTime).toBe('40m');
    expect(result.isProgression).toBe(true);
  });

  it('stretches the distance when there is no load to add', () => {
    const result = suggestNextWeight(
      input({
        ...carry,
        last: {
          date: '2026-08-24',
          sets: [
            { setNumber: 1, repsDone: null, weightUsed: null, distanceOrTime: '40m' },
            { setNumber: 2, repsDone: null, weightUsed: null, distanceOrTime: '40m' },
          ],
        },
      }),
    );
    expect(result.weight).toBeNull();
    expect(result.distanceOrTime).toBe('44m');
  });

  it('holds when the target distance was missed', () => {
    const result = suggestNextWeight(
      input({
        ...carry,
        last: {
          date: '2026-08-24',
          sets: [
            { setNumber: 1, repsDone: null, weightUsed: 60, distanceOrTime: '30m' },
            { setNumber: 2, repsDone: null, weightUsed: 60, distanceOrTime: '30m' },
          ],
        },
      }),
    );
    expect(result.weight).toBe(60);
    expect(result.isProgression).toBe(false);
  });
});
