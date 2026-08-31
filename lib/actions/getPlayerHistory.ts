import 'server-only';
import type { SessionUser } from '@/types/common';
import type { HistorySession, PlayerHistoryResult, ProgressPoint } from '@/types/session';
import { estimateOneRepMax } from '@/lib/domain/adherence';
import {
  listExercisesByIds,
  listLogsForSessions,
  listProgramDaysByIds,
  listProgramExercisesByIds,
  listProgramNamesByIds,
  listSessionsWithLogs,
  type ReportingLog,
} from '@/lib/supabase/queries/reporting';

export interface GetPlayerHistoryInput {
  /** Exercise to chart. Defaults to the one the player logged most recently. */
  exerciseId?: string | null;
  /** How many sessions to list. The chart always uses the full window below. */
  limit?: number;
}

/** Roughly a year of training — deep enough for a trend, shallow enough to stay cheap. */
const SESSION_WINDOW = 120;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/**
 * A player's own training history. Scoped to `session.playerId` and nothing
 * else: a player never sees another player's logs from this screen.
 *
 * Everything comes out of one window of sessions — the list, the exercise
 * picker and the chart series are all folded out of the same rows in memory
 * rather than re-queried per exercise.
 */
export async function getPlayerHistory(
  session: SessionUser,
  input: GetPlayerHistoryInput = {},
): Promise<PlayerHistoryResult> {
  const limit = clamp(input.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);

  const sessions = await listSessionsWithLogs({
    playerIds: [session.playerId],
    limit: SESSION_WINDOW,
  });

  if (sessions.length === 0) {
    return { sessions: [], loggedExercises: [], series: null };
  }

  const [logs, days] = await Promise.all([
    listLogsForSessions(sessions.map((row) => row.id)),
    listProgramDaysByIds(unique(sessions.map((row) => row.programDayId))),
  ]);

  const [programs, programExercises] = await Promise.all([
    listProgramNamesByIds(unique(days.map((day) => day.programId))),
    listProgramExercisesByIds(unique(logs.map((log) => log.programExerciseId))),
  ]);

  const exerciseIdByProgramExercise = new Map(programExercises.map((row) => [row.id, row.exerciseId]));
  const exercises = await listExercisesByIds(unique([...exerciseIdByProgramExercise.values()]));
  const exerciseNames = new Map(exercises.map((row) => [row.id, row.name]));

  const daysById = new Map(days.map((day) => [day.id, day]));
  const programNames = new Map(programs.map((program) => [program.id, program.name]));

  const logsBySession = new Map<string, ReportingLog[]>();
  for (const log of logs) {
    const bucket = logsBySession.get(log.sessionId);
    if (bucket) bucket.push(log);
    else logsBySession.set(log.sessionId, [log]);
  }

  /* ------------------------------------------------------------- session list */

  const historySessions: HistorySession[] = sessions.slice(0, limit).map((row) => {
    const sessionLogs = logsBySession.get(row.id) ?? [];
    const day = daysById.get(row.programDayId);

    return {
      sessionId: row.id,
      date: row.date,
      programName: (day && programNames.get(day.programId)) ?? 'Training',
      dayNumber: day?.dayNumber ?? 0,
      label: day?.label ?? null,
      exerciseCount: unique(sessionLogs.map((log) => log.programExerciseId)).length,
      setCount: sessionLogs.length,
      totalVolumeKg: round1(sessionLogs.reduce((sum, log) => sum + volumeOf(log), 0)),
      completedAt: row.completedAt,
    };
  });

  /* -------------------------------------------------------- exercise selector */

  // Ordered by how recently the player trained them, so the default pick is the
  // exercise they touched last.
  const exerciseIdsByRecency: string[] = [];
  for (const row of sessions) {
    for (const log of logsBySession.get(row.id) ?? []) {
      const exerciseId = exerciseIdByProgramExercise.get(log.programExerciseId);
      if (exerciseId && !exerciseIdsByRecency.includes(exerciseId)) exerciseIdsByRecency.push(exerciseId);
    }
  }

  const loggedExercises = exerciseIdsByRecency
    .map((id) => ({ id, name: exerciseNames.get(id) ?? 'Exercise' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  /* ---------------------------------------------------------------- the chart */

  const requested = input.exerciseId ?? exerciseIdsByRecency[0] ?? null;
  const chartExerciseId = requested && exerciseIdsByRecency.includes(requested) ? requested : null;

  if (!chartExerciseId) {
    return { sessions: historySessions, loggedExercises, series: null };
  }

  const programExerciseIds = new Set(
    programExercises.filter((row) => row.exerciseId === chartExerciseId).map((row) => row.id),
  );

  const points: ProgressPoint[] = [];
  // Oldest first: a chart reads left to right.
  for (const row of [...sessions].reverse()) {
    const matching = (logsBySession.get(row.id) ?? []).filter((log) =>
      programExerciseIds.has(log.programExerciseId),
    );
    if (matching.length === 0) continue;

    const top = topSet(matching);
    // Bodyweight work carries no weight, so fall back to the best rep count —
    // the line stays empty but the tooltip still says something useful.
    const bestReps = matching.reduce((most, log) => Math.max(most, log.repsDone ?? 0), 0);

    points.push({
      date: row.date,
      topWeightKg: top?.weightUsed ?? null,
      topSetReps: top?.repsDone ?? (bestReps > 0 ? bestReps : null),
      estimatedOneRepMaxKg:
        top && top.weightUsed !== null && top.repsDone !== null && top.repsDone > 0
          ? estimateOneRepMax(top.weightUsed, top.repsDone)
          : null,
      totalVolumeKg: round1(matching.reduce((sum, log) => sum + volumeOf(log), 0)),
    });
  }

  return {
    sessions: historySessions,
    loggedExercises,
    series: {
      exerciseId: chartExerciseId,
      exerciseName: exerciseNames.get(chartExerciseId) ?? 'Exercise',
      points,
    },
  };
}

/** Heaviest set of the session; ties go to the one that hit more reps. */
function topSet(logs: ReportingLog[]): ReportingLog | null {
  let best: ReportingLog | null = null;
  for (const log of logs) {
    if (log.weightUsed === null) continue;
    if (
      best === null ||
      log.weightUsed > (best.weightUsed ?? 0) ||
      (log.weightUsed === best.weightUsed && (log.repsDone ?? 0) > (best.repsDone ?? 0))
    ) {
      best = log;
    }
  }
  return best;
}

function volumeOf(log: ReportingLog): number {
  return (log.weightUsed ?? 0) * (log.repsDone ?? 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}
