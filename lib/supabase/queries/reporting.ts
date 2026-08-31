import 'server-only';
import type { PostgrestError } from '@supabase/supabase-js';
import { db } from '@/lib/supabase/client';
import type { ISODate } from '@/types/common';
import type { PositionGroup, TeamRow } from '@/types/database';
import { DataError, unwrapMaybe } from './index';

/**
 * Reads behind the reporting screens: the adherence dashboard, a player's own
 * history, and the team leaderboard.
 *
 * Two rules shape everything here:
 *
 * 1. Attendance is derived from `logs`, never from a stored flag — so a session
 *    only counts once a log row exists against it.
 * 2. ~40 players, so these fetch a handful of wide-ish result sets and let the
 *    action join them in memory. No per-player queries.
 */

/** Supabase caps a single response (1000 rows by default), so reads page. */
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;
/** Keeps `in.(…)` filters inside a sane URL length. */
const ID_CHUNK = 80;

type PagedResponse = { data: unknown; error: PostgrestError | null };

async function fetchPagedRaw<T>(
  context: string,
  page: (from: number, to: number) => PromiseLike<unknown>,
  max = Number.MAX_SAFE_INTEGER,
): Promise<T[]> {
  const rows: T[] = [];

  for (let index = 0; index < MAX_PAGES; index += 1) {
    const offset = index * PAGE_SIZE;
    if (offset >= max) break;
    const size = Math.min(PAGE_SIZE, max - offset);

    const result = (await page(offset, offset + size - 1)) as PagedResponse;
    if (result.error) throw new DataError(`${context}: ${result.error.message}`, result.error);

    const batch = (result.data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < size) break;
  }

  return rows;
}

/** Typed wrapper: keeps column-name checking on ordinary selects. */
function fetchPaged<T>(
  context: string,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  max?: number,
): Promise<T[]> {
  return fetchPagedRaw<T>(context, page, max);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

/* ------------------------------------------------------------------ shapes */

export interface ReportingPlayer {
  id: string;
  name: string;
  teamId: string;
  positionGroup: PositionGroup | null;
  leaderboardOptIn: boolean;
}

/** Shaped for `resolveActiveProgram` (ProgramLike) plus what the UI needs. */
export interface ReportingProgram {
  id: string;
  teamId: string;
  positionGroup: PositionGroup;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  isActiveOverride: boolean | null;
  /** Program days in the block — the "scheduled sessions" number. */
  dayCount: number;
}

export interface ReportingSession {
  id: string;
  playerId: string;
  programDayId: string;
  date: ISODate;
  completedAt: string | null;
}

export interface ReportingLog {
  sessionId: string;
  programExerciseId: string;
  setNumber: number;
  repsDone: number | null;
  weightUsed: number | null;
}

export interface ReportingProgramDay {
  id: string;
  programId: string;
  dayNumber: number;
  label: string | null;
}

export interface ReportingProgramExercise {
  id: string;
  exerciseId: string;
}

export interface ReportingExercise {
  id: string;
  name: string;
}

/* ------------------------------------------------------------------- reads */

export async function getTeam(teamId: string): Promise<TeamRow | null> {
  return unwrapMaybe(await db().from('teams').select('*').eq('id', teamId).maybeSingle(), 'getTeam');
}

/** Everyone on the team who actually trains, in name order. */
export async function listReportingPlayers(teamId: string): Promise<ReportingPlayer[]> {
  const rows = await fetchPaged('listReportingPlayers', (from, to) =>
    db()
      .from('players')
      .select('id, name, team_id, position_group, leaderboard_opt_in')
      .eq('team_id', teamId)
      .eq('is_player', true)
      .order('name')
      .range(from, to),
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
export async function listTeamProgramsWithDayCounts(teamId: string): Promise<ReportingProgram[]> {
  const programs = await fetchPaged('listTeamProgramsWithDayCounts', (from, to) =>
    db()
      .from('programs')
      .select('id, team_id, position_group, name, start_date, end_date, is_active_override')
      .eq('team_id', teamId)
      .order('start_date', { ascending: false })
      .range(from, to),
  );

  if (programs.length === 0) return [];

  const days = await listProgramDaysForPrograms(programs.map((program) => program.id));
  const counts = new Map<string, number>();
  for (const day of days) counts.set(day.programId, (counts.get(day.programId) ?? 0) + 1);

  return programs.map((program) => ({
    id: program.id,
    teamId: program.team_id,
    positionGroup: program.position_group,
    name: program.name,
    startDate: program.start_date,
    endDate: program.end_date,
    isActiveOverride: program.is_active_override,
    dayCount: counts.get(program.id) ?? 0,
  }));
}

export async function listProgramDaysForPrograms(programIds: string[]): Promise<ReportingProgramDay[]> {
  if (programIds.length === 0) return [];

  const rows: Array<{ id: string; program_id: string; day_number: number; label: string | null }> = [];
  for (const ids of chunk(programIds, ID_CHUNK)) {
    const batch = await fetchPaged('listProgramDaysForPrograms', (from, to) =>
      db()
        .from('program_days')
        .select('id, program_id, day_number, label')
        .in('program_id', ids)
        .order('day_number')
        .range(from, to),
    );
    rows.push(...batch);
  }

  return rows.map(toProgramDay);
}

export async function listProgramDaysByIds(dayIds: string[]): Promise<ReportingProgramDay[]> {
  if (dayIds.length === 0) return [];

  const rows: Array<{ id: string; program_id: string; day_number: number; label: string | null }> = [];
  for (const ids of chunk(dayIds, ID_CHUNK)) {
    const batch = await fetchPaged('listProgramDaysByIds', (from, to) =>
      db().from('program_days').select('id, program_id, day_number, label').in('id', ids).range(from, to),
    );
    rows.push(...batch);
  }

  return rows.map(toProgramDay);
}

function toProgramDay(row: {
  id: string;
  program_id: string;
  day_number: number;
  label: string | null;
}): ReportingProgramDay {
  return { id: row.id, programId: row.program_id, dayNumber: row.day_number, label: row.label };
}

export async function listProgramNamesByIds(
  programIds: string[],
): Promise<Array<{ id: string; name: string; teamId: string }>> {
  if (programIds.length === 0) return [];

  const rows: Array<{ id: string; name: string; team_id: string }> = [];
  for (const ids of chunk(programIds, ID_CHUNK)) {
    const batch = await fetchPaged('listProgramNamesByIds', (from, to) =>
      db().from('programs').select('id, name, team_id').in('id', ids).range(from, to),
    );
    rows.push(...batch);
  }

  return rows.map((row) => ({ id: row.id, name: row.name, teamId: row.team_id }));
}

/**
 * Sessions that carry at least one log row — i.e. the player actually trained.
 *
 * `logs!inner(id)` makes PostgREST inner-join the logs table, so sessions with
 * no sets never come back, and the embedded limit keeps the payload to one id
 * per session instead of every set. `Row` below names the columns the paging
 * helper hands back; it is the contract this function reads against.
 */
export async function listSessionsWithLogs(input: {
  playerIds: string[];
  from?: ISODate;
  to?: ISODate;
  /** Newest N sessions per player chunk. Omit to walk the whole history. */
  limit?: number;
}): Promise<ReportingSession[]> {
  if (input.playerIds.length === 0) return [];

  type Row = {
    id: string;
    player_id: string;
    program_day_id: string;
    date: string;
    completed_at: string | null;
  };

  const rows: Row[] = [];
  for (const ids of chunk(input.playerIds, ID_CHUNK)) {
    const batch = await fetchPagedRaw<Row>(
      'listSessionsWithLogs',
      (from, to) => {
        let query = db()
          .from('sessions')
          .select('id, player_id, program_day_id, date, completed_at, logs!inner(id)')
          .in('player_id', ids);
        if (input.from) query = query.gte('date', input.from);
        if (input.to) query = query.lte('date', input.to);
        return query
          .order('date', { ascending: false })
          .order('id', { ascending: false })
          .limit(1, { referencedTable: 'logs' })
          .range(from, to);
      },
      input.limit,
    );
    rows.push(...batch);
  }

  const sessions = rows.map((row) => ({
    id: row.id,
    playerId: row.player_id,
    programDayId: row.program_day_id,
    date: row.date,
    completedAt: row.completed_at,
  }));

  // Chunked reads come back per chunk; re-sort so callers can rely on newest first.
  sessions.sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
  return sessions;
}

export async function listLogsForSessions(sessionIds: string[]): Promise<ReportingLog[]> {
  if (sessionIds.length === 0) return [];

  const rows: Array<{
    session_id: string;
    program_exercise_id: string;
    set_number: number;
    reps_done: number | null;
    weight_used: number | null;
  }> = [];

  for (const ids of chunk(sessionIds, ID_CHUNK)) {
    const batch = await fetchPaged('listLogsForSessions', (from, to) =>
      db()
        .from('logs')
        .select('session_id, program_exercise_id, set_number, reps_done, weight_used')
        .in('session_id', ids)
        .order('set_number')
        .range(from, to),
    );
    rows.push(...batch);
  }

  return rows.map((row) => ({
    sessionId: row.session_id,
    programExerciseId: row.program_exercise_id,
    setNumber: row.set_number,
    repsDone: row.reps_done,
    weightUsed: row.weight_used === null ? null : Number(row.weight_used),
  }));
}

export async function listProgramExercisesByIds(ids: string[]): Promise<ReportingProgramExercise[]> {
  if (ids.length === 0) return [];

  const rows: Array<{ id: string; exercise_id: string }> = [];
  for (const batchIds of chunk(ids, ID_CHUNK)) {
    const batch = await fetchPaged('listProgramExercisesByIds', (from, to) =>
      db().from('program_exercises').select('id, exercise_id').in('id', batchIds).range(from, to),
    );
    rows.push(...batch);
  }

  return rows.map((row) => ({ id: row.id, exerciseId: row.exercise_id }));
}

export async function listExercisesByIds(ids: string[]): Promise<ReportingExercise[]> {
  if (ids.length === 0) return [];

  const rows: Array<{ id: string; name: string }> = [];
  for (const batchIds of chunk(ids, ID_CHUNK)) {
    const batch = await fetchPaged('listExercisesByIds', (from, to) =>
      db().from('exercises').select('id, name').in('id', batchIds).order('name').range(from, to),
    );
    rows.push(...batch);
  }

  return rows.map((row) => ({ id: row.id, name: row.name }));
}

/* ------------------------------------------------------------------ writes */

/** Scoped by team as well as id, so a stale player id cannot reach another squad. */
export async function updatePlayerLeaderboardOptIn(
  teamId: string,
  playerId: string,
  optIn: boolean,
): Promise<boolean | null> {
  const row = unwrapMaybe(
    await db()
      .from('players')
      .update({ leaderboard_opt_in: optIn })
      .eq('id', playerId)
      .eq('team_id', teamId)
      .select('leaderboard_opt_in')
      .maybeSingle(),
    'updatePlayerLeaderboardOptIn',
  );
  return row ? row.leaderboard_opt_in : null;
}

export async function updateTeamLeaderboardEnabled(
  teamId: string,
  enabled: boolean,
): Promise<boolean | null> {
  const row = unwrapMaybe(
    await db()
      .from('teams')
      .update({ leaderboard_enabled: enabled })
      .eq('id', teamId)
      .select('leaderboard_enabled')
      .maybeSingle(),
    'updateTeamLeaderboardEnabled',
  );
  return row ? row.leaderboard_enabled : null;
}
