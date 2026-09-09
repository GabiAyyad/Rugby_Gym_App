// Clones an entire training block (days, exercises, sets, reps, rest, notes)
// onto new dates — the "duplicate this month's block for next month" action.
import { duplicateProgram } from '@/lib/actions/duplicateProgram';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';
import { optionalISODate, optionalString, requireUUID } from '@/lib/validate';

/**
 * POST { name?, startDate? } -> the new Program. Both fields are optional:
 * name defaults to "<source> (copy)" and startDate to the day after the
 * source block ends (see duplicateProgram for the exact defaulting logic).
 */
export async function POST(request, context) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = await context.params;
    requireUUID(id, 'id');
    const body = await parseBody(request);
    const input = {
      name: optionalString(body.name, 'name', { max: 80 }) ?? null,
      startDate: optionalISODate(body.startDate, 'startDate') ?? null,
    };
    return duplicateProgram(session, { id, ...input });
  });
}
