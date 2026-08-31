import { getSessionDetail } from '@/lib/actions/getSessionDetail';
import { requirePlayerPage } from '@/lib/auth';
import { ActionError } from '@/lib/http';
import { SessionRunner } from '@/components/player/SessionRunner';
import type { SessionDetail } from '@/types/session';

export const dynamic = 'force-dynamic';

export default async function LogSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await requirePlayerPage();

  // An id the server does not know is not necessarily wrong: a session started
  // with no signal carries a locally minted id until the queue is replayed. The
  // runner falls back to this phone's cache in that case.
  let detail: SessionDetail | null = null;
  try {
    detail = await getSessionDetail(session, sessionId);
  } catch (caught) {
    if (!(caught instanceof ActionError) || caught.status !== 404) throw caught;
  }

  return <SessionRunner sessionId={sessionId} initialDetail={detail} />;
}
