import 'server-only';
import { ActionError } from '@/lib/http';
import { updateTeamLeaderboardEnabled } from '@/lib/db/queries/reporting';

/**
 * The admin switch for the squad leaderboard. Turning it on publishes nothing on
 * its own: each player still has to opt in individually.
 *
 * Scoped to the caller's own team — an admin cannot reach the other squad's row.
 */
export async function setTeamLeaderboardEnabled(session, input) {
  if (!session.isAdmin) throw new ActionError('Admin access required.', 403);

  const enabled = await updateTeamLeaderboardEnabled(session.teamId, input.enabled);
  if (enabled === null) throw new ActionError('We could not find your team.', 404);

  return { enabled };
}
