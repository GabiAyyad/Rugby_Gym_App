'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatShortDate } from '@/lib/domain/week';
import { Button, Card, CardBody, CardHeader, EmptyState, ErrorNote, cn } from '@/components/shared';

/**
 * The player-facing "Squad" leaderboard screen. Renders one of three states
 * depending on `board`, checked in order:
 *  1. `!teamEnabled` — the coach hasn't turned the feature on for this team at all.
 *  2. `!optedIn` — the feature is on, but this player hasn't opted in yet: shows
 *     an explanation and an opt-in button, with no entries visible.
 *  3. otherwise — the actual ranked list, plus a button to opt back out.
 *
 * Team-scoped, twice-gated: the coach's switch and the player's own opt-in. A
 * player who has not opted in is shown the deal, never other people's numbers —
 * the server sends no entries until both gates are open.
 *
 * @param {object} props
 * @param {object} props.initial The LeaderboardResult from getLeaderboard, rendered server-side.
 */
export function LeaderboardTable({ initial }) {
  const [board, setBoard] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  /** Opts in or out; the server's response (including the fresh ranked list) replaces `board` directly. */
  async function setOptIn(optIn) {
    setBusy(true);
    setError(null);
    try {
      setBoard(await api.patch('/api/player/leaderboard/opt-in', { optIn }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!board.teamEnabled) {
    return <EmptyState title="The squad leaderboard is off" description="Your coach has not switched it on for this team. Your training stays between you and the coaches." />;
  }

  if (!board.optedIn) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink-50">Join the squad leaderboard</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <p className="text-sm text-ink-300">
            The leaderboard ranks this week by sessions logged, then by total volume — your team only, never the other squad. Nothing of yours appears until you turn it on, and you can turn it
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
        <EmptyState title="Nobody has trained yet this week" description="Be the first to log a session and take the top spot." />
      ) : (
        <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0 }}>
          {board.entries.map((entry) => (
            <li key={entry.playerId}>
              <Card className="flex gap-3 px-3 py-3" style={entry.isMe ? { alignItems: 'center', border: '1px solid rgba(34,197,94,0.5)', background: 'rgba(34,197,94,0.1)' } : { alignItems: 'center' }}>
                <span aria-hidden className="tabular shrink-0 text-sm font-bold text-ink-200" style={{ display: 'grid', placeItems: 'center', width: '2.25rem', height: '2.25rem', borderRadius: '999px', background: 'var(--ink-850)' }}>
                  {medal(entry.rank)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-50">
                    {entry.playerName}
                    {entry.isMe && <span className="ml-2 text-xs" style={{ color: 'var(--pitch-400)' }}>You</span>}
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

/** Renders rank 1-3 as a medal emoji, otherwise just the number. */
function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

/** Human label for a position group, falling back to "Squad" if unset. */
function positionLabel(group) {
  if (group === 'forward') return 'Forward';
  if (group === 'back') return 'Back';
  return 'Squad';
}

/** Formats a kg total with thousands separators — see the identical helper in HistoryList.jsx for why not `toLocaleString`. */
function formatKg(value) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
