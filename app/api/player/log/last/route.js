// Standalone lookup of "what did I do last time" + the progression
// suggestion for one exercise, outside the context of a full session (used
// for pre-filling before a session has fully loaded, or refreshing one row).
import { getLastLogForExercise } from '@/lib/actions/getLastLogForExercise';
import { requirePlayer } from '@/lib/auth';
import { handle, parseQuery } from '@/lib/http';
import { requireUUID } from '@/lib/validate';

/** GET ?programExerciseId=<uuid> -> { exercise, targetSets, targetReps, last, suggestion }. */
export async function GET(request) {
  return handle(async () => {
    const session = await requirePlayer();
    const query = parseQuery(request);
    const programExerciseId = requireUUID(query.programExerciseId, 'programExerciseId');
    return getLastLogForExercise(session, programExerciseId);
  });
}
