import 'server-only';
import { many, one } from '@/lib/db/helpers';

/**
 * Reads behind the reporting screens: the adherence dashboard, a player's own
 * history, and the team leaderboard.
 *
 * Two rules shape everything here:
 *
 * 1. Attendance is derived from `logs`, never from a stored flag — so a session
 *    only counts once a log row exists against it.
 * 2. This is a direct SQL connection rather than a REST API, so unlike the
 *    Supabase original there is no 1000-row response cap and no need to chunk
 *    `IN (...)` lists — `= ANY($1::uuid[])` and a plain `GROUP BY` do the whole
 *    job in one round trip each.
 */

/** One team by id, or null. */
export async function getTeam(teamId) {
  return one('select * from teams where id = $1', [teamId]);
}

/** Everyone on the team who actually trains, in name order. */
export async function listReportingPlayers(teamId) {
  const rows = await many(
    `select id, name, team_id, position_group, leaderboard_opt_in
       from players
      where team_id = $1 and is_player = true
      order by name`,
    [teamId],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    teamId: row.team_id,
    positionGroup: row.position_group,
    leaderboardOptIn: row.leaderboard_opt_in,
  }));
}

/** Every block belonging to a team, with its day count folded in. */
export async function listTeamProgramsWithDayCounts(teamId) {
  const rows = await many(
    `select p.id, p.team_id, p.position_group, p.name, p.start_date, p.end_date,
            p.is_active_override, count(pd.id)::int as day_count
       from programs p
       left join program_days pd on pd.program_id = p.id
      where p.team_id = $1
      group by p.id
      order by p.start_date desc`,
    [teamId],
  );
  return rows.map((row) => ({
    id: row.id,
    teamId: row.team_id,
    positionGroup: row.position_group,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActiveOverride: row.is_active_override,
    dayCount: row.day_count,
  }));
}

/** Program days by id, projected to just the fields the history/adherence screens need. */
export async function listProgramDaysByIds(dayIds) {
  if (dayIds.length === 0) return [];
  const rows = await many(
    'select id, program_id, day_number, label from program_days where id = any($1::uuid[])',
    [dayIds],
  );
  return rows.map(toProgramDay);
}

/** Maps a raw program_days row to the camelCase shape reporting callers expect. */
function toProgramDay(row) {
  return { id: row.id, programId: row.program_id, dayNumber: row.day_number, label: row.label };
}

/** Program id/name/team lookups, used to label a session's history entry. */
export async function listProgramNamesByIds(programIds) {
  if (programIds.length === 0) return [];
  const rows = await many('select id, name, team_id from programs where id = any($1::uuid[])', [
    programIds,
  ]);
  return rows.map((row) => ({ id: row.id, name: row.name, teamId: row.team_id }));
}

/**
 * Sessions that carry at least one log row — i.e. the player actually trained.
 * `from`/`to` narrow to a week (the leaderboard); `limit` caps how many rows
 * come back, newest first (a player's own history window).
 */
export async function listSessionsWithLogs({ playerIds, from, to, limit }) {
  if (playerIds.length === 0) return [];

  const params = [playerIds];
  const clauses = ['s.player_id = any($1::uuid[])', 'exists (select 1 from logs l where l.session_id = s.id)'];
  if (from) {
    params.push(from);
    clauses.push(`s.date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`s.date <= $${params.length}`);
  }

  let sql = `select s.id, s.player_id, s.program_day_id, s.date, s.completed_at
               from sessions s
              where ${clauses.join(' and ')}
              order by s.date desc, s.id desc`;
  if (limit) {
    params.push(limit);
    sql += ` limit $${params.length}`;
  }

  const rows = await many(sql, params);
  return rows.map((row) => ({
    id: row.id,
    playerId: row.player_id,
    programDayId: row.program_day_id,
    date: row.date,
    completedAt: row.completed_at,
  }));
}

/** Logged sets for a set of sessions, the fields the history/leaderboard volume maths needs. */
export async function listLogsForSessions(sessionIds) {
  if (sessionIds.length === 0) return [];
  const rows = await many(
    `select session_id, program_exercise_id, set_number, reps_done, weight_used
       from logs
      where session_id = any($1::uuid[])
      order by set_number`,
    [sessionIds],
  );
  return rows.map((row) => ({
    sessionId: row.session_id,
    programExerciseId: row.program_exercise_id,
    setNumber: row.set_number,
    repsDone: row.reps_done,
    weightUsed: row.weight_used,
  }));
}

/** Maps program_exercises ids to the library exercise id they point at. */
export async function listProgramExercisesByIds(ids) {
  if (ids.length === 0) return [];
  const rows = await many('select id, exercise_id from program_exercises where id = any($1::uuid[])', [
    ids,
  ]);
  return rows.map((row) => ({ id: row.id, exerciseId: row.exercise_id }));
}

/** Exercise id/name pairs, for labelling a chart or history row. */
export async function listExercisesByIds(ids) {
  if (ids.length === 0) return [];
  const rows = await many('select id, name from exercises where id = any($1::uuid[]) order by name', [
    ids,
  ]);
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

/* ------------------------------------------------------------------ writes */

/** Scoped by team as well as id, so a stale player id cannot reach another squad. */
export async function updatePlayerLeaderboardOptIn(teamId, playerId, optIn) {
  const row = await one(
    `update players set leaderboard_opt_in = $3
      where id = $1 and team_id = $2
      returning leaderboard_opt_in`,
    [playerId, teamId, optIn],
  );
  return row ? row.leaderboard_opt_in : null;
}

export async function updateTeamLeaderboardEnabled(teamId, enabled) {
  const row = await one(
    'update teams set leaderboard_enabled = $2 where id = $1 returning leaderboard_enabled',
    [teamId, enabled],
  );
  return row ? row.leaderboard_enabled : null;
}
