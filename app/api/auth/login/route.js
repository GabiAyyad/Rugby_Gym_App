// Step 2 of login: the roster name (and PIN, for admins) the user picked.
import { login } from '@/lib/actions/login';
import { handle, parseBody } from '@/lib/http';
import { requireString, requireUUID } from '@/lib/validate';

/**
 * POST { loginCode, playerId, pin? } -> { redirectTo }. `pin` is required and
 * checked (with attempt throttling) only if the chosen player is an admin;
 * a normal player signs in with no PIN at all. On success this sets the
 * signed session cookie and tells the client where to navigate next.
 */
export async function POST(request) {
  return handle(async () => {
    const body = await parseBody(request);
    const loginCode = requireString(body.loginCode, 'loginCode', { min: 1 });
    const playerId = requireUUID(body.playerId, 'playerId');
    const pin = body.pin ?? null;
    const { redirectTo } = await login({ loginCode, playerId, pin });
    return { redirectTo };
  });
}
