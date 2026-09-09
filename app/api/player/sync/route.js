import { syncLogs } from '@/lib/actions/syncLogs';
import { requirePlayer } from '@/lib/auth';
import { ActionError, handle, parseBody } from '@/lib/http';
import { isUUID } from '@/lib/validate';

const MAX_ENTRIES = 500;

/**
 * Batch replay of the offline queue. `clientId` is an opaque token minted on
 * the phone, not a database id, so it is only bounds-checked, not UUID-shaped.
 * Everything else that can vary in range (dates, set numbers, weights) is
 * re-checked per entry inside syncLogs, which rejects a bad entry without
 * failing the whole batch — this route only guards against a payload that
 * isn't even shaped like the queue (missing ids, wrong types).
 */
function parseEntry(entry, index) {
  if (typeof entry !== 'object' || entry === null) {
    throw new ActionError('Malformed sync entry.', 400, { entries: `Entry ${index} is malformed.` });
  }
  if (typeof entry.clientId !== 'string' || entry.clientId.length < 8 || entry.clientId.length > 64) {
    throw new ActionError('Malformed sync entry.', 400, { entries: `Entry ${index} has an invalid clientId.` });
  }
  if (typeof entry.queuedAt !== 'string' || entry.queuedAt.length < 4 || entry.queuedAt.length > 40) {
    throw new ActionError('Malformed sync entry.', 400, { entries: `Entry ${index} has an invalid queuedAt.` });
  }
  if (!isUUID(entry.programDayId) || !isUUID(entry.programExerciseId)) {
    throw new ActionError('Malformed sync entry.', 400, { entries: `Entry ${index} has an invalid id.` });
  }
  return {
    clientId: entry.clientId,
    queuedAt: entry.queuedAt,
    programDayId: entry.programDayId,
    date: entry.date,
    programExerciseId: entry.programExerciseId,
    setNumber: entry.setNumber,
    repsDone: entry.repsDone ?? null,
    weightUsed: entry.weightUsed ?? null,
    distanceOrTime: entry.distanceOrTime ?? null,
  };
}

/**
 * POST { entries: QueuedLog[] } -> { accepted, rejected, sessionIds }. The
 * endpoint the offline queue (lib/offline/useOfflineSync.js) calls to flush
 * whatever is sitting in IndexedDB. Safe to call repeatedly with overlapping
 * entries — syncLogs upserts on natural keys, so nothing duplicates.
 */
export async function POST(request) {
  return handle(async () => {
    const session = await requirePlayer();
    const body = await parseBody(request);
    const rawEntries = Array.isArray(body.entries) ? body.entries : [];
    if (rawEntries.length > MAX_ENTRIES) {
      throw new ActionError(`At most ${MAX_ENTRIES} entries per sync.`, 400);
    }
    const entries = rawEntries.map(parseEntry);
    return syncLogs(session, { entries });
  });
}
