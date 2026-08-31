import { handle } from '@/lib/http';
import { destroySession } from '@/lib/session';

export async function POST() {
  return handle(async () => {
    await destroySession();
    return { ok: true };
  });
}
