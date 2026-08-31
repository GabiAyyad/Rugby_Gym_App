'use client';

import { useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { sortByRisk } from '@/lib/domain/adherence';
import { formatShortDate } from '@/lib/domain/week';
import type { PositionGroup } from '@/types/database';
import type { AdherenceDashboard, AdherenceRow, AdherenceStatus } from '@/types/session';
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorNote, Select, cn } from '@/components/shared';

type SortKey = 'risk' | 'name' | 'adherence' | 'lastLog';
type PositionFilter = PositionGroup | 'all';

const STATUS: Record<AdherenceStatus, { label: string; tone: 'good' | 'info' | 'warn' | 'bad'; bar: string }> = {
  complete: { label: 'Complete', tone: 'good', bar: 'bg-pitch-500' },
  on_track: { label: 'On track', tone: 'info', bar: 'bg-sky-ish' },
  behind: { label: 'Behind', tone: 'warn', bar: 'bg-flare-500' },
  not_started: { label: 'Not started', tone: 'bad', bar: 'bg-alert-500' },
};

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'risk', label: 'Falling behind first' },
  { key: 'adherence', label: 'Lowest adherence' },
  { key: 'lastLog', label: 'Longest since a log' },
  { key: 'name', label: 'Name (A–Z)' },
];

const POSITIONS: Array<{ key: PositionFilter; label: string }> = [
  { key: 'all', label: 'Everyone' },
  { key: 'forward', label: 'Forwards' },
  { key: 'back', label: 'Backs' },
];

/**
 * The squad, worst first. Filtering and sorting happen here rather than through
 * the API: the whole squad is ~40 rows, and gym wifi is not something to spend a
 * round trip on for a sort click.
 *
 * Under md this is a stacked card list — a wide table that scrolls sideways is
 * useless on the phone a coach actually holds.
 */
export function AdherenceTable({
  dashboard,
  leaderboardEnabled,
}: {
  dashboard: AdherenceDashboard;
  leaderboardEnabled: boolean;
}) {
  const [position, setPosition] = useState<PositionFilter>('all');
  const [sort, setSort] = useState<SortKey>('risk');
  const [reversed, setReversed] = useState(false);

  const rows = useMemo(() => {
    const filtered =
      position === 'all'
        ? dashboard.rows
        : dashboard.rows.filter((row) => row.positionGroup === position);
    const ordered = sortRows(filtered, sort);
    return reversed ? [...ordered].reverse() : ordered;
  }, [dashboard.rows, position, sort, reversed]);

  function chooseSort(key: SortKey) {
    if (key === sort) setReversed((value) => !value);
    else {
      setSort(key);
      setReversed(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Position group" className="flex rounded-xl border border-ink-800 bg-ink-900 p-1">
          {POSITIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={position === option.key}
              onClick={() => setPosition(option.key)}
              className={cn(
                'min-h-11 flex-1 rounded-lg px-3 text-sm font-medium transition-colors',
                position === option.key ? 'bg-ink-700 text-ink-50' : 'text-ink-400 hover:text-ink-200',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* From md up the table headers do the sorting instead. */}
        <div className="sm:w-60 md:hidden">
          <Select
            label="Sort"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortKey);
              setReversed(false);
            }}
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p className="text-xs text-ink-400">
        {rows.length === dashboard.rows.length
          ? `${rows.length} ${rows.length === 1 ? 'player' : 'players'}`
          : `${rows.length} of ${dashboard.rows.length} players`}
        {' · week of '}
        {formatShortDate(dashboard.weekStart)}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="Nobody here yet"
          description={
            dashboard.rows.length === 0
              ? 'Add players to this squad and their sessions will show up here as they train.'
              : 'No players in this position group. Try Everyone.'
          }
        />
      ) : (
        <>
          {/* Phone: stacked cards. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((row) => (
              <li key={row.playerId}>
                <PlayerCard row={row} />
              </li>
            ))}
          </ul>

          {/* md and up: a real table, still boxed in case of long names. */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left text-xs tracking-wide text-ink-400 uppercase">
                    <SortableHeader label="Player" active={sort === 'name'} reversed={reversed} onClick={() => chooseSort('name')} />
                    <th className="px-3 py-2 font-medium">Block</th>
                    <th className="px-3 py-2 font-medium">This week</th>
                    <SortableHeader
                      label="Adherence"
                      active={sort === 'adherence'}
                      reversed={reversed}
                      onClick={() => chooseSort('adherence')}
                    />
                    <SortableHeader
                      label="Last log"
                      active={sort === 'lastLog'}
                      reversed={reversed}
                      onClick={() => chooseSort('lastLog')}
                    />
                    <SortableHeader
                      label="Status"
                      active={sort === 'risk'}
                      reversed={reversed}
                      onClick={() => chooseSort('risk')}
                    />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.playerId} className="border-b border-ink-800/70 last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-medium text-ink-50">{row.playerName}</div>
                        <div className="text-xs text-ink-400">{positionLabel(row.positionGroup)}</div>
                      </td>
                      <td className="px-3 py-3 text-ink-300">{row.programName ?? 'No live block'}</td>
                      <td className="tabular px-3 py-3 text-ink-200">
                        {row.sessionsLogged} / {row.sessionsScheduled || '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar row={row} className="w-24" />
                          <span className="tabular text-ink-300">{row.adherencePct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-ink-300">{lastLogText(row)}</td>
                      <td className="px-3 py-3">
                        <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <LeaderboardSwitch initialEnabled={leaderboardEnabled} />
    </section>
  );
}

function SortableHeader({
  label,
  active,
  reversed,
  onClick,
}: {
  label: string;
  active: boolean;
  reversed: boolean;
  onClick: () => void;
}) {
  return (
    <th scope="col" aria-sort={active ? (reversed ? 'descending' : 'ascending') : 'none'} className="px-3 py-2">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 font-medium tracking-wide uppercase transition-colors',
          active ? 'text-ink-50' : 'text-ink-400 hover:text-ink-200',
        )}
      >
        {label}
        <span aria-hidden className={cn('text-[0.6rem]', !active && 'opacity-0')}>
          {reversed ? '▲' : '▼'}
        </span>
      </button>
    </th>
  );
}

function PlayerCard({ row }: { row: AdherenceRow }) {
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-50">{row.playerName}</p>
          <p className="truncate text-xs text-ink-400">
            {positionLabel(row.positionGroup)}
            {' · '}
            {row.programName ?? 'No live block'}
          </p>
        </div>
        <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProgressBar row={row} className="flex-1" />
        <span className="tabular shrink-0 text-sm text-ink-200">
          {row.sessionsLogged}/{row.sessionsScheduled || '—'}
        </span>
      </div>

      <p className="mt-2 text-xs text-ink-400">{lastLogText(row)}</p>
    </Card>
  );
}

function ProgressBar({ row, className }: { row: AdherenceRow; className?: string }) {
  const pct = Math.max(0, Math.min(100, row.adherencePct));
  return (
    <div
      className={cn('h-2 overflow-hidden rounded-full bg-ink-800', className)}
      role="img"
      aria-label={`${pct}% of scheduled sessions`}
    >
      <div className={cn('h-full rounded-full', STATUS[row.status].bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** The team switch lives on this screen because it is the page admins land on. */
function LeaderboardSwitch({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setBusy(true);
    setError(null);
    setEnabled(next);
    try {
      const result = await api.patch<{ enabled: boolean }>('/api/admin/team/leaderboard', {
        enabled: next,
      });
      setEnabled(result.enabled);
    } catch (caught) {
      setEnabled(!next);
      setError(caught instanceof ApiError ? caught.message : 'Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-2">
      <CardHeader>
        <h2 className="text-sm font-semibold text-ink-50">Squad leaderboard</h2>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-400">
            Players additionally opt in individually — turning this on publishes nobody until they do.
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Squad leaderboard"
            disabled={busy}
            onClick={toggle}
            className={cn(
              'relative h-11 w-[4.5rem] shrink-0 rounded-full border transition-colors disabled:opacity-50',
              enabled ? 'border-pitch-500 bg-pitch-500/25' : 'border-ink-700 bg-ink-800',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'absolute top-1 size-9 rounded-full transition-all',
                enabled ? 'left-[2rem] bg-pitch-500' : 'left-1 bg-ink-600',
              )}
            />
          </button>
        </div>
        <p className="text-xs text-ink-400">{enabled ? 'On for this team.' : 'Off for this team.'}</p>
        <ErrorNote message={error} />
      </CardBody>
    </Card>
  );
}

function sortRows(rows: AdherenceRow[], sort: SortKey): AdherenceRow[] {
  const stale = (row: AdherenceRow) => row.daysSinceLastLog ?? Number.MAX_SAFE_INTEGER;

  switch (sort) {
    case 'name':
      return [...rows].sort((a, b) => a.playerName.localeCompare(b.playerName));
    case 'adherence':
      return [...rows].sort(
        (a, b) => a.adherencePct - b.adherencePct || a.playerName.localeCompare(b.playerName),
      );
    case 'lastLog':
      return [...rows].sort((a, b) => stale(b) - stale(a) || a.playerName.localeCompare(b.playerName));
    default:
      return sortByRisk(rows);
  }
}

function positionLabel(group: PositionGroup | null): string {
  if (group === 'forward') return 'Forward';
  if (group === 'back') return 'Back';
  return 'No position';
}

function lastLogText(row: AdherenceRow): string {
  if (!row.lastLogDate || row.daysSinceLastLog === null) return 'No sessions logged yet';
  if (row.daysSinceLastLog <= 0) return 'Logged today';
  if (row.daysSinceLastLog === 1) return 'Yesterday';
  return `${row.daysSinceLastLog} days ago · ${formatShortDate(row.lastLogDate)}`;
}
