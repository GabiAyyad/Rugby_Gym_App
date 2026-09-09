import 'server-only';
import { ActionError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db/errors';
import { insertExerciseRow } from '@/lib/db/queries/exercises';
import { toExercise } from './listExercises';

/**
 * Shared by createExercise and updateExercise: trims the free-text fields and
 * rejects anything that is not a real http(s) link, so the player-side video
 * embed never has to defend itself against "youtube" typed into the box.
 */
export function normaliseExercise(input) {
  const name = input.name.trim();
  const movementPattern = (input.movementPattern ?? '').trim();
  const rawUrl = (input.videoUrl ?? '').trim();
  const fieldErrors = {};

  if (name.length < 2) fieldErrors.name = 'Enter an exercise name.';

  let videoUrl = null;
  if (rawUrl) {
    let parsed = null;
    try {
      parsed = new URL(rawUrl);
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
      fieldErrors.videoUrl = 'Enter a full link, e.g. https://youtu.be/...';
    } else {
      videoUrl = parsed.toString();
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ActionError('Check the highlighted fields.', 422, fieldErrors);
  }

  return {
    name,
    videoUrl,
    movementPattern: movementPattern || null,
    progressionType: input.progressionType,
  };
}

/** Adds to the global library. No team scoping: see the note in listExercises. */
/** `input` is `{ name, videoUrl, movementPattern, progressionType }`. Adds one entry to the global library. */
export async function createExercise(session, input) {
  void session;
  const write = normaliseExercise(input);

  try {
    return toExercise(await insertExerciseRow(write));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ActionError(`"${write.name}" is already in the library.`, 409, {
        name: 'An exercise with that name already exists.',
      });
    }
    throw error;
  }
}
