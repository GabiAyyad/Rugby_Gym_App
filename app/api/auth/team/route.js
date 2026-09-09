// Step 1 of login. No auth required — this IS the entry point before a session exists.
import { lookupTeam } from '@/lib/actions/lookupTeam';
import { handle, parseBody } from '@/lib/http';
import { requireString } from '@/lib/validate';

/**
 * POST { loginCode: string } -> that team's public info + roster (names,
 * roles, position groups — never PIN hashes). The login screen uses this to
 * show the "pick your name" list after a team code is entered.
 */
export async function POST(request) {
  return handle(async () => {
    const body = await parseBody(request);
    const loginCode = requireString(body.loginCode, 'loginCode', { min: 1 });
    return lookupTeam(loginCode);
  });
}
