// The player's own training history: past sessions + a per-exercise
// weight-over-time series. Always scoped to the signed-in player's own id.
import { getPlayerHistory } from '@/lib/actions/getPlayerHistory';
import { requirePlayer } from '@/lib/auth';
import { handle, parseQuery } from '@/lib/http';
import { ActionError } from '@/lib/http';
import { isUUID } from '@/lib/validate';

/**
 * GET ?exerciseId=<uuid>&limit=<1-100> -> PlayerHistoryResult
 * (`sessions`, `loggedExercises` for the chart picker, and `series` for
 * whichever exercise was requested, or the most recently logged one).
 */
export async function GET(request) {
  return handle(async () => {
    const session = await requirePlayer();
    const query = parseQuery(request);

    let exerciseId = null;
    if (query.exerciseId) {
      if (!isUUID(query.exerciseId)) throw new ActionError('Unknown exercise.', 400);
      exerciseId = query.exerciseId;
    }

    let limit;
    if (query.limit !== undefined) {
      const parsed = Number.parseInt(query.limit, 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        throw new ActionError('Invalid limit.', 400);
      }
      limit = parsed;
    }

    return getPlayerHistory(session, { exerciseId, limit });
  });
}
