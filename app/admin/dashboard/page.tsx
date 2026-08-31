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
 */
export default async function AdminDashboardPage() {
  const session = await requireAdminPage();

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
      <PageHeader
        title="Adherence"
        subtitle={`${formatShortDate(dashboard.weekStart)} – ${formatShortDate(dashboard.weekEnd)} · ${session.teamName}`}
      />

      {noLiveBlock && (
        <p className="mb-4 rounded-xl border border-flare-500/40 bg-flare-500/10 px-3 py-2 text-sm text-flare-400">
          No training block is live for this team today, so nothing is scheduled to count against.{' '}
          <Link href="/admin/programs" className="font-semibold underline underline-offset-2">
            Build a block
          </Link>
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Squad" value={summary.playerCount} />
        <Stat
          label="Trained this week"
          value={summary.trainedThisWeek}
          tone={summary.playerCount > 0 && summary.trainedThisWeek === 0 ? 'bad' : 'good'}
        />
        <Stat
          label="Nothing yet"
          value={notTraining}
          tone={notTraining > 0 ? 'bad' : 'good'}
          hint={summary.notStarted > 0 ? `${summary.notStarted} never logged` : undefined}
        />
        <Stat label="Avg adherence" value={`${summary.averageAdherencePct}%`} />
      </div>

      <AdherenceTable dashboard={dashboard} leaderboardEnabled={leaderboard.teamEnabled} />
    </>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'good' | 'bad';
  hint?: string;
}) {
  const colour =
    tone === 'bad' ? 'text-alert-400' : tone === 'good' ? 'text-pitch-400' : 'text-ink-50';

  return (
    <Card className="px-3 py-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={`tabular mt-1 text-2xl font-bold ${colour}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[0.7rem] text-ink-400">{hint}</p>}
    </Card>
  );
}
