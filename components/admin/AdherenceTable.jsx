'use client';

import { useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { sortByRisk } from '@/lib/domain/adherence';
import { formatShortDate } from '@/lib/domain/week';
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorNote, Select, cn } from '@/components/shared';

// Display metadata for each of the four adherence statuses (see
// lib/domain/adherence.js's `statusFor` for how a player is assigned one):
// label + badge tone shown in the Status column, and the progress-bar colour.
const STATUS = {
  complete: { label: 'Complete', tone: 'good', bar: 'var(--pitch-500)' },
  on_track: { label: 'On track', tone: 'info', bar: 'var(--sky-ish)' },
  behind: { label: 'Behind', tone: 'warn', bar: 'var(--flare-500)' },
  not_started: { label: 'Not started', tone: 'bad', bar: 'var(--alert-500)' },
};

// The four sort orders offered on phone (via the Select) and desktop (via
// clickable column headers) — `key` matches what sortRows() below expects.
const SORTS = [
  { key: 'risk', label: 'Falling behind first' },
  { key: 'adherence', label: 'Lowest adherence' },
  { key: 'lastLog', label: 'Longest since a log' },
  { key: 'name', label: 'Name (A–Z)' },
];

const POSITIONS = [
  { key: 'all', label: 'Everyone' },
  { key: 'forward', label: 'Forwards' },
  { key: 'back', label: 'Backs' },
];

/**
 * The main table on the admin dashboard: every player in the squad, sorted
 * worst-adherence-first by default, with a position filter and clickable
 * column-header sorting.
 *
 * Filtering and sorting happen here on the client rather than through the
 * API: the whole squad is ~40 rows, and gym wifi is not something to spend a
 * round trip on for a sort click.
 *
 * Under `md` this renders as a stacked card list instead of the table — a
 * wide table that scrolls sideways is useless on the phone a coach actually
 * holds. Both views (`PlayerCard` and the `<table>`) share the same `rows`.
 *
 * @param {object} props
 * @param {object} props.dashboard The AdherenceDashboard from getAdherenceDashboard: {rows, weekStart, ...}.
 * @param {boolean} props.leaderboardEnabled Whether the team's leaderboard switch is currently on
 *   (initial value for the LeaderboardSwitch rendered at the bottom of this table).
 */
export function AdherenceTable({ dashboard, leaderboardEnabled }) {
  const [position, setPosition] = useState('all'); // 'all' | 'forward' | 'back'
  const [sort, setSort] = useState('risk');
  const [reversed, setReversed] = useState(false); // clicking the active sort column again reverses it

  // Filters by position, sorts, then reverses if the same header was clicked
  // twice. Recomputed only when an input actually changes.
  const rows = useMemo(() => {
    const filtered = position === 'all' ? dashboard.rows : dashboard.rows.filter((row) => row.positionGroup === position);
    const ordered = sortRows(filtered, sort);
    return reversed ? [...ordered].reverse() : ordered;
  }, [dashboard.rows, position, sort, reversed]);

  /** Clicking a column header: switch to sorting by it, or reverse if it's already the active sort. */
  function chooseSort(key) {
    if (key === sort) setReversed((value) => !value);
    else {
      setSort(key);
      setReversed(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3" style={{ justifyContent: 'space-between' }}>
        <div role="group" aria-label="Position group" className="segmented">
          {POSITIONS.map((option) => (
            <button key={option.key} type="button" aria-pressed={position === option.key} onClick={() => setPosition(option.key)} className={position === option.key ? 'active' : ''}>
              {option.label}
            </button>
          ))}
        </div>

        {/* From md up the table headers do the sorting instead. */}
        <div className="md-hidden" style={{ width: '15rem' }}>
          <Select
            label="Sort"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
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
        {rows.length === dashboard.rows.length ? `${rows.length} ${rows.length === 1 ? 'player' : 'players'}` : `${rows.length} of ${dashboard.rows.length} players`}
        {' · week of '}
        {formatShortDate(dashboard.weekStart)}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="Nobody here yet"
          description={dashboard.rows.length === 0 ? 'Add players to this squad and their sessions will show up here as they train.' : 'No players in this position group. Try Everyone.'}
        />
      ) : (
        <>
          {/* Phone: stacked cards. */}
          <ul className="md-hidden flex flex-col gap-2" style={{ listStyle: 'none', padding: 0 }}>
            {rows.map((row) => (
              <li key={row.playerId}>
                <PlayerCard row={row} />
              </li>
            ))}
          </ul>

          {/* md and up: a real table, still boxed in case of long names. */}
          <Card className="hidden md-block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: '46rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--ink-800)' }} className="text-xs tracking-wide text-ink-400 uppercase">
                    <SortableHeader label="Player" active={sort === 'name'} reversed={reversed} onClick={() => chooseSort('name')} />
                    <th className="px-3 py-2 font-medium text-left">Block</th>
                    <th className="px-3 py-2 font-medium text-left">This week</th>
                    <SortableHeader label="Adherence" active={sort === 'adherence'} reversed={reversed} onClick={() => chooseSort('adherence')} />
                    <SortableHeader label="Last log" active={sort === 'lastLog'} reversed={reversed} onClick={() => chooseSort('lastLog')} />
                    <SortableHeader label="Status" active={sort === 'risk'} reversed={reversed} onClick={() => chooseSort('risk')} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.playerId} style={{ borderBottom: '1px solid var(--ink-800)' }}>
                      <td className="px-3 py-3">
                        <div className="font-medium text-ink-50">{row.playerName}</div>
                        <div className="text-xs text-ink-400">{positionLabel(row.positionGroup)}</div>
                      </td>
                      <td className="px-3 py-3 text-ink-300">{row.programName ?? 'No live block'}</td>
                      <td className="px-3 py-3 tabular text-ink-200">
                        {row.sessionsLogged} / {row.sessionsScheduled || '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar row={row} style={{ width: '6rem' }} />
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

/** One clickable, sort-indicating `<th>` for the desktop table (an up/down triangle shows when it's the active sort). */
function SortableHeader({ label, active, reversed, onClick }) {
  return (
    <th scope="col" aria-sort={active ? (reversed ? 'descending' : 'ascending') : 'none'} className="px-3 py-2 text-left">
      <button
        type="button"
        onClick={onClick}
        className="font-medium tracking-wide uppercase"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--ink-50)' : 'var(--ink-400)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
      >
        {label}
        <span aria-hidden className="text-xs" style={{ opacity: active ? 1 : 0 }}>
          {reversed ? '▲' : '▼'}
        </span>
      </button>
    </th>
  );
}

/** Phone-view row: one player's name, badges, progress bar, and last-log text as a stacked card. */
function PlayerCard({ row }) {
  return (
    <Card className="p-3">
      <div className="flex justify-between gap-3" style={{ alignItems: 'flex-start' }}>
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

/** A thin horizontal bar filled to `row.adherencePct`, coloured by status. */
function ProgressBar({ row, className, style }) {
  const pct = Math.max(0, Math.min(100, row.adherencePct));
  return (
    <div className={cn('rounded-full', className)} style={{ height: '0.5rem', overflow: 'hidden', background: 'var(--ink-800)', ...style }} role="img" aria-label={`${pct}% of scheduled sessions`}>
      <div className="rounded-full" style={{ height: '100%', width: `${pct}%`, background: STATUS[row.status].bar }} />
    </div>
  );
}

/**
 * The team-wide leaderboard on/off switch. Lives on this screen because it's
 * the page admins land on. Turning this on doesn't publish anyone's data by
 * itself — each player still has to individually opt in (see
 * components/player/LeaderboardTable.jsx).
 */
function LeaderboardSwitch({ initialEnabled }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  /** Toggles the switch optimistically, then reverts it if the server call fails. */
  async function toggle() {
    const next = !enabled;
    setBusy(true);
    setError(null);
    setEnabled(next);
    try {
      const result = await api.patch('/api/admin/team/leaderboard', { enabled: next });
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
        <div className="flex justify-between gap-4">
          <p className="text-sm text-ink-400">Players additionally opt in individually — turning this on publishes nobody until they do.</p>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Squad leaderboard"
            disabled={busy}
            onClick={toggle}
            className="shrink-0"
            style={{
              position: 'relative',
              height: '2.75rem',
              width: '4.5rem',
              borderRadius: '999px',
              border: `1px solid ${enabled ? 'var(--pitch-500)' : 'var(--ink-700)'}`,
              background: enabled ? 'rgba(34,197,94,0.25)' : 'var(--ink-800)',
              cursor: 'pointer',
              opacity: busy ? 0.5 : 1,
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: '0.25rem',
                left: enabled ? '2rem' : '0.25rem',
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '999px',
                background: enabled ? 'var(--pitch-500)' : 'var(--ink-600)',
                transition: 'left 0.15s',
              }}
            />
          </button>
        </div>
        <p className="text-xs text-ink-400">{enabled ? 'On for this team.' : 'Off for this team.'}</p>
        <ErrorNote message={error} />
      </CardBody>
    </Card>
  );
}

/** Applies one of the four sort orders to a copy of `rows` (never mutates the input array). */
function sortRows(rows, sort) {
  const stale = (row) => row.daysSinceLastLog ?? Number.MAX_SAFE_INTEGER;

  switch (sort) {
    case 'name':
      return [...rows].sort((a, b) => a.playerName.localeCompare(b.playerName));
    case 'adherence':
      return [...rows].sort((a, b) => a.adherencePct - b.adherencePct || a.playerName.localeCompare(b.playerName));
    case 'lastLog':
      return [...rows].sort((a, b) => stale(b) - stale(a) || a.playerName.localeCompare(b.playerName));
    default:
      return sortByRisk(rows);
  }
}

/** Human label for a position group, with a fallback for players who have none set. */
function positionLabel(group) {
  if (group === 'forward') return 'Forward';
  if (group === 'back') return 'Back';
  return 'No position';
}

/** Renders the "last logged" cell/line: "No sessions logged yet", "Logged today", "Yesterday", or "N days ago · <date>". */
function lastLogText(row) {
  if (!row.lastLogDate || row.daysSinceLastLog === null) return 'No sessions logged yet';
  if (row.daysSinceLastLog <= 0) return 'Logged today';
  if (row.daysSinceLastLog === 1) return 'Yesterday';
  return `${row.daysSinceLastLog} days ago · ${formatShortDate(row.lastLogDate)}`;
}
