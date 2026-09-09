// Player -> History: the player's own past sessions, plus a weight-over-time
// chart for whichever exercise they pick. Everything here is scoped to
// `session.playerId` by getPlayerHistory — a player never sees anyone else's data.
import { HistoryList } from '@/components/player/HistoryList';
import { ProgressChart } from '@/components/player/ProgressChart';
import { PageHeader } from '@/components/shared';
import { getPlayerHistory } from '@/lib/actions/getPlayerHistory';
import { requirePlayerPage } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** The player's own sessions and progress. Nobody else's data reaches this page. */
export default async function PlayerHistoryPage() {
  const session = await requirePlayerPage();
  const history = await getPlayerHistory(session, { limit: 30 });

  return (
    <>
      <PageHeader title="History" subtitle="Your sessions, and how the weight is moving" />

      {/* Nothing logged yet: one empty state reads better than two. */}
      {history.loggedExercises.length > 0 && (
        <>
          <ProgressChart exercises={history.loggedExercises} initialSeries={history.series} />
          <h2 className="mt-5 mb-4 text-sm font-semibold tracking-wide text-ink-400 uppercase" style={{ marginTop: '2rem' }}>
            Recent sessions
          </h2>
        </>
      )}

      <HistoryList sessions={history.sessions} />
    </>
  );
}
