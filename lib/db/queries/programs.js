import 'server-only';
import { many, one, run, valuesList } from '@/lib/db/helpers';

/**
 * Access for training blocks (programs -> program_days -> program_exercises).
 * Every read and write that touches `programs` takes a teamId and puts it in
 * the filter: ownership is proven by the WHERE clause, never by trusting an id
 * that arrived from the client.
 */

/* --------------------------------------------------------------------- reads */

/** Every block belonging to a team, newest start date first. */
export async function listProgramsForTeam(teamId) {
  return many(
    'select * from programs where team_id = $1 order by start_date desc, name asc',
    [teamId],
  );
}

/** One block, scoped to a team — returns null if it doesn't exist or belongs to another team. */
export async function findProgramForTeam(teamId, programId) {
  return one('select * from programs where team_id = $1 and id = $2', [teamId, programId]);
}

/** All program_days rows for a set of programs, ordered by day number. */
export async function listDaysForPrograms(programIds) {
  if (programIds.length === 0) return [];
  return many(
    'select * from program_days where program_id = any($1::uuid[]) order by day_number asc',
    [programIds],
  );
}

/** All program_exercises rows for a set of days, in their intended display order. */
export async function listProgramExercisesForDays(dayIds) {
  if (dayIds.length === 0) return [];
  return many(
    'select * from program_exercises where program_day_id = any($1::uuid[]) order by "order" asc',
    [dayIds],
  );
}

/** Just the owning day of each row — enough to count exercises per block on the list screen. */
export async function listProgramExerciseDayIds(dayIds) {
  if (dayIds.length === 0) return [];
  return many('select program_day_id from program_exercises where program_day_id = any($1::uuid[])', [
    dayIds,
  ]);
}

/**
 * `exercises` is global — no team_id by design — so this is deliberately
 * unscoped. Fetches the library rows referenced by a program's exercises.
 */
export async function listExercisesByIds(exerciseIds) {
  if (exerciseIds.length === 0) return [];
  return many('select * from exercises where id = any($1::uuid[])', [exerciseIds]);
}

/* -------------------------------------------------------------------- writes */

/** Creates a new training block for a team. */
export async function insertProgram(teamId, fields) {
  return one(
    `insert into programs (team_id, position_group, name, start_date, end_date, is_active_override)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [teamId, fields.positionGroup, fields.name, fields.startDate, fields.endDate, fields.isActiveOverride],
  );
}

/** Returns null when the block does not exist or belongs to another team. */
export async function updateProgramForTeam(teamId, programId, fields) {
  return one(
    `update programs
        set position_group = $3, name = $4, start_date = $5, end_date = $6, is_active_override = $7
      where team_id = $1 and id = $2
      returning *`,
    [teamId, programId, fields.positionGroup, fields.name, fields.startDate, fields.endDate, fields.isActiveOverride],
  );
}

/** Cascades to program_days, program_exercises, sessions and logs. Returns null if not owned. */
export async function deleteProgramForTeam(teamId, programId) {
  const row = await one('delete from programs where team_id = $1 and id = $2 returning id', [
    teamId,
    programId,
  ]);
  return row?.id ?? null;
}

/** Adds one new day (1-4) to a block, with an optional label. */
export async function insertProgramDay(programId, dayNumber, label) {
  return one(
    'insert into program_days (program_id, day_number, label) values ($1, $2, $3) returning *',
    [programId, dayNumber, label],
  );
}

/** Renames (or clears) one day's label without touching its exercises. */
export async function updateProgramDayLabel(dayId, label) {
  await run('update program_days set label = $2 where id = $1', [dayId, label]);
}

/** Removing a day cascades its exercises and any sessions logged against it. */
export async function deleteProgramDays(dayIds) {
  if (dayIds.length === 0) return;
  await run('delete from program_days where id = any($1::uuid[])', [dayIds]);
}

/** Clears every exercise from one day, ready to be replaced by insertProgramExercises. */
export async function deleteProgramExercisesForDay(dayId) {
  await run('delete from program_exercises where program_day_id = $1', [dayId]);
}

/**
 * Bulk-inserts a day's full exercise list in one statement (see
 * lib/db/helpers.js's valuesList for how the multi-row INSERT is built).
 * `rows` are already-snake_case objects matching the program_exercises columns.
 */
export async function insertProgramExercises(rows) {
  if (rows.length === 0) return;
  const { sql, params } = valuesList(
    rows.map((row) => [
      row.program_day_id,
      row.exercise_id,
      row.order,
      row.target_sets,
      row.target_reps,
      row.rest_seconds,
      row.notes,
    ]),
  );
  await run(
    `insert into program_exercises
       (program_day_id, exercise_id, "order", target_sets, target_reps, rest_seconds, notes)
     values ${sql}`,
    params,
  );
}
