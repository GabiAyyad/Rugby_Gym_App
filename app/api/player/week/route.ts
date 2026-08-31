import { getWeekView } from '@/lib/actions/getWeekView';
import { requirePlayer } from '@/lib/auth';
import { handle } from '@/lib/http';

export async function GET() {
  return handle(async () => getWeekView(await requirePlayer()));
}
