// Admin-only collection endpoint for the roster: list it, or add to it.
import { createPlayer } from '@/lib/actions/createPlayer';
import { listPlayers } from '@/lib/actions/listPlayers';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';
import { nullableString, optionalEnum, requireBoolean, requireString } from '@/lib/validate';

/** No teamId here on purpose — it comes from the session, never the request. */
function parseCreateInput(body) {
  return {
    name: requireString(body.name, 'name', { min: 1, max: 80 }),
    positionGroup: optionalEnum(body.positionGroup, ['forward', 'back'], 'positionGroup') ?? null,
    isAdmin: requireBoolean(body.isAdmin, 'isAdmin'),
    isPlayer: requireBoolean(body.isPlayer, 'isPlayer'),
    adminPin: nullableString(body.adminPin, 'adminPin', { max: 8 }),
  };
}

/** GET -> the caller's own team's full roster (admins only). */
export async function GET() {
  return handle(async () => listPlayers(await requireAdmin()));
}

/** POST { name, positionGroup, isAdmin, isPlayer, adminPin? } -> the new Player. */
export async function POST(request) {
  return handle(async () => {
    const session = await requireAdmin();
    return createPlayer(session, parseCreateInput(await parseBody(request)));
  });
}
