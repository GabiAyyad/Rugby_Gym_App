import 'server-only';
import { resolveActiveProgram } from '@/lib/domain/activeProgram';
import { endOfWeek, startOfWeek, todayISO } from '@/lib/domain/week';
import {
  countLogsForSessions,
  listPlayerSessionsForDays,
  listProgramDays,
  listProgramExercisesForDays,
  listTeamPrograms,
} from '@/lib/supabase/queries/training';
import type { SessionUser } from '@/types/common';
import type { SessionRow } from '@/types/database';
import type { DayStatus, WeekDay, WeekView } from '@/types/session';

/**
 * The player's week.
 *
 * Program days are not pinned to weekdays: a block has up to four days and the
 * player trains the next unfinished one whenever they make it to the gym. So
 * this reports, per day, whether a session exists in the current Monday→Sunday
 * week and how far through it the player is.
 */
export async function getWeekView(session: SessionUser): Promise<WeekView> {
  const today = todayISO();
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);

  const empty: WeekView = {
    program: null,
    today,
    weekStart,
    weekEnd,
    days: [],
    nextDayNumber: null,
    completedThisWeek: 0,
    scheduledThisWeek: 0,
  };

  // is_player implies a position group at the database level; belt and braces.
  if (!session.positionGroup) return empty;

  const programRows = await listTeamPrograms(session.teamId, session.positionGroup);
  const active = resolveActiveProgram(
    programRows.map((row) => ({
      id: row.id,
      name: row.name,
      teamId: row.team_id,
      positionGroup: row.position_group,
      startDate: row.start_date,
      endDate: row.end_date,
      isActiveOverride: row.is_active_override,
    })),
    today,
    { teamId: session.teamId, positionGroup: session.positionGroup },
  );

  if (!active) return empty;

  const programDays = await listProgramDays(active.id);
  const dayIds = programDays.map((day) => day.id);

  const [programExercises, sessions] = await Promise.all([
    listProgramExercisesForDays(dayIds),
    listPlayerSessionsForDays(session.playerId, dayIds, weekStart, weekEnd),
  ]);

  const logCounts = await countLogsForSessions(sessions.map((row) => row.id));

  const exerciseCounts = new Map<string, number>();
  for (const exercise of programExercises) {
    exerciseCounts.set(exercise.program_day_id, (exerciseCounts.get(exercise.program_day_id) ?? 0) + 1);
  }

  const sessionsByDay = new Map<string, SessionRow[]>();
  for (const row of sessions) {
    const list = sessionsByDay.get(row.program_day_id) ?? [];
    list.push(row);
    sessionsByDay.set(row.program_day_id, list);
  }

  const days: WeekDay[] = programDays.map((day) => {
    const picked = pickSession(sessionsByDay.get(day.id) ?? [], logCounts);
    return {
      programDayId: day.id,
      dayNumber: day.day_number,
      label: day.label,
      exerciseCount: exerciseCounts.get(day.id) ?? 0,
      sessionId: picked?.row.id ?? null,
      date: picked?.row.date ?? null,
      status: picked?.status ?? 'not_started',
    };
  });

  const completedThisWeek = days.filter((day) => day.status === 'completed').length;
  const nextDay = days.find((day) => day.status !== 'completed') ?? null;

  return {
    program: {
      id: active.id,
      name: active.name,
      positionGroup: active.positionGroup,
      startDate: active.startDate,
      endDate: active.endDate,
    },
    today,
    weekStart,
    weekEnd,
    days,
    nextDayNumber: nextDay?.dayNumber ?? null,
    completedThisWeek,
    scheduledThisWeek: days.length,
  };
}

/**
 * A player can open the same program day on two dates inside one week (a
 * retry, or a session started and abandoned). The week board shows one, so
 * finished beats started, started beats opened, and the newest wins a tie.
 */
function pickSession(
  candidates: SessionRow[],
  logCounts: Record<string, number>,
): { row: SessionRow; status: DayStatus } | null {
  if (candidates.length === 0) return null;

  const rank = (row: SessionRow): number => {
    if (row.completed_at) return 2;
    return (logCounts[row.id] ?? 0) > 0 ? 1 : 0;
  };

  const best = [...candidates].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(b) - rank(a);
    return b.date.localeCompare(a.date);
  })[0];

  const status: DayStatus = best.completed_at
    ? 'completed'
    : (logCounts[best.id] ?? 0) > 0
      ? 'in_progress'
      : 'not_started';

  return { row: best, status };
}
