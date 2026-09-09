import 'server-only';
import { ActionError } from '@/lib/http';
import { isForeignKeyViolation } from '@/lib/db/errors';
import { deleteExerciseRow, findExerciseRow, findProgramIdsUsingExercise } from '@/lib/db/queries/exercises';

/** Builds the "used in N programs" message shown when a delete is blocked. */
function inUseMessage(name, programCount) {
  const plural = programCount === 1 ? 'program' : 'programs';
  return `"${name}" is used in ${programCount} ${plural}. Remove it from ${programCount === 1 ? 'that program' : 'those programs'} before deleting it.`;
}

/**
 * Deleting a library entry that a program still references would orphan the
 * logs hanging off it, so `program_exercises.exercise_id` is `on delete
 * restrict`. We check usage first to give a message that says how many programs
 * are in the way, and still catch the FK violation in case a program is built
 * between the check and the delete.
 */
/** `input` is `{ id }`. Refuses to delete an exercise still referenced by any program. */
export async function deleteExercise(session, input) {
  void session;

  const existing = await findExerciseRow(input.id);
  if (!existing) throw new ActionError('That exercise no longer exists.', 404);

  // Checked proactively (not just left to the FK constraint) so the error
  // message can say exactly how many programs are in the way.
  const programIds = await findProgramIdsUsingExercise(input.id);
  if (programIds.length > 0) {
    throw new ActionError(inUseMessage(existing.name, programIds.length), 409);
  }

  try {
    const removed = await deleteExerciseRow(input.id);
    if (!removed) throw new ActionError('That exercise no longer exists.', 404);
    return { id: removed.id };
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new ActionError(`"${existing.name}" was just added to a program. Remove it there first.`, 409);
    }
    throw error;
  }
}
