import 'server-only';
import { calculateAdherence, sortByRisk } from '@/lib/domain/adherence';
import { resolveActiveProgram } from '@/lib/domain/activeProgram';
import { endOfWeek, startOfWeek, todayISO } from '@/lib/domain/week';
import { listReportingPlayers, listSessionsWithLogs, listTeamProgramsWithDayCounts } from '@/lib/db/queries/reporting';

const POSITION_GROUPS = ['forward', 'back'];

/**
 * The screen a coach opens to find out who is not training.
 *
 * Scheduled = the number of days in the block that is live for that player's
 * position group today. Logged = distinct program days this week that carry log
 * rows. Both halves are worked out by pure functions in lib/domain; this action
 * only assembles their inputs.
 *
 * An admin only ever sees their own team: `session.teamId` scopes every read,
 * and the `teams` field carries their team alone. Cross-team visibility is out
 * of scope by design, not by omission.
 */
export async function getAdherenceDashboard(session, input = {}) {
  const today = input.date ?? todayISO();
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);

  const [players, programs] = await Promise.all([
    listReportingPlayers(session.teamId),
    listTeamProgramsWithDayCounts(session.teamId),
  ]);

  // Resolve the live block once per position group rather than once per player.
  const activeByGroup = new Map();
  for (const group of POSITION_GROUPS) {
    activeByGroup.set(group, resolveActiveProgram(programs, today, { teamId: session.teamId, positionGroup: group }));
  }

  const scoped = input.positionGroup ? players.filter((player) => player.positionGroup === input.positionGroup) : players;

  const adherencePlayers = scoped.map((player) => {
    const active = player.positionGroup ? (activeByGroup.get(player.positionGroup) ?? null) : null;
    return {
      playerId: player.id,
      playerName: player.name,
      teamId: session.teamId,
      teamName: session.teamName,
      positionGroup: player.positionGroup,
      programName: active?.name ?? null,
      // No live block means nothing is scheduled; the domain handles the divide.
      sessionsScheduled: active?.dayCount ?? 0,
    };
  });

  const sessions = await listSessionsWithLogs({ playerIds: scoped.map((player) => player.id) });
  const loggedSessions = sessions.map((row) => ({
    playerId: row.playerId,
    date: row.date,
    programDayId: row.programDayId,
  }));

  const rows = calculateAdherence({ players: adherencePlayers, loggedSessions, weekStart, weekEnd, today });

  return {
    weekStart,
    weekEnd,
    today,
    teams: [{ id: session.teamId, name: session.teamName }],
    rows: sortRows(rows, input.sort ?? 'risk'),
    summary: summarise(rows),
  };
}

/** Every order puts the players who need chasing first. */
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

/** Tallies the four headline stat tiles shown above the adherence table. */
function summarise(rows) {
  const trainedThisWeek = rows.filter((row) => row.sessionsLogged > 0).length;
  const notStarted = rows.filter((row) => row.status === 'not_started').length;
  const total = rows.reduce((sum, row) => sum + row.adherencePct, 0);

  return {
    playerCount: rows.length,
    trainedThisWeek,
    notStarted,
    averageAdherencePct: rows.length === 0 ? 0 : Math.round(total / rows.length),
  };
}
