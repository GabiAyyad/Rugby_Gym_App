// The one-time "create the first admin" path, offered on the login screen
// only while a team has zero admins (see lib/actions/bootstrapAdmin.js).
import { bootstrapAdmin } from '@/lib/actions/bootstrapAdmin';
import { handle, parseBody } from '@/lib/http';
import { requireString } from '@/lib/validate';

/**
 * POST { loginCode, name, pin } -> { redirectTo }. Creates the team's first
 * admin and signs them in immediately. Fails with 409 if the team already
 * has an admin — this can only ever succeed once per team.
 */
export async function POST(request) {
  return handle(async () => {
    const body = await parseBody(request);
    const loginCode = requireString(body.loginCode, 'loginCode', { min: 1 });
    const name = requireString(body.name, 'name', { min: 2 });
    const pin = requireString(body.pin, 'pin', { min: 4, max: 8 });
    return bootstrapAdmin({ loginCode, name, pin });
  });
}
