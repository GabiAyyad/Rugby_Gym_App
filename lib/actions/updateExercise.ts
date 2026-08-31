import 'server-only';
import { ActionError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/supabase/queries';
import { updateExerciseRow } from '@/lib/supabase/queries/exercises';
import type { SessionUser } from '@/types/common';
import type { Exercise, UpdateExerciseInput } from '@/types/exercise';
import { normaliseExercise } from './createExercise';
import { toExercise } from './listExercises';

/**
 * Edits a library entry. Changing `progression_type` changes the weight
 * suggestions every program using this exercise will give from the next session
 * on — it does not touch anything already logged.
 */
export async function updateExercise(
  session: SessionUser,
  input: UpdateExerciseInput,
): Promise<Exercise> {
  void session;
  const write = normaliseExercise(input);

  try {
    const row = await updateExerciseRow(input.id, write);
    if (!row) throw new ActionError('That exercise no longer exists.', 404);
    return toExercise(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ActionError(`"${write.name}" is already in the library.`, 409, {
        name: 'An exercise with that name already exists.',
      });
    }
    throw error;
  }
}
