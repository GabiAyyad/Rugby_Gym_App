import 'server-only';
import { suggestNextWeight } from '@/lib/domain/progression';
import { todayISO } from '@/lib/domain/week';
import { ActionError } from '@/lib/http';
import {
  findProgramExerciseById,
  getProgramDayContexts,
  listExercisesByIds,
  listLogsForSessions,
  listPlayerSessionsForDay,
} from '@/lib/supabase/queries/training';
import type { SessionUser } from '@/types/common';
import type { LogRow } from '@/types/database';
import type { Exercise } from '@/types/exercise';
import type { LastSessionSummary, LoggedSet, Suggestion } from '@/types/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface GetLastLogResult {
  programExerciseId: string;
  exercise: Exercise;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  /** Null when the player has never logged this one. */
  last: LastSessionSummary | null;
  suggestion: Suggestion;
}

/**
 * What the player did last time on one exercise, plus the number to open the
 * input with. Sessions dated today are skipped: this answers "what did I do last
 * time", not "what have I done so far in this session".
 */
export async function getLastLogForExercise(
  session: SessionUser,
  programExerciseId: string,
): Promise<GetLastLogResult> {
  if (!UUID.test(programExerciseId)) throw new ActionError('That exercise is not on your program.', 404);
  if (!session.positionGroup) {
    throw new ActionError('Your profile has no position group, so no program applies to you.', 403);
  }

  const programExercise = await findProgramExerciseById(programExerciseId);
  if (!programExercise) throw new ActionError('That exercise is not on your program.', 404);

  const [context] = await getProgramDayContexts([programExercise.program_day_id]);
  if (
    !context ||
    context.teamId !== session.teamId ||
    context.positionGroup !== session.positionGroup
  ) {
    throw new ActionError('That exercise is not on your program.', 404);
  }

  const [exerciseRow] = await listExercisesByIds([programExercise.exercise_id]);
  const exercise: Exercise = {
    id: programExercise.exercise_id,
    name: exerciseRow?.name ?? 'Exercise',
    videoUrl: exerciseRow?.video_url ?? null,
    movementPattern: exerciseRow?.movement_pattern ?? null,
    progressionType: exerciseRow?.progression_type ?? 'bodyweight_plyo',
    createdAt: exerciseRow?.created_at ?? new Date(0).toISOString(),
  };

  const today = todayISO();
  const priorSessions = (
    await listPlayerSessionsForDay(session.playerId, programExercise.program_day_id)
  )
    .filter((row) => row.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  const logs = await listLogsForSessions(priorSessions.map((row) => row.id));
  const bySession = new Map<string, LogRow[]>();
  for (const log of logs) {
    if (log.program_exercise_id !== programExerciseId) continue;
    const list = bySession.get(log.session_id) ?? [];
    list.push(log);
    bySession.set(log.session_id, list);
  }

  let last: LastSessionSummary | null = null;
  for (const prior of priorSessions) {
    const sets = bySession.get(prior.id);
    if (!sets || sets.length === 0) continue;
    last = { date: prior.date, sets: sets.map(toLoggedSet).sort((a, b) => a.setNumber - b.setNumber) };
    break;
  }

  return {
    programExerciseId,
    exercise,
    targetSets: programExercise.target_sets,
    targetReps: programExercise.target_reps,
    restSeconds: programExercise.rest_seconds,
    last,
    suggestion: suggestNextWeight({
      progressionType: exercise.progressionType,
      targetSets: programExercise.target_sets,
      targetReps: programExercise.target_reps,
      last,
    }),
  };
}

function toLoggedSet(log: LogRow): LoggedSet {
  return {
    setNumber: log.set_number,
    repsDone: log.reps_done,
    weightUsed: log.weight_used === null ? null : Number(log.weight_used),
    distanceOrTime: log.distance_or_time,
  };
}
