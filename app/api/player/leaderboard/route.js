import { getLeaderboard } from '@/lib/actions/getLeaderboard';
import { requirePlayer } from '@/lib/auth';
import { handle } from '@/lib/http';

/**
 * GET -> this week's squad leaderboard, or an empty board with `teamEnabled`/
 * `optedIn` flags if either of the two opt-in gates is off (see
 * lib/actions/getLeaderboard.js).
 */
export async function GET() {
  return handle(async () => {
    const session = await requirePlayer();
    return getLeaderboard(session);
  });
}
