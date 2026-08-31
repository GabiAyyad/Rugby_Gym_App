import 'server-only';
import { ActionError } from '@/lib/http';
import { findPlayerSession, markSessionCompleted } from '@/lib/supabase/queries/training';
import type { SessionUser } from '@/types/common';
import type { CompleteSessionInput } from '@/types/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CompleteSessionResult {
  sessionId: string;
  completedAt: string;
}

/**
 * Mark a session finished. Idempotent: a second call keeps the original
 * timestamp, so a replayed "finish" from the offline queue is harmless.
 */
export async function completeSession(
  session: SessionUser,
  input: CompleteSessionInput,
): Promise<CompleteSessionResult> {
  if (!UUID.test(input.sessionId)) throw new ActionError('That session does not exist.', 404);

  const existing = await findPlayerSession(session.playerId, input.sessionId);
  if (!existing) throw new ActionError('That session does not exist.', 404);
  if (existing.completed_at) {
    return { sessionId: existing.id, completedAt: existing.completed_at };
  }

  const updated = await markSessionCompleted(
    session.playerId,
    input.sessionId,
    new Date().toISOString(),
  );
  if (!updated?.completed_at) throw new ActionError('Could not finish that session.', 500);

  return { sessionId: updated.id, completedAt: updated.completed_at };
}
