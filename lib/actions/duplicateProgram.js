import 'server-only';
import { addDays, daysBetween, isISODate } from '@/lib/domain/week';
import { ActionError } from '@/lib/http';
import { insertProgram } from '@/lib/db/queries/programs';
import { getProgram } from '@/lib/actions/getProgram';
import { updateProgram } from '@/lib/actions/updateProgram';

/**
 * Copy a whole block — days, labels, exercises, sets, reps, rest and notes —
 * onto new dates. This is what makes month-to-month programming bearable: next
 * month starts as last month and gets edited, rather than being retyped.
 *
 * Defaults line the copy up to start the day after the source ends and keep the
 * same length, so duplicating a 4-week block gives you the next 4 weeks.
 * `is_active_override` is deliberately not copied: a forced-live block should
 * not silently drag a second one live with it.
 */
export async function duplicateProgram(session, input) {
  // Scoped to the caller's team by getProgram, so this cannot clone another squad's block.
  const source = await getProgram(session, input.id);

  const startDate = input.startDate?.trim() ? input.startDate.trim() : addDays(source.endDate, 1);
  if (!isISODate(startDate)) {
    throw new ActionError('Check the highlighted fields.', 422, {
      startDate: 'Pick a start date for the copy.',
    });
  }

  const length = daysBetween(source.startDate, source.endDate);
  const name = input.name?.trim() ? input.name.trim() : `${source.name} (copy)`;

  const copy = {
    positionGroup: source.positionGroup,
    name,
    startDate,
    endDate: addDays(startDate, length),
    isActiveOverride: null,
    days: source.days.map((day) => ({
      dayNumber: day.dayNumber,
      label: day.label,
      exercises: day.exercises.map((exercise, index) => ({
        exerciseId: exercise.exerciseId,
        order: index + 1,
        targetSets: exercise.targetSets,
        targetReps: exercise.targetReps,
        restSeconds: exercise.restSeconds,
        notes: exercise.notes,
      })),
    })),
  };

  // A block with no days at all cannot be saved, so an empty source copies as a
  // single blank Day 1 for the coach to fill in.
  if (copy.days.length === 0) copy.days = [{ dayNumber: 1, label: null, exercises: [] }];

  const row = await insertProgram(session.teamId, {
    positionGroup: copy.positionGroup,
    name: copy.name,
    startDate: copy.startDate,
    endDate: copy.endDate,
    isActiveOverride: copy.isActiveOverride,
  });

  return updateProgram(session, { ...copy, id: row.id });
}
