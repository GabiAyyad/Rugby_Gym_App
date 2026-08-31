import type { LoggedSet, ProgressionInput, Suggestion } from '@/types/session';
import { formatMeasure, parseMeasure, parseRepRange } from './repRange';

/**
 * Per-set-type progression rules. Pure: data in, suggestion out, no DB.
 *
 * "Hit target" means every working set reached the TOP of the prescribed rep
 * range (double progression) — so "3-6" only earns weight once all sets hit 6.
 */

const HEAVY_INCREMENT_KG = 2.5;
const ISOLATION_INCREMENT_KG = 1;
const CARRY_INCREMENT_KG = 2.5;
/** No load on the bar to add to, so carries progress ~10% of distance/time. */
const CARRY_DISTANCE_STEP = 0.1;

function completedSets(sets: LoggedSet[]): LoggedSet[] {
  return sets.filter((s) => s.repsDone !== null || s.weightUsed !== null || s.distanceOrTime !== null);
}

function topWeight(sets: LoggedSet[]): number | null {
  const weights = sets.map((s) => s.weightUsed).filter((w): w is number => w !== null);
  return weights.length ? Math.max(...weights) : null;
}

function lowestReps(sets: LoggedSet[]): number | null {
  const reps = sets.map((s) => s.repsDone).filter((r): r is number => r !== null);
  return reps.length ? Math.min(...reps) : null;
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function fresh(reps: number | null, note: string): Suggestion {
  return {
    weight: null,
    reps,
    distanceOrTime: null,
    reason: note,
    isProgression: false,
  };
}

export function suggestNextWeight(input: ProgressionInput): Suggestion {
  const { progressionType, targetSets, targetReps, last } = input;
  const range = parseRepRange(targetReps);

  if (!last || completedSets(last.sets).length === 0) {
    if (progressionType === 'carry_loaded') {
      const target = parseMeasure(targetReps);
      return {
        weight: null,
        reps: null,
        distanceOrTime: target ? formatMeasure(target) : targetReps,
        reason: 'First time on this one — log what you manage and it becomes the baseline.',
        isProgression: false,
      };
    }
    return fresh(range?.min ?? null, 'First time on this one — log what you manage and it becomes the baseline.');
  }

  const sets = completedSets(last.sets);
  const lastWeight = topWeight(sets);
  const lastLowestReps = lowestReps(sets);
  const hitAllSets = sets.length >= targetSets;
  const hitTopOfRange = range !== null && lastLowestReps !== null && lastLowestReps >= range.max;
  const targetMet = hitAllSets && hitTopOfRange;

  switch (progressionType) {
    case 'heavy_compound': {
      if (lastWeight === null) {
        return fresh(range?.min ?? lastLowestReps, 'Log the weight this time so progression can kick in.');
      }
      if (targetMet) {
        return {
          weight: roundToHalf(lastWeight + HEAVY_INCREMENT_KG),
          reps: range?.min ?? null,
          distanceOrTime: null,
          reason: `All ${targetSets} sets hit ${range?.max} last time — go up ${HEAVY_INCREMENT_KG}kg.`,
          isProgression: true,
        };
      }
      return {
        weight: lastWeight,
        reps: range?.max ?? null,
        distanceOrTime: null,
        reason: `Stay at ${lastWeight}kg until all ${targetSets} sets reach ${range?.max ?? targetReps}.`,
        isProgression: false,
      };
    }

    case 'light_compound_isolation': {
      if (lastWeight === null) {
        return fresh(range?.min ?? lastLowestReps, 'Log the weight this time so progression can kick in.');
      }
      if (targetMet) {
        return {
          weight: roundToHalf(lastWeight + ISOLATION_INCREMENT_KG),
          reps: range?.min ?? null,
          distanceOrTime: null,
          reason: `Topped the range at ${range?.max} — add ${ISOLATION_INCREMENT_KG}kg and drop back to ${range?.min}.`,
          isProgression: true,
        };
      }
      const nextReps =
        range && lastLowestReps !== null ? Math.min(lastLowestReps + 1, range.max) : range?.min ?? null;
      return {
        weight: lastWeight,
        reps: nextReps,
        distanceOrTime: null,
        reason:
          nextReps !== null
            ? `Same ${lastWeight}kg — chase ${nextReps} reps before adding load.`
            : `Same ${lastWeight}kg — add a rep before adding load.`,
        isProgression: nextReps !== null && lastLowestReps !== null && nextReps > lastLowestReps,
      };
    }

    case 'bodyweight_plyo': {
      // No load to add: quality and volume are coach-set per block, so the job
      // here is simply to show the player what they have to beat.
      const best = lastLowestReps;
      return {
        weight: null,
        reps: best ?? range?.min ?? null,
        distanceOrTime: null,
        reason:
          best !== null
            ? `Last time: ${best} reps across ${sets.length} ${sets.length === 1 ? 'set' : 'sets'}. Match or beat it.`
            : 'Match or beat last session.',
        isProgression: false,
      };
    }

    case 'carry_loaded': {
      const target = parseMeasure(targetReps);
      const lastMeasureRaw = sets.map((s) => s.distanceOrTime).find((d): d is string => !!d);
      const lastMeasure = lastMeasureRaw ? parseMeasure(lastMeasureRaw) : null;
      const hitTarget =
        target !== null && lastMeasure !== null && lastMeasure.unit === target.unit
          ? lastMeasure.value >= target.value && hitAllSets
          : false;

      if (!hitTarget) {
        return {
          weight: lastWeight,
          reps: null,
          distanceOrTime: lastMeasureRaw ?? (target ? formatMeasure(target) : targetReps),
          reason: target
            ? `Hold here until you complete ${targetSets} × ${formatMeasure(target)}.`
            : 'Hold here until you complete the target.',
          isProgression: false,
        };
      }
      if (lastWeight !== null) {
        return {
          weight: roundToHalf(lastWeight + CARRY_INCREMENT_KG),
          reps: null,
          distanceOrTime: target ? formatMeasure(target) : targetReps,
          reason: `Completed ${formatMeasure(lastMeasure!)} last time — add ${CARRY_INCREMENT_KG}kg.`,
          isProgression: true,
        };
      }
      const stretched = formatMeasure({
        value: lastMeasure!.value * (1 + CARRY_DISTANCE_STEP),
        unit: lastMeasure!.unit,
      });
      return {
        weight: null,
        reps: null,
        distanceOrTime: stretched,
        reason: `Completed ${formatMeasure(lastMeasure!)} last time — push to ${stretched}.`,
        isProgression: true,
      };
    }
  }
}
