import { completeSession } from '@/lib/actions/completeSession';
import { requirePlayer } from '@/lib/auth';
import { handle } from '@/lib/http';

/**
 * POST (no body) -> { sessionId, completedAt }. Marks a session finished.
 * The session id comes from the path; ownership is checked against the
 * cookie. Idempotent — calling it again just returns the original timestamp,
 * so a replayed "finish" from the offline queue is harmless.
 */
export async function POST(_request, context) {
  return handle(async () => {
    const session = await requirePlayer();
    const { sessionId } = await context.params;
    return completeSession(session, { sessionId });
  });
}
