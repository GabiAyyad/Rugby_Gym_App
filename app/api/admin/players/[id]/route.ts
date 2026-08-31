import { z } from 'zod';
import { deletePlayer } from '@/lib/actions/deletePlayer';
import { updatePlayer } from '@/lib/actions/updatePlayer';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';

type RouteContext = { params: Promise<{ id: string }> };

const paramsSchema = z.object({ id: z.uuid('Unknown player.') });

/** The id comes from the path; the body carries no id and no teamId. */
const updateSchema = z.object({
  name: z.string().min(1, 'Enter a name.').max(80, 'That name is too long.'),
  positionGroup: z.enum(['forward', 'back']).nullable(),
  isAdmin: z.boolean(),
  isPlayer: z.boolean(),
  /** Blank or absent leaves the stored PIN untouched. */
  adminPin: z.string().max(8).nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = paramsSchema.parse(await context.params);
    const body = await parseBody(request, updateSchema);
    return updatePlayer(session, { ...body, id });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = paramsSchema.parse(await context.params);
    return deletePlayer(session, { id });
  });
}
