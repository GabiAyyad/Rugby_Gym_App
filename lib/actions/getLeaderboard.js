import 'server-only';
import { endOfWeek, startOfWeek, todayISO } from '@/lib/domain/week';
import { findPlayerInTeam } from '@/lib/db/queries/auth';
import { getTeam, listLogsForSessions, listReportingPlayers, listSessionsWithLogs } from '@/lib/db/queries/reporting';

/**
 * This week's squad leaderboard — team-scoped, never cross-team.
 *
 * Two gates, both required: the admin's team switch (`teams.leaderboard_enabled`)
 * and the viewer's own opt-in (`players.leaderboard_opt_in`). If either is off
 * the entries come back empty, so a player who has not opted in cannot see
 * anybody else's numbers by reading the response.
 */
export async function getLeaderboard(session, input = {}) {
  const today = input.date ?? todayISO();
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);

  const [team, me] = await Promise.all([getTeam(session.teamId), findPlayerInTeam(session.teamId, session.playerId)]);

  const teamEnabled = team?.leaderboard_enabled ?? false;
  const optedIn = me?.leaderboard_opt_in ?? false;

  if (input.settingsOnly || !teamEnabled || !optedIn) {
    return { teamEnabled, optedIn, weekStart, weekEnd, entries: [] };
  }

  const players = (await listReportingPlayers(session.teamId)).filter((player) => player.leaderboardOptIn);
  if (players.length === 0) {
    return { teamEnabled, optedIn, weekStart, weekEnd, entries: [] };
  }

  const sessions = await listSessionsWithLogs({
    playerIds: players.map((player) => player.id),
    from: weekStart,
    to: weekEnd,
  });
  const logs = await listLogsForSessions(sessions.map((row) => row.id));

  const volumeBySession = new Map();
  for (const log of logs) {
    const volume = (log.weightUsed ?? 0) * (log.repsDone ?? 0);
    volumeBySession.set(log.sessionId, (volumeBySession.get(log.sessionId) ?? 0) + volume);
  }

  // Same rule as adherence: repeats of one program day inside a week count once.
  const daysByPlayer = new Map();
  const volumeByPlayer = new Map();
  for (const row of sessions) {
    const days = daysByPlayer.get(row.playerId) ?? new Set();
    days.add(row.programDayId);
    daysByPlayer.set(row.playerId, days);
    volumeByPlayer.set(row.playerId, (volumeByPlayer.get(row.playerId) ?? 0) + (volumeBySession.get(row.id) ?? 0));
  }

  const ranked = players
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      positionGroup: player.positionGroup,
      sessionsLogged: daysByPlayer.get(player.id)?.size ?? 0,
      totalVolumeKg: Math.round(volumeByPlayer.get(player.id) ?? 0),
      isMe: player.id === session.playerId,
    }))
    .sort((a, b) => b.sessionsLogged - a.sessionsLogged || b.totalVolumeKg - a.totalVolumeKg || a.playerName.localeCompare(b.playerName));

  // Identical weeks share a rank; the next player still drops to their position.
  const entries = [];
  let currentRank = 0;
  ranked.forEach((entry, index) => {
    const previous = index > 0 ? ranked[index - 1] : null;
    const tied = previous !== null && previous.sessionsLogged === entry.sessionsLogged && previous.totalVolumeKg === entry.totalVolumeKg;
    currentRank = tied ? currentRank : index + 1;
    entries.push({ ...entry, rank: currentRank });
  });

  return { teamEnabled, optedIn, weekStart, weekEnd, entries };
}
