// Fetches the full logging-screen payload for one session (exercises, sets
// already logged, last-session history, progression suggestions).
import { getSessionDetail } from '@/lib/actions/getSessionDetail';
import { requirePlayer } from '@/lib/auth';
import { handle } from '@/lib/http';

/** GET -> a SessionDetail for :sessionId. 404s unless it belongs to the caller. */
export async function GET(_request, context) {
  return handle(async () => {
    const session = await requirePlayer();
    const { sessionId } = await context.params;
    return getSessionDetail(session, sessionId);
  });
}
