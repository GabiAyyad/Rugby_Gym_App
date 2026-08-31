import { z } from 'zod';
import { syncLogs } from '@/lib/actions/syncLogs';
import { requirePlayer } from '@/lib/auth';
import { isISODate } from '@/lib/domain/week';
import { handle, parseBody } from '@/lib/http';

/**
 * Batch replay of the offline queue. `clientId` is an opaque token minted on the
 * phone, not a database id, so it is bounded rather than parsed as a uuid.
 */
const entrySchema = z.object({
  clientId: z.string().min(8).max(64),
  queuedAt: z.string().min(4).max(40),
  programDayId: z.uuid(),
  date: z.string().refine(isISODate, 'Use a YYYY-MM-DD date.'),
  programExerciseId: z.uuid(),
  setNumber: z.number().int().min(1).max(99),
  repsDone: z.number().int().min(0).max(999).nullable(),
  weightUsed: z.number().min(0).max(999.99).nullable(),
  distanceOrTime: z.string().max(40).nullable(),
});

const schema = z.object({
  entries: z.array(entrySchema).max(500),
});

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requirePlayer();
    const input = await parseBody(request, schema);
    return syncLogs(session, input);
  });
}
