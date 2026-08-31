import { z } from 'zod';
import { getAdherenceDashboard } from '@/lib/actions/getAdherenceDashboard';
import { requireAdmin } from '@/lib/auth';
import { handle, parseQuery } from '@/lib/http';

const schema = z.object({
  positionGroup: z.enum(['forward', 'back', 'all']).optional(),
  sort: z.enum(['risk', 'name', 'adherence', 'lastLog']).optional(),
});

export async function GET(request: Request) {
  return handle(async () => {
    const session = await requireAdmin();
    const query = parseQuery(request, schema);
    return getAdherenceDashboard(session, {
      positionGroup: query.positionGroup === 'all' ? null : (query.positionGroup ?? null),
      sort: query.sort,
    });
  });
}
