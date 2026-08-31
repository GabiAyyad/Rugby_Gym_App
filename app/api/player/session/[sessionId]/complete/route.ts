import { completeSession } from '@/lib/actions/completeSession';
import { requirePlayer } from '@/lib/auth';
import { handle } from '@/lib/http';

/** The session id comes from the path; ownership is checked against the cookie. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  return handle(async () => {
    const session = await requirePlayer();
    const { sessionId } = await params;
    return completeSession(session, { sessionId });
  });
}
