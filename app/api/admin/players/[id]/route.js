// Admin-only endpoint for one specific player, addressed by :id in the URL.
import { deletePlayer } from '@/lib/actions/deletePlayer';
import { updatePlayer } from '@/lib/actions/updatePlayer';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';
import { nullableString, optionalEnum, requireBoolean, requireString, requireUUID } from '@/lib/validate';

/** The id comes from the path; the body carries no id and no teamId. */
function parseUpdateInput(body) {
  return {
    name: requireString(body.name, 'name', { min: 1, max: 80 }),
    positionGroup: optionalEnum(body.positionGroup, ['forward', 'back'], 'positionGroup') ?? null,
    isAdmin: requireBoolean(body.isAdmin, 'isAdmin'),
    isPlayer: requireBoolean(body.isPlayer, 'isPlayer'),
    // Blank or absent leaves the stored PIN untouched.
    adminPin: nullableString(body.adminPin, 'adminPin', { max: 8 }),
  };
}

/** PATCH { name, positionGroup, isAdmin, isPlayer, adminPin? } -> the updated Player. */
export async function PATCH(request, context) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = await context.params;
    requireUUID(id, 'id', 'Unknown player.');
    const body = parseUpdateInput(await parseBody(request));
    return updatePlayer(session, { ...body, id });
  });
}

/** DELETE (no body) -> { id }. Refuses to delete yourself or the team's last admin. */
export async function DELETE(_request, context) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = await context.params;
    requireUUID(id, 'id', 'Unknown player.');
    return deletePlayer(session, { id });
  });
}
