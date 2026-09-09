import 'server-only';
import { many, one, run, valuesList } from '@/lib/db/helpers';

/**
 * Reads and writes for the player training loop. Everything here takes ids
 * that the calling action has already scoped to a player and a team — this
 * module never decides who may see what.
 */

/* ------------------------------------------------------------------ programs */

/** Every block for one team + position group, newest first — used to resolve the live one. */
export async function listTeamPrograms(teamId, positionGroup) {
  return many(
    'select * from programs where team_id = $1 and position_group = $2 order by start_date desc',
    [teamId, positionGroup],
  );
}

/** Programs by id, unscoped — callers are expected to already know these ids are theirs. */
export async function listProgramsByIds(programIds) {
  if (programIds.length === 0) return [];
  return many('select * from programs where id = any($1::uuid[])', [programIds]);
}

/** A program's days, in day-number order. */
export async function listProgramDays(programId) {
  return many('select * from program_days where program_id = $1 order by day_number asc', [programId]);
}

/** Program days by id, unscoped. */
export async function listProgramDaysByIds(programDayIds) {
  if (programDayIds.length === 0) return [];
  return many('select * from program_days where id = any($1::uuid[])', [programDayIds]);
}

/**
 * Ownership lookup. Actions use this to prove a program day belongs to the
 * caller's team AND position group before reading or writing anything against it.
 *
 * @returns {Promise<Array<{programDayId, dayNumber, label, programId, programName, teamId, positionGroup, startDate, endDate}>>}
 */
export async function getProgramDayContexts(programDayIds) {
  const days = await listProgramDaysByIds(programDayIds);
  if (days.length === 0) return [];

  const programs = await listProgramsByIds([...new Set(days.map((day) => day.program_id))]);
  const byId = new Map(programs.map((program) => [program.id, program]));

  const contexts = [];
  for (const day of days) {
    const program = byId.get(day.program_id);
    if (!program) continue;
    contexts.push({
      programDayId: day.id,
      dayNumber: day.day_number,
      label: day.label,
      programId: program.id,
      programName: program.name,
      teamId: program.team_id,
      positionGroup: program.position_group,
      startDate: program.start_date,
      endDate: program.end_date,
    });
  }
  return contexts;
}

/* --------------------------------------------------------- program exercises */

/** Every exercise scheduled across a set of days, in display order. */
export async function listProgramExercisesForDays(programDayIds) {
  if (programDayIds.length === 0) return [];
  return many(
    'select * from program_exercises where program_day_id = any($1::uuid[]) order by "order" asc',
    [programDayIds],
  );
}

/** One program_exercises row by id, or null. */
export async function findProgramExerciseById(id) {
  return one('select * from program_exercises where id = $1', [id]);
}

/** Library rows (exercises) by id, unscoped — the library is global. */
export async function listExercisesByIds(exerciseIds) {
  if (exerciseIds.length === 0) return [];
  return many('select * from exercises where id = any($1::uuid[])', [exerciseIds]);
}

/* ------------------------------------------------------------------ sessions */

/** Looks up a session by id AND player_id together — proof of ownership, not just a lookup. */
export async function findPlayerSession(playerId, sessionId) {
  return one('select * from sessions where id = $1 and player_id = $2', [sessionId, playerId]);
}

/** A player's sessions for a set of program days within a date range (used to build the week view). */
export async function listPlayerSessionsForDays(playerId, programDayIds, from, to) {
  if (programDayIds.length === 0) return [];
  return many(
    `select * from sessions
      where player_id = $1 and program_day_id = any($2::uuid[]) and date >= $3 and date <= $4
      order by date desc`,
    [playerId, programDayIds, from, to],
  );
}

/** Every session this player has ever run for one program day, newest first. */
export async function listPlayerSessionsForDay(playerId, programDayId, limit = 12) {
  return many(
    `select * from sessions
      where player_id = $1 and program_day_id = $2
      order by date desc
      limit $3`,
    [playerId, programDayId, limit],
  );
}

/**
 * Idempotent by construction: the natural key (player, program day, date) is a
 * real unique constraint, so replaying an offline queue updates instead of
 * duplicating. `completed_at` is absent from the payload and so is never reset.
 * `rows` are `{ player_id, program_day_id, date }` objects; returns the
 * resulting session rows (existing or newly-created) in one round trip.
 */
export async function upsertSessions(rows) {
  if (rows.length === 0) return [];
  const { sql, params } = valuesList(rows.map((row) => [row.player_id, row.program_day_id, row.date]));
  return many(
    `insert into sessions (player_id, program_day_id, date)
     values ${sql}
     on conflict (player_id, program_day_id, date)
     do update set player_id = excluded.player_id
     returning *`,
    params,
  );
}

/** Sets a session's completed_at timestamp. Scoped to (id, player_id) so it can't touch someone else's session. */
export async function markSessionCompleted(playerId, sessionId, completedAt) {
  return one(
    'update sessions set completed_at = $3 where id = $1 and player_id = $2 returning *',
    [sessionId, playerId, completedAt],
  );
}

/* ---------------------------------------------------------------------- logs */

/** Every logged set for a set of sessions, in set-number order. */
export async function listLogsForSessions(sessionIds) {
  if (sessionIds.length === 0) return [];
  return many('select * from logs where session_id = any($1::uuid[]) order by set_number asc', [
    sessionIds,
  ]);
}

/** How many sets sit against each session — the "did they actually train" signal. */
export async function countLogsForSessions(sessionIds) {
  if (sessionIds.length === 0) return {};
  const rows = await many('select session_id from logs where session_id = any($1::uuid[])', [sessionIds]);
  const counts = {};
  for (const row of rows) counts[row.session_id] = (counts[row.session_id] ?? 0) + 1;
  return counts;
}

/**
 * Upsert on (session, exercise, set) — the other half of safe offline replay.
 * `rows` are already-snake_case objects matching the logs columns; on a
 * conflict, every field except the key is overwritten with the new values
 * (so re-logging a set edits it in place rather than duplicating it).
 */
export async function upsertLogs(rows) {
  if (rows.length === 0) return;
  const { sql, params } = valuesList(
    rows.map((row) => [
      row.session_id,
      row.program_exercise_id,
      row.set_number,
      row.reps_done,
      row.weight_used,
      row.distance_or_time,
      row.logged_at,
    ]),
  );
  await run(
    `insert into logs
       (session_id, program_exercise_id, set_number, reps_done, weight_used, distance_or_time, logged_at)
     values ${sql}
     on conflict (session_id, program_exercise_id, set_number)
     do update set
       reps_done = excluded.reps_done,
       weight_used = excluded.weight_used,
       distance_or_time = excluded.distance_or_time,
       logged_at = excluded.logged_at`,
    params,
  );
}
