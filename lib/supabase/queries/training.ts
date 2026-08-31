import 'server-only';
import { db } from '@/lib/supabase/client';
import type {
  ExerciseRow,
  LogRow,
  PositionGroup,
  ProgramDayRow,
  ProgramExerciseRow,
  ProgramRow,
  SessionRow,
} from '@/types/database';
import { DataError, unwrap, unwrapMaybe } from './index';

/**
 * Raw reads and writes for the player training loop. Everything here takes ids
 * that the calling action has already scoped to a player and a team — this
 * module never decides who may see what.
 *
 * No embedded selects: types/database.ts declares empty `Relationships`, so a
 * PostgREST join would not type-check. Two flat queries beat a clever one.
 */

/* ------------------------------------------------------------------ programs */

export async function listTeamPrograms(
  teamId: string,
  positionGroup: PositionGroup,
): Promise<ProgramRow[]> {
  return unwrap(
    await db()
      .from('programs')
      .select('*')
      .eq('team_id', teamId)
      .eq('position_group', positionGroup)
      .order('start_date', { ascending: false }),
    'listTeamPrograms',
  );
}

export async function listProgramsByIds(programIds: string[]): Promise<ProgramRow[]> {
  if (programIds.length === 0) return [];
  return unwrap(await db().from('programs').select('*').in('id', programIds), 'listProgramsByIds');
}

export async function listProgramDays(programId: string): Promise<ProgramDayRow[]> {
  const rows = unwrap(
    await db().from('program_days').select('*').eq('program_id', programId),
    'listProgramDays',
  );
  return [...rows].sort((a, b) => a.day_number - b.day_number);
}

export async function listProgramDaysByIds(programDayIds: string[]): Promise<ProgramDayRow[]> {
  if (programDayIds.length === 0) return [];
  return unwrap(
    await db().from('program_days').select('*').in('id', programDayIds),
    'listProgramDaysByIds',
  );
}

/** A program day plus the block it hangs off — enough to check team + position. */
export interface ProgramDayContext {
  programDayId: string;
  dayNumber: number;
  label: string | null;
  programId: string;
  programName: string;
  teamId: string;
  positionGroup: PositionGroup;
  startDate: string;
  endDate: string;
}

/**
 * Ownership lookup. Actions use this to prove a program day belongs to the
 * caller's team AND position group before reading or writing anything against it.
 */
export async function getProgramDayContexts(programDayIds: string[]): Promise<ProgramDayContext[]> {
  const days = await listProgramDaysByIds(programDayIds);
  if (days.length === 0) return [];

  const programs = await listProgramsByIds([...new Set(days.map((day) => day.program_id))]);
  const byId = new Map(programs.map((program) => [program.id, program]));

  const contexts: ProgramDayContext[] = [];
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

export async function listProgramExercisesForDays(
  programDayIds: string[],
): Promise<ProgramExerciseRow[]> {
  if (programDayIds.length === 0) return [];
  const rows = unwrap(
    await db().from('program_exercises').select('*').in('program_day_id', programDayIds),
    'listProgramExercisesForDays',
  );
  return [...rows].sort((a, b) => a.order - b.order);
}

export async function findProgramExerciseById(id: string): Promise<ProgramExerciseRow | null> {
  return unwrapMaybe(
    await db().from('program_exercises').select('*').eq('id', id).maybeSingle(),
    'findProgramExerciseById',
  );
}

export async function listExercisesByIds(exerciseIds: string[]): Promise<ExerciseRow[]> {
  if (exerciseIds.length === 0) return [];
  return unwrap(
    await db().from('exercises').select('*').in('id', exerciseIds),
    'listExercisesByIds',
  );
}

/* ------------------------------------------------------------------ sessions */

export async function findPlayerSession(
  playerId: string,
  sessionId: string,
): Promise<SessionRow | null> {
  return unwrapMaybe(
    await db()
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('player_id', playerId)
      .maybeSingle(),
    'findPlayerSession',
  );
}

export async function listPlayerSessionsForDays(
  playerId: string,
  programDayIds: string[],
  from: string,
  to: string,
): Promise<SessionRow[]> {
  if (programDayIds.length === 0) return [];
  return unwrap(
    await db()
      .from('sessions')
      .select('*')
      .eq('player_id', playerId)
      .in('program_day_id', programDayIds)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false }),
    'listPlayerSessionsForDays',
  );
}

/** Every session this player has ever run for one program day, newest first. */
export async function listPlayerSessionsForDay(
  playerId: string,
  programDayId: string,
  limit = 12,
): Promise<SessionRow[]> {
  return unwrap(
    await db()
      .from('sessions')
      .select('*')
      .eq('player_id', playerId)
      .eq('program_day_id', programDayId)
      .order('date', { ascending: false })
      .limit(limit),
    'listPlayerSessionsForDay',
  );
}

export interface SessionUpsert {
  player_id: string;
  program_day_id: string;
  date: string;
}

/**
 * Idempotent by construction: the natural key (player, program day, date) is a
 * real unique constraint, so replaying an offline queue updates instead of
 * duplicating. `completed_at` is absent from the payload and so is never reset.
 */
export async function upsertSessions(rows: SessionUpsert[]): Promise<SessionRow[]> {
  if (rows.length === 0) return [];
  return unwrap(
    await db()
      .from('sessions')
      .upsert(rows, { onConflict: 'player_id,program_day_id,date' })
      .select('*'),
    'upsertSessions',
  );
}

export async function markSessionCompleted(
  playerId: string,
  sessionId: string,
  completedAt: string,
): Promise<SessionRow | null> {
  return unwrapMaybe(
    await db()
      .from('sessions')
      .update({ completed_at: completedAt })
      .eq('id', sessionId)
      .eq('player_id', playerId)
      .select('*')
      .maybeSingle(),
    'markSessionCompleted',
  );
}

/* ---------------------------------------------------------------------- logs */

export async function listLogsForSessions(sessionIds: string[]): Promise<LogRow[]> {
  if (sessionIds.length === 0) return [];
  const rows = unwrap(
    await db().from('logs').select('*').in('session_id', sessionIds),
    'listLogsForSessions',
  );
  return [...rows].sort((a, b) => a.set_number - b.set_number);
}

/** How many sets sit against each session — the "did they actually train" signal. */
export async function countLogsForSessions(sessionIds: string[]): Promise<Record<string, number>> {
  if (sessionIds.length === 0) return {};
  const rows = unwrap(
    await db().from('logs').select('session_id').in('session_id', sessionIds),
    'countLogsForSessions',
  );
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.session_id] = (counts[row.session_id] ?? 0) + 1;
  return counts;
}

export interface LogUpsert {
  session_id: string;
  program_exercise_id: string;
  set_number: number;
  reps_done: number | null;
  weight_used: number | null;
  distance_or_time: string | null;
  logged_at: string;
}

/** Upsert on (session, exercise, set) — the other half of safe offline replay. */
export async function upsertLogs(rows: LogUpsert[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await db()
    .from('logs')
    .upsert(rows, { onConflict: 'session_id,program_exercise_id,set_number' });
  if (error) throw new DataError(`upsertLogs: ${error.message}`, error);
}
