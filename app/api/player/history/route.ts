import { z } from 'zod';
import { getPlayerHistory } from '@/lib/actions/getPlayerHistory';
import { requirePlayer } from '@/lib/auth';
import { handle, parseQuery } from '@/lib/http';

const schema = z.object({
  exerciseId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  return handle(async () => {
    const session = await requirePlayer();
    const query = parseQuery(request, schema);
    return getPlayerHistory(session, { exerciseId: query.exerciseId ?? null, limit: query.limit });
  });
}
