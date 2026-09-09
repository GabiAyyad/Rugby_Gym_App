// Re-fetch endpoint for the week board (the initial load comes from
// app/player/today/page.js calling getWeekView server-side directly).
// <WeekBoard> calls this after a sync finishes, so "in progress"/"done"
// reflect whatever the offline queue just pushed to the server.
import { getWeekView } from '@/lib/actions/getWeekView';
import { requirePlayer } from '@/lib/auth';
import { handle } from '@/lib/http';

/** GET -> the caller's current WeekView (this week's 4 days + progress). */
export async function GET() {
  return handle(async () => getWeekView(await requirePlayer()));
}
