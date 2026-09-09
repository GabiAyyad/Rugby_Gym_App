import Link from 'next/link';
import { AdherenceTable } from '@/components/admin/AdherenceTable';
import { Card, PageHeader } from '@/components/shared';
import { getAdherenceDashboard } from '@/lib/actions/getAdherenceDashboard';
import { getLeaderboard } from '@/lib/actions/getLeaderboard';
import { requireAdminPage } from '@/lib/auth';
import { formatShortDate } from '@/lib/domain/week';

export const dynamic = 'force-dynamic';

/**
 * Where admins land after signing in. It answers one question — who is not
 * training this week — before anything else on the screen.
 *
 * All the actual data crunching (who's scheduled, who's logged, who's
 * falling behind) happens server-side in getAdherenceDashboard/getLeaderboard
 * — this component only lays out the summary tiles and hands the row data to
 * <AdherenceTable> for the interactive sort/filter table.
 */
export default async function AdminDashboardPage() {
  const session = await requireAdminPage();

  // Fetched in parallel since neither depends on the other.
  const [dashboard, leaderboard] = await Promise.all([
    getAdherenceDashboard(session),
    // Only for the team switch below the table; skips building the board itself.
    getLeaderboard(session, { settingsOnly: true }),
  ]);

  const { summary } = dashboard;
  const notTraining = summary.playerCount - summary.trainedThisWeek;
  // Nothing is scheduled against anybody — say why rather than showing a wall of red.
  const noLiveBlock = dashboard.rows.length > 0 && dashboard.rows.every((row) => row.programName === null);

  return (
    <>
      <PageHeader title="Adherence" subtitle={`${formatShortDate(dashboard.weekStart)} – ${formatShortDate(dashboard.weekEnd)} · ${session.teamName}`} />

      {noLiveBlock && (
        <p className="mb-4 rounded-xl text-sm" style={{ border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)', color: 'var(--flare-400)', padding: '0.5rem 0.75rem' }}>
          No training block is live for this team today, so nothing is scheduled to count against.{' '}
          <Link href="/admin/programs" className="font-semibold underline">
            Build a block
          </Link>
        </p>
      )}

      <div className="mb-4 grid-cols-2 md-grid-cols-4" style={{ display: 'grid', gap: '0.5rem' }}>
        <Stat label="Squad" value={summary.playerCount} />
        <Stat label="Trained this week" value={summary.trainedThisWeek} tone={summary.playerCount > 0 && summary.trainedThisWeek === 0 ? 'bad' : 'good'} />
        <Stat label="Nothing yet" value={notTraining} tone={notTraining > 0 ? 'bad' : 'good'} hint={summary.notStarted > 0 ? `${summary.notStarted} never logged` : undefined} />
        <Stat label="Avg adherence" value={`${summary.averageAdherencePct}%`} />
      </div>

      <AdherenceTable dashboard={dashboard} leaderboardEnabled={leaderboard.teamEnabled} />
    </>
  );
}

function Stat({ label, value, tone = 'neutral', hint }) {
  const colour = tone === 'bad' ? 'var(--alert-400)' : tone === 'good' ? 'var(--pitch-400)' : 'var(--ink-50)';

  return (
    <Card className="px-3 py-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="tabular mt-1 text-2xl font-bold" style={{ color: colour }}>
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-ink-400" style={{ fontSize: '0.7rem' }}>
          {hint}
        </p>
      )}
    </Card>
  );
}
