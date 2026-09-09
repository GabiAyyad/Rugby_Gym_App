import 'server-only';
import { ActionError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db/errors';
import { updateExerciseRow } from '@/lib/db/queries/exercises';
import { normaliseExercise } from './createExercise';
import { toExercise } from './listExercises';

/**
 * Edits a library entry. Changing `progression_type` changes the weight
 * suggestions every program using this exercise will give from the next session
 * on — it does not touch anything already logged.
 */
/** `input` is `{ id, name, videoUrl, movementPattern, progressionType }`. */
export async function updateExercise(session, input) {
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
