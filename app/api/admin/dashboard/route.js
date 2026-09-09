// Backs the admin adherence dashboard's live re-sort/re-filter (the initial
// load comes from app/admin/dashboard/page.js calling the action directly;
// this route exists so <AdherenceTable> could re-fetch with different query
// params without a full page reload, if it ever needs to).
import { getAdherenceDashboard } from '@/lib/actions/getAdherenceDashboard';
import { requireAdmin } from '@/lib/auth';
import { handle, parseQuery } from '@/lib/http';
import { optionalEnum } from '@/lib/validate';

/**
 * GET ?positionGroup=forward|back|all&sort=risk|name|adherence|lastLog ->
 * the AdherenceDashboard for the caller's team, filtered/sorted as requested.
 */
export async function GET(request) {
  return handle(async () => {
    const session = await requireAdmin();
    const query = parseQuery(request);
    const positionGroup = optionalEnum(query.positionGroup, ['forward', 'back', 'all'], 'positionGroup');
    const sort = optionalEnum(query.sort, ['risk', 'name', 'adherence', 'lastLog'], 'sort');
    return getAdherenceDashboard(session, {
      positionGroup: positionGroup === 'all' ? null : (positionGroup ?? null),
      sort,
    });
  });
}
