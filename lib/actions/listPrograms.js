import 'server-only';
import { isProgramActiveOn } from '@/lib/domain/activeProgram';
import { todayISO } from '@/lib/domain/week';
import { listDaysForPrograms, listProgramExerciseDayIds, listProgramsForTeam } from '@/lib/db/queries/programs';

/**
 * Every training block belonging to the caller's team, newest start date first,
 * with the day/exercise counts the list screen shows and a derived `isActive`.
 *
 * `isActive` is never stored: it is resolveActiveProgram's answer for today,
 * per team + position group, so the list always agrees with what a player
 * actually sees on /player/today.
 */
export async function listPrograms(session) {
  const rows = await listProgramsForTeam(session.teamId);
  if (rows.length === 0) return { programs: [] };

  const days = await listDaysForPrograms(rows.map((row) => row.id));
  const exerciseDayIds = await listProgramExerciseDayIds(days.map((day) => day.id));

  // programDayId -> how many exercises are on that day, tallied from the flat
  // exerciseDayIds list so it can be summed per-program below.
  const exercisesPerDay = new Map();
  for (const { program_day_id } of exerciseDayIds) {
    exercisesPerDay.set(program_day_id, (exercisesPerDay.get(program_day_id) ?? 0) + 1);
  }

  const dayCount = new Map();
  const exerciseCount = new Map();
  for (const day of days) {
    dayCount.set(day.program_id, (dayCount.get(day.program_id) ?? 0) + 1);
    exerciseCount.set(
      day.program_id,
      (exerciseCount.get(day.program_id) ?? 0) + (exercisesPerDay.get(day.id) ?? 0),
    );
  }

  const today = todayISO();
  const shapes = rows.map((row) => ({
    id: row.id,
    teamId: row.team_id,
    positionGroup: row.position_group,
    startDate: row.start_date,
    endDate: row.end_date,
    isActiveOverride: row.is_active_override,
  }));

  const programs = rows.map((row, index) => ({
    id: row.id,
    teamId: row.team_id,
    positionGroup: row.position_group,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActiveOverride: row.is_active_override,
    isActive: isProgramActiveOn(shapes[index], shapes, today),
    dayCount: dayCount.get(row.id) ?? 0,
    exerciseCount: exerciseCount.get(row.id) ?? 0,
    createdAt: row.created_at,
  }));

  return { programs };
}
