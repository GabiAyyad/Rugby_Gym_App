import 'server-only';
import { suggestNextWeight } from '@/lib/domain/progression';
import { ActionError } from '@/lib/http';
import {
  findPlayerSession,
  getProgramDayContexts,
  listExercisesByIds,
  listLogsForSessions,
  listPlayerSessionsForDay,
  listProgramExercisesForDays,
} from '@/lib/db/queries/training';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Everything the logging screen needs in one payload: the day's exercises in
 * order, the sets already logged in this session, what the player did last time,
 * and the suggestion built from it.
 *
 * The session is looked up by (id AND player_id) — a session id in a URL is
 * never treated as proof of ownership.
 */
export async function getSessionDetail(session, sessionId) {
  if (!UUID.test(sessionId)) throw new ActionError('That session does not exist.', 404);

  const row = await findPlayerSession(session.playerId, sessionId);
  if (!row) throw new ActionError('That session does not exist.', 404);

  const [context] = await getProgramDayContexts([row.program_day_id]);
  if (!context || context.teamId !== session.teamId) {
    throw new ActionError('That session does not exist.', 404);
  }

  const programExercises = await listProgramExercisesForDays([row.program_day_id]);
  const exercises = await listExercisesByIds(programExercises.map((item) => item.exercise_id));
  const exerciseById = new Map(exercises.map((item) => [item.id, item]));

  // This session's own sets, plus the history that feeds the suggestions.
  const priorSessions = (await listPlayerSessionsForDay(session.playerId, row.program_day_id))
    .filter((candidate) => candidate.id !== row.id && candidate.date <= row.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  const logs = await listLogsForSessions([row.id, ...priorSessions.map((prior) => prior.id)]);
  const logsBySession = groupBy(logs, (log) => log.session_id);
  const ownLogs = logsBySession.get(row.id) ?? [];
  const ownSets = groupBy(ownLogs, (log) => log.program_exercise_id);

  const detailExercises = programExercises.map((item) => {
    const exercise = toExercise(exerciseById.get(item.exercise_id), item.exercise_id);
    const last = findLastSession(priorSessions, logsBySession, item.id);
    const sets = (ownSets.get(item.id) ?? []).map(toLoggedSet).sort((a, b) => a.setNumber - b.setNumber);

    return {
      programExerciseId: item.id,
      order: item.order,
      targetSets: item.target_sets,
      targetReps: item.target_reps,
      restSeconds: item.rest_seconds,
      notes: item.notes,
      exercise,
      sets,
      lastSession: last,
      suggestion: suggestNextWeight({
        progressionType: exercise.progressionType,
        targetSets: item.target_sets,
        targetReps: item.target_reps,
        last,
      }),
    };
  });

  return {
    sessionId: row.id,
    programDayId: row.program_day_id,
    programName: context.programName,
    dayNumber: context.dayNumber,
    label: context.label,
    date: row.date,
    completedAt: row.completed_at,
    exercises: detailExercises,
  };
}

/** The most recent earlier session that actually carries sets for this exercise. */
function findLastSession(priorSessions, logsBySession, programExerciseId) {
  for (const prior of priorSessions) {
    const sets = (logsBySession.get(prior.id) ?? []).filter((log) => log.program_exercise_id === programExerciseId);
    if (sets.length === 0) continue;
    return { date: prior.date, sets: sets.map(toLoggedSet).sort((a, b) => a.setNumber - b.setNumber) };
  }
  return null;
}

/** Buckets an array of rows into a Map keyed by `key(row)` — a tiny generic groupBy. */
function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const list = map.get(key(row)) ?? [];
    list.push(row);
    map.set(key(row), list);
  }
  return map;
}

/** Converts one raw `logs` row into the client-facing LoggedSet shape. */
function toLoggedSet(log) {
  return {
    setNumber: log.set_number,
    repsDone: log.reps_done,
    weightUsed: log.weight_used === null ? null : Number(log.weight_used),
    distanceOrTime: log.distance_or_time,
  };
}

/** A program exercise cannot outlive its exercise (FK is `on delete restrict`). */
function toExercise(row, fallbackId) {
  if (!row) {
    return {
      id: fallbackId,
      name: 'Exercise',
      videoUrl: null,
      movementPattern: null,
      progressionType: 'bodyweight_plyo',
      createdAt: new Date(0).toISOString(),
    };
  }
  return {
    id: row.id,
    name: row.name,
    videoUrl: row.video_url,
    movementPattern: row.movement_pattern,
    progressionType: row.progression_type,
    createdAt: row.created_at,
  };
}
