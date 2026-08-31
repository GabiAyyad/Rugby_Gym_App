import 'server-only';
import { addDays, isISODate, todayISO } from '@/lib/domain/week';
import {
  getProgramDayContexts,
  listProgramExercisesForDays,
  upsertLogs,
  upsertSessions,
  type LogUpsert,
} from '@/lib/supabase/queries/training';
import type { SessionUser } from '@/types/common';
import type { QueuedLog, SyncLogsInput, SyncLogsResult } from '@/types/session';

const MAX_SET_NUMBER = 99;
const MAX_REPS = 999;
/** logs.weight_used is numeric(6,2). */
const MAX_WEIGHT = 999.99;
const MAX_MEASURE_LENGTH = 40;

/**
 * Replay the player's offline queue.
 *
 * Every entry carries its own programDayId + date, so a phone that has never
 * been online since the session started still tells us which session the sets
 * belong to. Sessions upsert on (player, program day, date) and logs on
 * (session, exercise, set) — both real unique constraints — so sending the same
 * entry twice updates the row instead of duplicating it.
 *
 * Nothing here trusts the client beyond the numbers: the program day must belong
 * to a block of the caller's own team AND position group, and each exercise must
 * belong to that day.
 */
export async function syncLogs(
  session: SessionUser,
  input: SyncLogsInput,
): Promise<SyncLogsResult> {
  const accepted: string[] = [];
  const rejected: Array<{ clientId: string; error: string }> = [];
  const sessionIds: Record<string, string> = {};

  const entries = input.entries ?? [];
  if (entries.length === 0) return { accepted, rejected, sessionIds };

  if (!session.positionGroup) {
    return {
      accepted,
      rejected: entries.map((entry) => ({
        clientId: entry.clientId,
        error: 'Your profile has no position group, so no program applies to you.',
      })),
      sessionIds,
    };
  }

  const latestDate = addDays(todayISO(), 1);

  // 1. Shape. A malformed entry is dropped rather than retried forever.
  const shaped: QueuedLog[] = [];
  for (const entry of entries) {
    const problem = shapeProblem(entry, latestDate);
    if (problem) rejected.push({ clientId: entry.clientId, error: problem });
    else shaped.push(entry);
  }
  if (shaped.length === 0) return { accepted, rejected, sessionIds };

  // 2. Ownership: team + position group, resolved server-side.
  const contexts = await getProgramDayContexts([...new Set(shaped.map((e) => e.programDayId))]);
  const allowedDays = new Set(
    contexts
      .filter(
        (context) =>
          context.teamId === session.teamId && context.positionGroup === session.positionGroup,
      )
      .map((context) => context.programDayId),
  );

  // 3. Membership: the exercise has to live on the day it claims.
  const programExercises = await listProgramExercisesForDays([...allowedDays]);
  const exercisesByDay = new Map<string, Set<string>>();
  for (const item of programExercises) {
    const set = exercisesByDay.get(item.program_day_id) ?? new Set<string>();
    set.add(item.id);
    exercisesByDay.set(item.program_day_id, set);
  }

  const usable: QueuedLog[] = [];
  for (const entry of shaped) {
    if (!allowedDays.has(entry.programDayId)) {
      rejected.push({ clientId: entry.clientId, error: 'That training day is not part of your program.' });
      continue;
    }
    if (!exercisesByDay.get(entry.programDayId)?.has(entry.programExerciseId)) {
      rejected.push({ clientId: entry.clientId, error: 'That exercise is not on that training day.' });
      continue;
    }
    usable.push(entry);
  }
  if (usable.length === 0) return { accepted, rejected, sessionIds };

  // 4. Resolve or create the owning sessions.
  const groupKeys = [...new Set(usable.map((entry) => sessionKey(entry.programDayId, entry.date)))];
  const sessionRows = await upsertSessions(
    groupKeys.map((key) => {
      const [programDayId, date] = splitKey(key);
      return { player_id: session.playerId, program_day_id: programDayId, date };
    }),
  );
  for (const row of sessionRows) {
    sessionIds[sessionKey(row.program_day_id, row.date)] = row.id;
  }

  // 5. Collapse duplicates before the upsert: Postgres refuses to touch the same
  //    row twice in one ON CONFLICT statement, and the queue can legitimately
  //    hold two edits of the same set. Newest write wins; both ids are accepted.
  const winners = new Map<string, { row: LogUpsert; at: number; clientIds: string[] }>();
  for (const entry of usable) {
    const sessionId = sessionIds[sessionKey(entry.programDayId, entry.date)];
    if (!sessionId) {
      rejected.push({ clientId: entry.clientId, error: 'Could not open the session for that day.' });
      continue;
    }
    const key = `${sessionId}|${entry.programExerciseId}|${entry.setNumber}`;
    const candidate: LogUpsert = {
      session_id: sessionId,
      program_exercise_id: entry.programExerciseId,
      set_number: entry.setNumber,
      reps_done: entry.repsDone,
      weight_used: entry.weightUsed === null ? null : Math.round(entry.weightUsed * 100) / 100,
      distance_or_time: entry.distanceOrTime,
      logged_at: loggedAt(entry.queuedAt),
    };

    const at = Date.parse(candidate.logged_at);
    const existing = winners.get(key);
    if (!existing) {
      winners.set(key, { row: candidate, at, clientIds: [entry.clientId] });
      continue;
    }
    existing.clientIds.push(entry.clientId);
    if (at >= existing.at) {
      existing.row = candidate;
      existing.at = at;
    }
  }

  await upsertLogs([...winners.values()].map((winner) => winner.row));
  for (const winner of winners.values()) accepted.push(...winner.clientIds);

  return { accepted, rejected, sessionIds };
}

/** programDayId|date — the key the client uses to adopt server session ids. */
function sessionKey(programDayId: string, date: string): string {
  return `${programDayId}|${date}`;
}

function splitKey(key: string): [string, string] {
  const index = key.indexOf('|');
  return [key.slice(0, index), key.slice(index + 1)];
}

/**
 * Keep the time the set was actually done rather than the time it reached us —
 * a queue flushed on the drive home should not read as a 6pm session.
 */
function loggedAt(queuedAt: string): string {
  const parsed = new Date(queuedAt);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  if (parsed.getTime() > Date.now() + 60_000) return new Date().toISOString();
  return parsed.toISOString();
}

function shapeProblem(entry: QueuedLog, latestDate: string): string | null {
  if (!entry.clientId || typeof entry.clientId !== 'string') return 'Missing client id.';
  if (!isISODate(entry.date)) return 'That is not a valid date.';
  if (entry.date > latestDate) return 'That date is too far in the future.';
  if (!Number.isInteger(entry.setNumber) || entry.setNumber < 1 || entry.setNumber > MAX_SET_NUMBER) {
    return 'That set number is out of range.';
  }
  if (entry.repsDone !== null) {
    if (!Number.isInteger(entry.repsDone) || entry.repsDone < 0 || entry.repsDone > MAX_REPS) {
      return 'That rep count is out of range.';
    }
  }
  if (entry.weightUsed !== null) {
    if (!Number.isFinite(entry.weightUsed) || entry.weightUsed < 0 || entry.weightUsed > MAX_WEIGHT) {
      return 'That weight is out of range.';
    }
  }
  if (entry.distanceOrTime !== null && entry.distanceOrTime.length > MAX_MEASURE_LENGTH) {
    return 'That distance or time is too long.';
  }
  return null;
}
