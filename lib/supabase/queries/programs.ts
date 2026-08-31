import 'server-only';
import type { PostgrestError } from '@supabase/supabase-js';
import { db } from '@/lib/supabase/client';
import type {
  ExerciseRow,
  PositionGroup,
  ProgramDayRow,
  ProgramExerciseRow,
  ProgramRow,
} from '@/types/database';
import { DataError, unwrap, unwrapMaybe } from './index';

/**
 * Raw Supabase access for training blocks (programs -> program_days ->
 * program_exercises). Every read and write that touches `programs` takes a
 * teamId and puts it in the filter: ownership is proven by the WHERE clause,
 * never by trusting an id that arrived from the client.
 *
 * `order` is a reserved word in SQL and is quoted in the migration; in
 * supabase-js it is just a property name, and `.order('order')` sorts by it.
 */

/** Turn a bare supabase-js result into a thrown DataError. Used for writes with no rows back. */
function assertOk(result: { error: PostgrestError | null }, context: string): void {
  if (result.error) throw new DataError(`${context}: ${result.error.message}`, result.error);
}

/* --------------------------------------------------------------------- reads */

export async function listProgramsForTeam(teamId: string): Promise<ProgramRow[]> {
  return unwrap(
    await db()
      .from('programs')
      .select('*')
      .eq('team_id', teamId)
      .order('start_date', { ascending: false })
      .order('name', { ascending: true }),
    'listProgramsForTeam',
  );
}

export async function findProgramForTeam(teamId: string, programId: string): Promise<ProgramRow | null> {
  return unwrapMaybe(
    await db().from('programs').select('*').eq('team_id', teamId).eq('id', programId).maybeSingle(),
    'findProgramForTeam',
  );
}

export async function listDaysForPrograms(programIds: string[]): Promise<ProgramDayRow[]> {
  if (programIds.length === 0) return [];
  return unwrap(
    await db()
      .from('program_days')
      .select('*')
      .in('program_id', programIds)
      .order('day_number', { ascending: true }),
    'listDaysForPrograms',
  );
}

export async function listProgramExercisesForDays(dayIds: string[]): Promise<ProgramExerciseRow[]> {
  if (dayIds.length === 0) return [];
  return unwrap(
    await db()
      .from('program_exercises')
      .select('*')
      .in('program_day_id', dayIds)
      .order('order', { ascending: true }),
    'listProgramExercisesForDays',
  );
}

/** Just the owning day of each row — enough to count exercises per block on the list screen. */
export async function listProgramExerciseDayIds(dayIds: string[]): Promise<{ program_day_id: string }[]> {
  if (dayIds.length === 0) return [];
  return unwrap(
    await db().from('program_exercises').select('program_day_id').in('program_day_id', dayIds),
    'listProgramExerciseDayIds',
  );
}

/**
 * `exercises` is global — no team_id by design — so this is deliberately
 * unscoped. Fetched by id in one round trip rather than embedded, so the
 * library is read once per save instead of once per program exercise row.
 */
export async function listExercisesByIds(exerciseIds: string[]): Promise<ExerciseRow[]> {
  if (exerciseIds.length === 0) return [];
  return unwrap(
    await db().from('exercises').select('*').in('id', exerciseIds),
    'listExercisesByIds',
  );
}

/* -------------------------------------------------------------------- writes */

export interface ProgramWriteFields {
  positionGroup: PositionGroup;
  name: string;
  startDate: string;
  endDate: string;
  isActiveOverride: boolean | null;
}

export async function insertProgram(teamId: string, fields: ProgramWriteFields): Promise<ProgramRow> {
  return unwrap(
    await db()
      .from('programs')
      .insert({
        team_id: teamId,
        position_group: fields.positionGroup,
        name: fields.name,
        start_date: fields.startDate,
        end_date: fields.endDate,
        is_active_override: fields.isActiveOverride,
      })
      .select('*')
      .single(),
    'insertProgram',
  );
}

/** Returns null when the block does not exist or belongs to another team. */
export async function updateProgramForTeam(
  teamId: string,
  programId: string,
  fields: ProgramWriteFields,
): Promise<ProgramRow | null> {
  return unwrapMaybe(
    await db()
      .from('programs')
      .update({
        position_group: fields.positionGroup,
        name: fields.name,
        start_date: fields.startDate,
        end_date: fields.endDate,
        is_active_override: fields.isActiveOverride,
      })
      .eq('team_id', teamId)
      .eq('id', programId)
      .select('*')
      .maybeSingle(),
    'updateProgramForTeam',
  );
}

/** Cascades to program_days, program_exercises, sessions and logs. Returns null if not owned. */
export async function deleteProgramForTeam(teamId: string, programId: string): Promise<string | null> {
  const rows = unwrap(
    await db().from('programs').delete().eq('team_id', teamId).eq('id', programId).select('id'),
    'deleteProgramForTeam',
  );
  return rows[0]?.id ?? null;
}

export async function insertProgramDay(
  programId: string,
  dayNumber: number,
  label: string | null,
): Promise<ProgramDayRow> {
  return unwrap(
    await db()
      .from('program_days')
      .insert({ program_id: programId, day_number: dayNumber, label })
      .select('*')
      .single(),
    'insertProgramDay',
  );
}

export async function updateProgramDayLabel(dayId: string, label: string | null): Promise<void> {
  assertOk(await db().from('program_days').update({ label }).eq('id', dayId), 'updateProgramDayLabel');
}

/** Removing a day cascades its exercises and any sessions logged against it. */
export async function deleteProgramDays(dayIds: string[]): Promise<void> {
  if (dayIds.length === 0) return;
  assertOk(await db().from('program_days').delete().in('id', dayIds), 'deleteProgramDays');
}

export async function deleteProgramExercisesForDay(dayId: string): Promise<void> {
  assertOk(
    await db().from('program_exercises').delete().eq('program_day_id', dayId),
    'deleteProgramExercisesForDay',
  );
}

export interface ProgramExerciseWriteRow {
  program_day_id: string;
  exercise_id: string;
  order: number;
  target_sets: number;
  target_reps: string;
  rest_seconds: number;
  notes: string | null;
}

export async function insertProgramExercises(rows: ProgramExerciseWriteRow[]): Promise<void> {
  if (rows.length === 0) return;
  assertOk(await db().from('program_exercises').insert(rows), 'insertProgramExercises');
}
