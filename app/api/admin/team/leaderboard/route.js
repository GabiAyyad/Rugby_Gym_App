// The admin-side on/off switch for the squad leaderboard feature (a second,
// per-player opt-in gate lives on the player side — see /api/player/leaderboard/opt-in).
import { setTeamLeaderboardEnabled } from '@/lib/actions/setTeamLeaderboardEnabled';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';
import { requireBoolean } from '@/lib/validate';

/** PATCH { enabled: boolean } -> { enabled }. Turning it on publishes nobody until players opt in too. */
export async function PATCH(request) {
  return handle(async () => {
    const session = await requireAdmin();
    const body = await parseBody(request);
    return setTeamLeaderboardEnabled(session, { enabled: requireBoolean(body.enabled, 'enabled') });
  });
}
