import 'server-only';
import type { SessionUser } from '@/types/common';
import { ActionError } from '@/lib/http';
import { updateTeamLeaderboardEnabled } from '@/lib/supabase/queries/reporting';

export interface SetTeamLeaderboardEnabledInput {
  enabled: boolean;
}

export interface SetTeamLeaderboardEnabledResult {
  enabled: boolean;
}

/**
 * The admin switch for the squad leaderboard. Turning it on publishes nothing on
 * its own: each player still has to opt in individually.
 *
 * Scoped to the caller's own team — an admin cannot reach the other squad's row.
 */
export async function setTeamLeaderboardEnabled(
  session: SessionUser,
  input: SetTeamLeaderboardEnabledInput,
): Promise<SetTeamLeaderboardEnabledResult> {
  if (!session.isAdmin) throw new ActionError('Admin access required.', 403);

  const enabled = await updateTeamLeaderboardEnabled(session.teamId, input.enabled);
  if (enabled === null) throw new ActionError('We could not find your team.', 404);

  return { enabled };
}
