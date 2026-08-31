import { z } from 'zod';
import { createPlayer } from '@/lib/actions/createPlayer';
import { listPlayers } from '@/lib/actions/listPlayers';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';

/** No teamId here on purpose — it comes from the session, never the request. */
const createSchema = z.object({
  name: z.string().min(1, 'Enter a name.').max(80, 'That name is too long.'),
  positionGroup: z.enum(['forward', 'back']).nullable(),
  isAdmin: z.boolean(),
  isPlayer: z.boolean(),
  adminPin: z.string().max(8).nullable().optional(),
});

export async function GET() {
  return handle(async () => listPlayers(await requireAdmin()));
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireAdmin();
    return createPlayer(session, await parseBody(request, createSchema));
  });
}
