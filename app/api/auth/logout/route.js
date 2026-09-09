import { handle } from '@/lib/http';
import { destroySession } from '@/lib/session';

/** POST (no body) -> clears the session cookie. Used by the "Sign out" button in AppNav. */
export async function POST() {
  return handle(async () => {
    await destroySession();
    return { ok: true };
  });
}
