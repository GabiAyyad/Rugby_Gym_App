import { z } from 'zod';
import { setLeaderboardOptIn } from '@/lib/actions/setLeaderboardOptIn';
import { requirePlayer } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';

const schema = z.object({ optIn: z.boolean() });

export async function PATCH(request: Request) {
  return handle(async () => {
    const session = await requirePlayer();
    const input = await parseBody(request, schema);
    return setLeaderboardOptIn(session, input);
  });
}
