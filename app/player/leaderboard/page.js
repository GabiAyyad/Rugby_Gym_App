// Player -> Squad: the optional, opt-in weekly leaderboard for the player's
// own team. getLeaderboard already enforces both gates (team switch + the
// player's own opt-in) — this page just renders whatever it returns.
import { LeaderboardTable } from '@/components/player/LeaderboardTable';
import { PageHeader } from '@/components/shared';
import { getLeaderboard } from '@/lib/actions/getLeaderboard';
import { requirePlayerPage } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PlayerLeaderboardPage() {
  const session = await requirePlayerPage();
  const leaderboard = await getLeaderboard(session);

  return (
    <>
      <PageHeader title="Squad" subtitle={`This week across ${session.teamName}`} />
      <LeaderboardTable initial={leaderboard} />
    </>
  );
}
