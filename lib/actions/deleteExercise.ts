import 'server-only';
import { ActionError } from '@/lib/http';
import { isForeignKeyViolation } from '@/lib/supabase/queries';
import {
  deleteExerciseRow,
  findExerciseRow,
  findProgramIdsUsingExercise,
} from '@/lib/supabase/queries/exercises';
import type { SessionUser } from '@/types/common';
import type { DeleteExerciseInput } from '@/types/exercise';

function inUseMessage(name: string, programCount: number): string {
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
export async function deleteExercise(
  session: SessionUser,
  input: DeleteExerciseInput,
): Promise<{ id: string }> {
  void session;

  const existing = await findExerciseRow(input.id);
  if (!existing) throw new ActionError('That exercise no longer exists.', 404);

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
      throw new ActionError(
        `"${existing.name}" was just added to a program. Remove it there first.`,
        409,
      );
    }
    throw error;
  }
}
