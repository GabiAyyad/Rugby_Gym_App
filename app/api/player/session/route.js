// Opens (or re-opens) a training session for one day of the player's program.
import { startSession } from '@/lib/actions/startSession';
import { requirePlayer } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';
import { optionalISODate, requireUUID } from '@/lib/validate';

/**
 * POST { programDayId, date? } -> { sessionId, programDayId, date, completedAt }.
 * Resolve-or-create the session for a program day (upserts on the natural
 * key player+day+date, so calling this twice for the same day/date just
 * returns the same session). `date` defaults to today if omitted.
 */
export async function POST(request) {
  return handle(async () => {
    const session = await requirePlayer();
    const body = await parseBody(request);
    const input = {
      programDayId: requireUUID(body.programDayId, 'programDayId'),
      date: optionalISODate(body.date, 'date'),
    };
    return startSession(session, input);
  });
}
