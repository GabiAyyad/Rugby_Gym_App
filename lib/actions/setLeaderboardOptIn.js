import 'server-only';
import { ActionError } from '@/lib/http';
import { updatePlayerLeaderboardOptIn } from '@/lib/db/queries/reporting';
import { getLeaderboard } from './getLeaderboard';

/**
 * A player choosing whether their week shows up on the squad leaderboard. Only
 * ever writes the caller's own row — the player id comes from the session, not
 * the request — and returns the board as they may now see it, so the screen can
 * flip straight from the explanation to the table.
 */
export async function setLeaderboardOptIn(session, input) {
  const updated = await updatePlayerLeaderboardOptIn(session.teamId, session.playerId, input.optIn);
  if (updated === null) throw new ActionError('We could not find your player profile.', 404);

  return getLeaderboard(session);
}
