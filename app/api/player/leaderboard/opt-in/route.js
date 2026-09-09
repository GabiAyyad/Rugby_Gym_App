// The player-side opt-in gate for the squad leaderboard (the admin-side team
// switch lives at /api/admin/team/leaderboard — both must be on).
import { setLeaderboardOptIn } from '@/lib/actions/setLeaderboardOptIn';
import { requirePlayer } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';
import { requireBoolean } from '@/lib/validate';

/** PATCH { optIn: boolean } -> the resulting LeaderboardResult. Only ever writes the caller's own row. */
export async function PATCH(request) {
  return handle(async () => {
    const session = await requirePlayer();
    const body = await parseBody(request);
    return setLeaderboardOptIn(session, { optIn: requireBoolean(body.optIn, 'optIn') });
  });
}
