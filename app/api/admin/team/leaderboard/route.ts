import { z } from 'zod';
import { setTeamLeaderboardEnabled } from '@/lib/actions/setTeamLeaderboardEnabled';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';

const schema = z.object({ enabled: z.boolean() });

export async function PATCH(request: Request) {
  return handle(async () => {
    const session = await requireAdmin();
    const input = await parseBody(request, schema);
    return setTeamLeaderboardEnabled(session, input);
  });
}
