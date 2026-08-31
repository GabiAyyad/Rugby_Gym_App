import 'server-only';
import { ActionError } from '@/lib/http';
import { hashPin, isValidPinFormat } from '@/lib/pin';
import { isUniqueViolation } from '@/lib/supabase/queries';
import { insertTeamPlayer } from '@/lib/supabase/queries/players';
import type { SessionUser } from '@/types/common';
import type { CreatePlayerInput, Player } from '@/types/player';
import { toPlayer } from './listPlayers';

/**
 * Adds someone to the caller's own squad. The team is taken from the session,
 * never from the request, so an admin physically cannot create a player on the
 * other team.
 *
 * The three checks below mirror the CHECK constraints in the init migration
 * (players_has_a_role, players_admin_requires_pin, players_playing_requires_position)
 * so the user gets a field-level message instead of a 500 from Postgres.
 */
export async function createPlayer(session: SessionUser, input: CreatePlayerInput): Promise<Player> {
  const name = input.name.trim();
  const pin = (input.adminPin ?? '').trim();
  const fieldErrors: Record<string, string> = {};

  if (name.length < 2) fieldErrors.name = 'Enter a name.';
  if (!input.isAdmin && !input.isPlayer) fieldErrors.isPlayer = 'Pick at least one role.';
  if (input.isPlayer && !input.positionGroup) {
    fieldErrors.positionGroup = 'Anyone who trains needs a position group.';
  }
  if (input.isAdmin && !pin) fieldErrors.adminPin = 'Admins need a PIN to sign in.';
  else if (input.isAdmin && !isValidPinFormat(pin)) fieldErrors.adminPin = 'PIN must be 4-8 digits.';

  if (Object.keys(fieldErrors).length > 0) {
    throw new ActionError('Check the highlighted fields.', 422, fieldErrors);
  }

  try {
    const row = await insertTeamPlayer(session.teamId, {
      name,
      positionGroup: input.positionGroup,
      isAdmin: input.isAdmin,
      isPlayer: input.isPlayer,
      adminPinHash: input.isAdmin ? hashPin(pin) : null,
    });
    return toPlayer(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ActionError(`${name} is already on this team.`, 409, {
        name: 'That name is already on the roster.',
      });
    }
    throw error;
  }
}
