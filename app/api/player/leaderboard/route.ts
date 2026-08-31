import { getLeaderboard } from '@/lib/actions/getLeaderboard';
import { requirePlayer } from '@/lib/auth';
import { handle } from '@/lib/http';

export async function GET() {
  return handle(async () => {
    const session = await requirePlayer();
    return getLeaderboard(session);
  });
}
