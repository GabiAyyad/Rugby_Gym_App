import 'server-only';
import { ActionError } from '@/lib/http';
import type { SessionUser } from '@/types/common';
import type { Exercise } from '@/types/exercise';
import type { Program, ProgramDay, ProgramExercise } from '@/types/program';
import type { ExerciseRow } from '@/types/database';
import { isProgramActiveOn, type ProgramLike } from '@/lib/domain/activeProgram';
import { todayISO } from '@/lib/domain/week';
import {
  findProgramForTeam,
  listDaysForPrograms,
  listExercisesByIds,
  listProgramExercisesForDays,
  listProgramsForTeam,
} from '@/lib/supabase/queries/programs';

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    videoUrl: row.video_url,
    movementPattern: row.movement_pattern,
    progressionType: row.progression_type,
    createdAt: row.created_at,
  };
}

/**
 * One block with its days and exercises, for the builder screen.
 *
 * The team id in the lookup is the ownership check — an admin pasting another
 * squad's program id gets a 404, not somebody else's programming.
 */
export async function getProgram(session: SessionUser, programId: string): Promise<Program> {
  const row = await findProgramForTeam(session.teamId, programId);
  if (!row) throw new ActionError('That training block was not found.', 404);

  const dayRows = await listDaysForPrograms([row.id]);
  const exerciseRows = await listProgramExercisesForDays(dayRows.map((day) => day.id));
  const library = await listExercisesByIds([
    ...new Set(exerciseRows.map((entry) => entry.exercise_id)),
  ]);
  const byExerciseId = new Map(library.map((exercise) => [exercise.id, toExercise(exercise)]));

  const days: ProgramDay[] = dayRows.map((day) => {
    const exercises: ProgramExercise[] = exerciseRows
      .filter((entry) => entry.program_day_id === day.id)
      .sort((a, b) => a.order - b.order)
      .flatMap((entry) => {
        const exercise = byExerciseId.get(entry.exercise_id);
        // An exercise row can only vanish if the library row was removed under
        // us; drop it rather than render a half-populated step to the player.
        if (!exercise) return [];
        return [
          {
            id: entry.id,
            exerciseId: entry.exercise_id,
            exercise,
            order: entry.order,
            targetSets: entry.target_sets,
            targetReps: entry.target_reps,
            restSeconds: entry.rest_seconds,
            notes: entry.notes,
          },
        ];
      });

    return { id: day.id, dayNumber: day.day_number, label: day.label, exercises };
  });

  // isActive depends on the team's other blocks, so resolve against all of them.
  const siblings = await listProgramsForTeam(session.teamId);
  const shapes: ProgramLike[] = siblings.map((sibling) => ({
    id: sibling.id,
    teamId: sibling.team_id,
    positionGroup: sibling.position_group,
    startDate: sibling.start_date,
    endDate: sibling.end_date,
    isActiveOverride: sibling.is_active_override,
  }));
  const self: ProgramLike = {
    id: row.id,
    teamId: row.team_id,
    positionGroup: row.position_group,
    startDate: row.start_date,
    endDate: row.end_date,
    isActiveOverride: row.is_active_override,
  };

  return {
    id: row.id,
    teamId: row.team_id,
    positionGroup: row.position_group,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActiveOverride: row.is_active_override,
    isActive: isProgramActiveOn(self, shapes, todayISO()),
    createdAt: row.created_at,
    days,
  };
}
