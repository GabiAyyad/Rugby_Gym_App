import { getWeekView } from '@/lib/actions/getWeekView';
import { requirePlayerPage } from '@/lib/auth';
import { WeekBoard } from '@/components/player/WeekBoard';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const session = await requirePlayerPage();
  const week = await getWeekView(session);
  return <WeekBoard initial={week} />;
}
