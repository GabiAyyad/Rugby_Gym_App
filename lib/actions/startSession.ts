import 'server-only';
import { addDays, isISODate, todayISO } from '@/lib/domain/week';
import { ActionError } from '@/lib/http';
import { getProgramDayContexts, upsertSessions } from '@/lib/supabase/queries/training';
import type { ISODate, SessionUser } from '@/types/common';

export interface StartSessionInput {
  programDayId: string;
  /** Defaults to today in the app timezone. */
  date?: ISODate;
}

export interface StartSessionResult {
  sessionId: string;
  programDayId: string;
  date: ISODate;
  completedAt: string | null;
}

/**
 * Resolve-or-create the session for one program day on one date.
 *
 * This is an upsert on the natural key rather than an insert, so tapping "start"
 * twice — or coming back to a day later in the week — lands on the same row that
 * an offline replay would have created.
 */
export async function startSession(
  session: SessionUser,
  input: StartSessionInput,
): Promise<StartSessionResult> {
  if (!session.positionGroup) {
    throw new ActionError('Your profile has no position group, so no program applies to you.', 403);
  }

  const date = input.date ?? todayISO();
  if (!isISODate(date)) throw new ActionError('That is not a valid date.', 400, { date: 'Use YYYY-MM-DD.' });
  if (date > addDays(todayISO(), 1)) {
    throw new ActionError('You cannot log a session that far in the future.', 400, {
      date: 'Too far ahead.',
    });
  }

  const [context] = await getProgramDayContexts([input.programDayId]);
  if (
    !context ||
    context.teamId !== session.teamId ||
    context.positionGroup !== session.positionGroup
  ) {
    throw new ActionError('That training day is not part of your program.', 404);
  }

  const [row] = await upsertSessions([
    { player_id: session.playerId, program_day_id: input.programDayId, date },
  ]);
  if (!row) throw new ActionError('Could not open that session.', 500);

  return {
    sessionId: row.id,
    programDayId: row.program_day_id,
    date: row.date,
    completedAt: row.completed_at,
  };
}
