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

/** Keeps only sets the player actually logged something for (weight, reps, or a measure). */
function completedSets(sets) {
  return sets.filter((s) => s.repsDone !== null || s.weightUsed !== null || s.distanceOrTime !== null);
}

/** Heaviest weight used across a list of sets, or null if none carried a weight. */
function topWeight(sets) {
  const weights = sets.map((s) => s.weightUsed).filter((w) => w !== null);
  return weights.length ? Math.max(...weights) : null;
}

/** The worst (lowest) rep count across a list of sets — the "did every set hit target" signal. */
function lowestReps(sets) {
  const reps = sets.map((s) => s.repsDone).filter((r) => r !== null);
  return reps.length ? Math.min(...reps) : null;
}

/** Rounds a weight to the nearest 0.5kg, so suggestions match real plate increments. */
function roundToHalf(value) {
  return Math.round(value * 2) / 2;
}

/** Builds the "no history yet" suggestion shape shared by the non-carry progression types. */
function fresh(reps, note) {
  return {
    weight: null,
    reps,
    distanceOrTime: null,
    reason: note,
    isProgression: false,
  };
}

/**
 * The core progression engine: given how an exercise progresses
 * (`progressionType`), what was prescribed (`targetSets`/`targetReps`), and
 * what the player did last time (`last`), returns a `Suggestion` — the
 * weight/reps/measure to pre-fill on the logging screen, plus a one-line
 * `reason` explaining the number, and whether it's a step up (`isProgression`).
 *
 * `input` is `{ progressionType, targetSets, targetReps, last }` where `last`
 * is `{ date, sets }` or `null` if the player has never logged this exercise.
 */
export function suggestNextWeight(input) {
  const { progressionType, targetSets, targetReps, last } = input;
  const range = parseRepRange(targetReps);

  // No prior session (or a prior session with nothing actually logged): there
  // is nothing to progress from, so just hand back a baseline to fill in.
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
  // "Earned progression" requires BOTH: every prescribed set was actually done,
  // AND the weakest of those sets still reached the top of the rep range.
  const targetMet = hitAllSets && hitTopOfRange;

  switch (progressionType) {
    // Squat/deadlift/bench-style lifts: hit the top of the range on every set
    // -> add a fixed jump. Otherwise hold the weight and chase the range again.
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

    // Accessory/isolation lifts: "double progression" — climb the rep range one
    // rep at a time, and only once you top out the range do you add weight
    // (then drop back to the bottom of the range at the new weight).
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
      // Not yet at the top of the range: suggest one more rep than last time
      // (capped at the range's max) rather than more weight.
      const nextReps =
        range && lastLowestReps !== null ? Math.min(lastLowestReps + 1, range.max) : (range?.min ?? null);
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

    // Bodyweight/plyometric work (box jumps, sprints, core): there is no load
    // to add, so the "progression" is just showing the player their own best
    // to try to match or beat. Volume/quality is coach-managed per block.
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

    // Loaded carries/sled work (farmer's carry, sled push): progresses on
    // distance/time rather than reps. Hitting the target distance/time on every
    // set earns either more weight (if there's a load to add) or a longer carry.
    case 'carry_loaded': {
      const target = parseMeasure(targetReps);
      const lastMeasureRaw = sets.map((s) => s.distanceOrTime).find((d) => !!d);
      const lastMeasure = lastMeasureRaw ? parseMeasure(lastMeasureRaw) : null;
      // Only compare like-for-like units (e.g. metres vs metres) — a target in
      // "m" against a logged measure in "s" can't be judged, so it's untested.
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
          reason: `Completed ${formatMeasure(lastMeasure)} last time — add ${CARRY_INCREMENT_KG}kg.`,
          isProgression: true,
        };
      }
      // Nothing to load (e.g. a bodyweight sled push with no plates) — stretch
      // the distance/time instead of adding weight.
      const stretched = formatMeasure({
        value: lastMeasure.value * (1 + CARRY_DISTANCE_STEP),
        unit: lastMeasure.unit,
      });
      return {
        weight: null,
        reps: null,
        distanceOrTime: stretched,
        reason: `Completed ${formatMeasure(lastMeasure)} last time — push to ${stretched}.`,
        isProgression: true,
      };
    }

    default:
      throw new Error(`Unknown progression type: ${progressionType}`);
  }
}
