import { formatShortDate } from '@/lib/domain/week';
import type { HistorySession } from '@/types/session';
import { Badge, Card, EmptyState } from '@/components/shared';

/** Newest first, one row per session. Read-only, so no client bundle needed. */
export function HistoryList({ sessions }: { sessions: HistorySession[] }) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        title="No sessions yet"
        description="Log your first set and it will show up here, with your totals for every session after that."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((session) => (
        <li key={session.sessionId}>
          <Card className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink-50">{formatShortDate(session.date)}</p>
                <p className="truncate text-xs text-ink-400">
                  {session.programName}
                  {session.dayNumber > 0 && ` · Day ${session.dayNumber}`}
                  {session.label && ` · ${session.label}`}
                </p>
              </div>
              {session.completedAt ? (
                <Badge tone="good">Completed</Badge>
              ) : (
                <Badge tone="neutral">Logged</Badge>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Exercises" value={session.exerciseCount} />
              <Stat label="Sets" value={session.setCount} />
              <Stat label="Volume" value={`${formatKg(session.totalVolumeKg)} kg`} />
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-ink-850 px-2 py-2">
      <dt className="text-[0.7rem] text-ink-400">{label}</dt>
      <dd className="tabular text-sm font-semibold text-ink-50">{value}</dd>
    </div>
  );
}

/** Deterministic thousands separator — `toLocaleString` can differ per runtime. */
function formatKg(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
