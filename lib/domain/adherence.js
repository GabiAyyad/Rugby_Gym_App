import { daysBetween } from './week';

/** Turns a logged/scheduled pair into one of the four adherence buckets shown on the dashboard. */
function statusFor(logged, scheduled) {
  if (logged === 0) return 'not_started';
  if (scheduled === 0) return 'on_track'; // nothing was scheduled, so there's nothing to be behind on
  if (logged >= scheduled) return 'complete';
  return logged / scheduled >= 0.5 ? 'on_track' : 'behind';
}

/**
 * Adherence is derived, never stored: a player trained on a day exactly when a
 * session of theirs carries logs. Repeats of the same program day inside one
 * week count once, so re-opening Day 2 to fix a set does not inflate the number.
 *
 * `input` is `{ players, loggedSessions, weekStart, weekEnd, today }`:
 *  - `players`: `{ playerId, playerName, teamId, teamName, positionGroup, programName, sessionsScheduled }[]`
 *  - `loggedSessions`: every session that has at least one log against it,
 *    `{ playerId, date, programDayId }[]` — not just this week's, because the
 *    "days since last log" figure needs the player's whole history.
 *
 * Returns one `AdherenceRow` per player (see types/session.js).
 */
export function calculateAdherence(input) {
  const { players, loggedSessions, weekStart, weekEnd, today } = input;

  // playerId -> Set of distinct program_day_ids trained *this week* (a Set, so
  // training the same day twice in a week only counts once).
  const thisWeekDays = new Map();
  // playerId -> most recent date they logged anything, ever.
  const lastLog = new Map();

  for (const session of loggedSessions) {
    const previous = lastLog.get(session.playerId);
    if (!previous || session.date > previous) lastLog.set(session.playerId, session.date);

    if (session.date >= weekStart && session.date <= weekEnd) {
      const days = thisWeekDays.get(session.playerId) ?? new Set();
      days.add(session.programDayId);
      thisWeekDays.set(session.playerId, days);
    }
  }

  return players.map((player) => {
    const scheduled = player.sessionsScheduled;
    const logged = thisWeekDays.get(player.playerId)?.size ?? 0;
    const last = lastLog.get(player.playerId) ?? null;

    return {
      playerId: player.playerId,
      playerName: player.playerName,
      teamId: player.teamId,
      teamName: player.teamName,
      positionGroup: player.positionGroup,
      programName: player.programName,
      sessionsLogged: logged,
      sessionsScheduled: scheduled,
      // Capped at 100%: training more than scheduled doesn't push you past "complete".
      adherencePct: scheduled === 0 ? 0 : Math.round((Math.min(logged, scheduled) / scheduled) * 100),
      lastLogDate: last,
      daysSinceLastLog: last ? daysBetween(last, today) : null,
      status: statusFor(logged, scheduled),
    };
  });
}

/** Default sort for the adherence dashboard: the people falling behind float to the top. */
export function sortByRisk(rows) {
  // Lower rank = shown first. Ties are broken by adherence %, then by how
  // stale their last log is (staler first), then alphabetically.
  const rank = { not_started: 0, behind: 1, on_track: 2, complete: 3 };
  return [...rows].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.adherencePct !== b.adherencePct) return a.adherencePct - b.adherencePct;
    const aStale = a.daysSinceLastLog ?? Number.MAX_SAFE_INTEGER;
    const bStale = b.daysSinceLastLog ?? Number.MAX_SAFE_INTEGER;
    if (aStale !== bStale) return bStale - aStale;
    return a.playerName.localeCompare(b.playerName);
  });
}

/**
 * Epley formula estimated one-rep-max, rounded to 1 decimal — good enough to
 * draw a trend line on the progress chart, not a substitute for an actual 1RM
 * test. A single-rep set just returns the weight lifted (no extrapolation needed).
 */
export function estimateOneRepMax(weightKg, reps) {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}
