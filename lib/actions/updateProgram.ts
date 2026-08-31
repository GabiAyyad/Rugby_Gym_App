import 'server-only';
import { ActionError } from '@/lib/http';
import type { SessionUser } from '@/types/common';
import type {
  CreateProgramInput,
  Program,
  ProgramDayInput,
  UpdateProgramInput,
} from '@/types/program';
import { isISODate } from '@/lib/domain/week';
import { isForeignKeyViolation } from '@/lib/supabase/queries';
import {
  deleteProgramDays,
  deleteProgramExercisesForDay,
  insertProgramDay,
  insertProgramExercises,
  listDaysForPrograms,
  updateProgramDayLabel,
  updateProgramForTeam,
} from '@/lib/supabase/queries/programs';
import { getProgram } from '@/lib/actions/getProgram';

/**
 * Invariants the database cannot express as a friendly message (day numbering,
 * the two dates in order). The route handlers parse the same shape with zod;
 * this is the defence in depth that holds however the action is called.
 *
 * It lives here rather than in createProgram because a block is validated
 * identically whichever way it is written, and createProgram routes its day
 * layout through this file.
 */
export function assertProgramInput(input: CreateProgramInput): void {
  const fieldErrors: Record<string, string> = {};

  if (!input.name.trim()) fieldErrors.name = 'Give the block a name.';
  if (!isISODate(input.startDate)) fieldErrors.startDate = 'Pick a start date.';
  if (!isISODate(input.endDate)) fieldErrors.endDate = 'Pick an end date.';
  if (isISODate(input.startDate) && isISODate(input.endDate) && input.endDate < input.startDate) {
    fieldErrors.endDate = 'The end date cannot be before the start date.';
  }

  if (input.days.length < 1 || input.days.length > 4) {
    fieldErrors.days = 'A block has between 1 and 4 training days.';
  }

  const seen = new Set<number>();
  for (const day of input.days) {
    if (!Number.isInteger(day.dayNumber) || day.dayNumber < 1 || day.dayNumber > 4) {
      fieldErrors.days = 'Training days are numbered 1 to 4.';
    }
    if (seen.has(day.dayNumber)) fieldErrors.days = 'Each training day can only appear once.';
    seen.add(day.dayNumber);

    for (const exercise of day.exercises) {
      if (!Number.isInteger(exercise.targetSets) || exercise.targetSets < 1) {
        fieldErrors.days = `Day ${day.dayNumber}: every exercise needs at least one set.`;
      }
      if (!Number.isInteger(exercise.restSeconds) || exercise.restSeconds < 0) {
        fieldErrors.days = `Day ${day.dayNumber}: rest cannot be negative.`;
      }
      if (!exercise.targetReps.trim()) {
        fieldErrors.days = `Day ${day.dayNumber}: every exercise needs a target ("8-10", "5", "40m").`;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ActionError('Check the highlighted fields.', 422, fieldErrors);
  }
}

/**
 * Save a block: its details plus a full replacement of its days and exercises.
 *
 * supabase-js has no transactions, so the replacement runs day by day — for
 * each day, delete its exercises and reinsert the submitted list. If a day
 * fails, the days before it are already saved and the days after it are
 * untouched, so the coach is told exactly which day to reopen rather than being
 * left guessing which half landed.
 *
 * Order is renumbered 1..n from the submitted array rather than trusting the
 * client's values; there is no unique constraint on "order" and none is assumed.
 */
export async function updateProgram(
  session: SessionUser,
  input: UpdateProgramInput,
): Promise<Program> {
  assertProgramInput(input);

  // team_id is in the filter, so an id from another squad updates nothing.
  const updated = await updateProgramForTeam(session.teamId, input.id, {
    positionGroup: input.positionGroup,
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    isActiveOverride: input.isActiveOverride,
  });
  if (!updated) throw new ActionError('That training block was not found.', 404);

  const existingDays = await listDaysForPrograms([input.id]);
  const existingByNumber = new Map(existingDays.map((day) => [day.day_number, day]));
  const submitted = [...input.days].sort((a, b) => a.dayNumber - b.dayNumber);

  const keptDayIds = new Set<string>();
  for (const day of submitted) {
    keptDayIds.add(await writeDay(input.id, day, existingByNumber.get(day.dayNumber) ?? null));
  }

  // Days the coach dropped. This cascades to any sessions logged against them,
  // which is why the editor warns before removing a day.
  const removed = existingDays.filter((day) => !keptDayIds.has(day.id));
  if (removed.length > 0) await deleteProgramDays(removed.map((day) => day.id));

  return getProgram(session, input.id);
}

async function writeDay(
  programId: string,
  day: ProgramDayInput,
  existing: { id: string; label: string | null } | null,
): Promise<string> {
  const label = day.label?.trim() ? day.label.trim() : null;

  try {
    let dayId: string;
    if (existing) {
      dayId = existing.id;
      if (existing.label !== label) await updateProgramDayLabel(dayId, label);
    } else {
      dayId = (await insertProgramDay(programId, day.dayNumber, label)).id;
    }

    await deleteProgramExercisesForDay(dayId);
    await insertProgramExercises(
      day.exercises.map((exercise, index) => ({
        program_day_id: dayId,
        exercise_id: exercise.exerciseId,
        order: index + 1,
        target_sets: exercise.targetSets,
        target_reps: exercise.targetReps.trim(),
        rest_seconds: exercise.restSeconds,
        notes: exercise.notes?.trim() ? exercise.notes.trim() : null,
      })),
    );

    return dayId;
  } catch (cause) {
    console.error('[updateProgram] day', day.dayNumber, cause);
    const reason = isForeignKeyViolation(cause)
      ? `One of the exercises on Day ${day.dayNumber} is no longer in the exercise library.`
      : `Day ${day.dayNumber} could not be saved.`;
    throw new ActionError(
      `${reason} The block details and any earlier days were saved; Day ${day.dayNumber} may have been left empty and later days are unchanged. Reopen the block, check Day ${day.dayNumber} onwards, and save again.`,
      409,
    );
  }
}
