import { getSessionDetail } from '@/lib/actions/getSessionDetail';
import { requirePlayer } from '@/lib/auth';
import { handle } from '@/lib/http';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  return handle(async () => {
    const session = await requirePlayer();
    const { sessionId } = await params;
    return getSessionDetail(session, sessionId);
  });
}
