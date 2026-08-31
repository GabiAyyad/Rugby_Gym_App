import { z } from 'zod';
import { startSession } from '@/lib/actions/startSession';
import { requirePlayer } from '@/lib/auth';
import { isISODate } from '@/lib/domain/week';
import { handle, parseBody } from '@/lib/http';

const schema = z.object({
  programDayId: z.uuid(),
  date: z
    .string()
    .refine(isISODate, 'Use a YYYY-MM-DD date.')
    .optional(),
});

/** Resolve-or-create the session for a program day; returns the real session id. */
export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePlayer();
    const input = await parseBody(request, schema);
    return startSession(session, input);
  });
}
