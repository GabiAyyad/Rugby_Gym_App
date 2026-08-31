'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatShortDate } from '@/lib/domain/week';
import type { PositionGroup } from '@/types/database';
import type { LeaderboardResult } from '@/types/session';
import { Button, Card, CardBody, CardHeader, EmptyState, ErrorNote, cn } from '@/components/shared';

/**
 * Team-scoped, twice-gated: the coach's switch and the player's own opt-in. A
 * player who has not opted in is shown the deal, never other people's numbers —
 * the server sends no entries until both gates are open.
 */
export function LeaderboardTable({ initial }: { initial: LeaderboardResult }) {
  const [board, setBoard] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setOptIn(optIn: boolean) {
    setBusy(true);
    setError(null);
    try {
      setBoard(await api.patch<LeaderboardResult>('/api/player/leaderboard/opt-in', { optIn }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!board.teamEnabled) {
    return (
      <EmptyState
        title="The squad leaderboard is off"
        description="Your coach has not switched it on for this team. Your training stays between you and the coaches."
      />
    );
  }

  if (!board.optedIn) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink-50">Join the squad leaderboard</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <p className="text-sm text-ink-300">
            The leaderboard ranks this week by sessions logged, then by total volume — your team only,
            never the other squad. Nothing of yours appears until you turn it on, and you can turn it
            back off whenever you like.
          </p>
          <ErrorNote message={error} />
          <Button size="lg" fullWidth loading={busy} onClick={() => void setOptIn(true)}>
            Show me on the leaderboard
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-400">
        Week of {formatShortDate(board.weekStart)} – {formatShortDate(board.weekEnd)}
      </p>

      <ErrorNote message={error} />

      {board.entries.length === 0 ? (
        <EmptyState
          title="Nobody has trained yet this week"
          description="Be the first to log a session and take the top spot."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {board.entries.map((entry) => (
            <li key={entry.playerId}>
              <Card
                className={cn(
                  'flex items-center gap-3 px-3 py-3',
                  entry.isMe && 'border-pitch-500/50 bg-pitch-500/10',
                )}
              >
                <span
                  aria-hidden
                  className="tabular grid size-9 shrink-0 place-items-center rounded-full bg-ink-850 text-sm font-bold text-ink-200"
                >
                  {medal(entry.rank)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-50">
                    {entry.playerName}
                    {entry.isMe && <span className="ml-2 text-xs font-normal text-pitch-400">You</span>}
                  </p>
                  <p className="text-xs text-ink-400">
                    {positionLabel(entry.positionGroup)}
                    <span className="sr-only">, rank {entry.rank}</span>
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-semibold text-ink-50">
                    {entry.sessionsLogged} {entry.sessionsLogged === 1 ? 'session' : 'sessions'}
                  </p>
                  <p className="tabular text-xs text-ink-400">{formatKg(entry.totalVolumeKg)} kg</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Button variant="ghost" fullWidth loading={busy} onClick={() => void setOptIn(false)}>
        Hide me from the leaderboard
      </Button>
    </div>
  );
}

function medal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

function positionLabel(group: PositionGroup | null): string {
  if (group === 'forward') return 'Forward';
  if (group === 'back') return 'Back';
  return 'Squad';
}

/** Deterministic thousands separator — `toLocaleString` can differ per runtime. */
function formatKg(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
