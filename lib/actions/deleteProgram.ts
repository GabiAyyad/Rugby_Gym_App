import 'server-only';
import { ActionError } from '@/lib/http';
import type { SessionUser } from '@/types/common';
import type { DeleteProgramInput } from '@/types/program';
import { deleteProgramForTeam } from '@/lib/supabase/queries/programs';

/**
 * Remove a training block.
 *
 * The delete carries team_id in its filter, so an id belonging to the other
 * squad matches nothing and comes back as a 404 rather than deleting their
 * programming.
 *
 * Postgres cascades from here: program_days, then program_exercises, then any
 * sessions logged against those days and the logs inside them. That is real
 * training history, so the confirm dialog in the UI says so in as many words.
 */
export async function deleteProgram(
  session: SessionUser,
  input: DeleteProgramInput,
): Promise<{ id: string }> {
  const deleted = await deleteProgramForTeam(session.teamId, input.id);
  if (!deleted) throw new ActionError('That training block was not found.', 404);
  return { id: deleted };
}
