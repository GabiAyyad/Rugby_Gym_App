import 'server-only';
import { ActionError } from '@/lib/http';
import { deleteTeamPlayer, findTeamPlayer, listTeamAdminIds } from '@/lib/supabase/queries/players';
import type { SessionUser } from '@/types/common';
import type { DeletePlayerInput } from '@/types/player';

/**
 * Removes a player from the caller's own squad, along with their sessions and
 * logs (the FKs cascade). Two doors are bolted shut: you cannot delete yourself,
 * and you cannot delete the last admin — either would leave the team unable to
 * administer itself.
 */
export async function deletePlayer(
  session: SessionUser,
  input: DeletePlayerInput,
): Promise<{ id: string }> {
  if (input.id === session.playerId) {
    throw new ActionError('You cannot delete your own account. Ask another admin to do it.', 409);
  }

  const existing = await findTeamPlayer(session.teamId, input.id);
  if (!existing) throw new ActionError('That player is not on your team.', 404);

  if (existing.is_admin) {
    const adminIds = await listTeamAdminIds(session.teamId);
    if (adminIds.length <= 1) {
      throw new ActionError(
        `${existing.name} is the only admin on this team. Add another admin before removing them.`,
        409,
      );
    }
  }

  const removed = await deleteTeamPlayer(session.teamId, input.id);
  if (!removed) throw new ActionError('That player is not on your team.', 404);
  return { id: removed.id };
}
