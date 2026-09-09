// Player's main screen: this week's four training days, with the next
// unfinished one highlighted. All the interactive "start/continue a day"
// logic (including offline handling) lives in <WeekBoard>; this page just
// loads the initial week data server-side so it renders instantly.
import { getWeekView } from '@/lib/actions/getWeekView';
import { requirePlayerPage } from '@/lib/auth';
import { WeekBoard } from '@/components/player/WeekBoard';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const session = await requirePlayerPage();
  const week = await getWeekView(session);
  return <WeekBoard initial={week} />;
}
