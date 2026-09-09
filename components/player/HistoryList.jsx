import { formatShortDate } from '@/lib/domain/week';
import { Badge, Card, EmptyState } from '@/components/shared';

/**
 * The player's session history list on /player/history: one card per past
 * session (newest first — the server already sorts them), each showing the
 * date, which block/day it was, and totals for exercises/sets/volume.
 *
 * Read-only and has no state of its own, so it's a plain function component
 * (no 'use client' needed) — the page it's used on renders it server-side.
 *
 * @param {object} props
 * @param {object[]} props.sessions HistorySession[] from getPlayerHistory.
 */
export function HistoryList({ sessions }) {
  if (sessions.length === 0) {
    return <EmptyState title="No sessions yet" description="Log your first set and it will show up here, with your totals for every session after that." />;
  }

  return (
    <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0 }}>
      {sessions.map((session) => (
        <li key={session.sessionId}>
          <Card className="px-4 py-3">
            <div className="flex justify-between gap-3" style={{ alignItems: 'flex-start' }}>
              <div className="min-w-0">
                <p className="font-semibold text-ink-50">{formatShortDate(session.date)}</p>
                <p className="truncate text-xs text-ink-400">
                  {session.programName}
                  {session.dayNumber > 0 && ` · Day ${session.dayNumber}`}
                  {session.label && ` · ${session.label}`}
                </p>
              </div>
              {session.completedAt ? <Badge tone="good">Completed</Badge> : <Badge tone="neutral">Logged</Badge>}
            </div>

            <dl className="grid-cols-3 mt-3 text-center" style={{ display: 'grid', gap: '0.5rem' }}>
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

/** One of the three small number tiles (Exercises/Sets/Volume) inside a session card. */
function Stat({ label, value }) {
  return (
    <div className="rounded-lg px-2 py-2" style={{ background: 'var(--ink-850)' }}>
      <dt className="text-xs text-ink-400" style={{ fontSize: '0.7rem' }}>
        {label}
      </dt>
      <dd className="tabular text-sm font-semibold text-ink-50">{value}</dd>
    </div>
  );
}

/** Formats a kg total with thousands separators (e.g. 12345 -> "12,345"). A hand-rolled regex is used instead of `toLocaleString` because its output can differ per runtime/locale. */
function formatKg(value) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
