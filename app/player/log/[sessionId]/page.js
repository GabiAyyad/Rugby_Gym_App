// The set-by-set logging screen for one session. Tries to load the session
// server-side for a fast first paint; if that fails (e.g. the session id is
// one this phone minted offline and hasn't synced yet), passes `detail: null`
// and lets <SessionRunner> recover it from the IndexedDB cache instead.
import { getSessionDetail } from '@/lib/actions/getSessionDetail';
import { requirePlayerPage } from '@/lib/auth';
import { ActionError } from '@/lib/http';
import { SessionRunner } from '@/components/player/SessionRunner';

export const dynamic = 'force-dynamic';

export default async function LogSessionPage({ params }) {
  const { sessionId } = await params;
  const session = await requirePlayerPage();

  // An id the server does not know is not necessarily wrong: a session started
  // with no signal carries a locally minted id until the queue is replayed. The
  // runner falls back to this phone's cache in that case.
  let detail = null;
  try {
    detail = await getSessionDetail(session, sessionId);
  } catch (caught) {
    if (!(caught instanceof ActionError) || caught.status !== 404) throw caught;
  }

  return <SessionRunner sessionId={sessionId} initialDetail={detail} />;
}
