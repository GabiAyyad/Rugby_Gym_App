// Admin-only collection endpoint for training blocks ("programs"): list this
// team's blocks, or create a new one with its full days/exercises payload.
import { createProgram } from '@/lib/actions/createProgram';
import { listPrograms } from '@/lib/actions/listPrograms';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';
import { parseProgramInput } from '@/lib/validate';

/** GET -> every block belonging to the caller's team, with `isActive` derived per-block. */
export async function GET() {
  return handle(async () => {
    const session = await requireAdmin();
    return listPrograms(session);
  });
}

/**
 * POST { positionGroup, name, startDate, endDate, isActiveOverride, days } ->
 * the new Program, days and all. `days` is validated in full by
 * parseProgramInput (see lib/validate.js) before the action ever runs.
 */
export async function POST(request) {
  return handle(async () => {
    const session = await requireAdmin();
    const input = parseProgramInput(await parseBody(request));
    return createProgram(session, input);
  });
}
