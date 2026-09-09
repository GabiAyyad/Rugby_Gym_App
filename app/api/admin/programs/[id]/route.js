// Admin-only endpoint for one specific training block, addressed by :id.
import { deleteProgram } from '@/lib/actions/deleteProgram';
import { getProgram } from '@/lib/actions/getProgram';
import { updateProgram } from '@/lib/actions/updateProgram';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';
import { parseProgramInput, requireUUID } from '@/lib/validate';

/** GET -> the full Program (days + exercises), scoped to the caller's team. */
export async function GET(_request, context) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = await context.params;
    requireUUID(id, 'id');
    return getProgram(session, id);
  });
}

/**
 * PATCH { positionGroup, name, startDate, endDate, isActiveOverride, days } ->
 * the updated Program. This fully replaces the block's days/exercises —
 * there is no partial-update path (see updateProgram for why).
 */
export async function PATCH(request, context) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = await context.params;
    requireUUID(id, 'id');
    const input = parseProgramInput(await parseBody(request));
    return updateProgram(session, { ...input, id });
  });
}

/** DELETE (no body) -> { id }. Cascades to every session/log logged against this block's days. */
export async function DELETE(_request, context) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = await context.params;
    requireUUID(id, 'id');
    return deleteProgram(session, { id });
  });
}
