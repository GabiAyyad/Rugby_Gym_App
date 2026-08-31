import 'server-only';
import { db } from '@/lib/supabase/client';
import type { ExerciseRow, ProgressionType } from '@/types/database';
import { unwrap, unwrapMaybe } from './index';

/**
 * The exercise library is global on purpose (CLAUDE.md): both squads pick from
 * the same list, only the programs built from it are team-specific. So unlike
 * players.ts, nothing here takes or filters on a team_id.
 */

export interface ExerciseWrite {
  name: string;
  videoUrl: string | null;
  movementPattern: string | null;
  progressionType: ProgressionType;
}

export async function listExerciseRows(): Promise<ExerciseRow[]> {
  return unwrap(await db().from('exercises').select('*').order('name'), 'listExerciseRows');
}

export async function findExerciseRow(exerciseId: string): Promise<ExerciseRow | null> {
  return unwrapMaybe(
    await db().from('exercises').select('*').eq('id', exerciseId).maybeSingle(),
    'findExerciseRow',
  );
}

export async function insertExerciseRow(write: ExerciseWrite): Promise<ExerciseRow> {
  return unwrap(
    await db()
      .from('exercises')
      .insert({
        name: write.name,
        video_url: write.videoUrl,
        movement_pattern: write.movementPattern,
        progression_type: write.progressionType,
      })
      .select('*')
      .single(),
    'insertExerciseRow',
  );
}

export async function updateExerciseRow(
  exerciseId: string,
  write: ExerciseWrite,
): Promise<ExerciseRow | null> {
  return unwrapMaybe(
    await db()
      .from('exercises')
      .update({
        name: write.name,
        video_url: write.videoUrl,
        movement_pattern: write.movementPattern,
        progression_type: write.progressionType,
      })
      .eq('id', exerciseId)
      .select('*')
      .maybeSingle(),
    'updateExerciseRow',
  );
}

export async function deleteExerciseRow(exerciseId: string): Promise<ExerciseRow | null> {
  return unwrapMaybe(
    await db().from('exercises').delete().eq('id', exerciseId).select('*').maybeSingle(),
    'deleteExerciseRow',
  );
}

/**
 * Which programs reference this exercise. `program_exercises.exercise_id` is
 * `on delete restrict`, so a delete would fail anyway — this exists so the user
 * gets "used in 3 programs" instead of a bare foreign-key error.
 *
 * Two flat queries rather than a nested select: Database['Relationships'] is
 * empty by design (types/database.ts), so supabase-js cannot type an embed.
 */
export async function findProgramIdsUsingExercise(exerciseId: string): Promise<string[]> {
  const uses = unwrap(
    await db().from('program_exercises').select('program_day_id').eq('exercise_id', exerciseId),
    'findProgramIdsUsingExercise/days',
  );
  if (uses.length === 0) return [];

  const dayIds = [...new Set(uses.map((use) => use.program_day_id))];
  const days = unwrap(
    await db().from('program_days').select('program_id').in('id', dayIds),
    'findProgramIdsUsingExercise/programs',
  );
  return [...new Set(days.map((day) => day.program_id))];
}
