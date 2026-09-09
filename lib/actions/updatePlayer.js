import 'server-only';
import { ActionError } from '@/lib/http';
import { hashPin, isValidPinFormat } from '@/lib/pin';
import { isUniqueViolation } from '@/lib/db/errors';
import { findTeamPlayer, listTeamAdminIds, updateTeamPlayer } from '@/lib/db/queries/players';
import { toPlayer } from './listPlayers';

/**
 * Edits a player on the caller's own squad.
 *
 * PIN rules: an empty `adminPin` leaves the stored hash alone, a supplied one
 * replaces it, and dropping the admin role clears it — so re-promoting someone
 * always requires setting a fresh PIN rather than silently reviving an old one.
 */
/**
 * `input` is `{ id, name, positionGroup, isAdmin, isPlayer, adminPin }`.
 * Blocks demoting the team's last remaining admin (see the check below), and
 * re-validates every field the same way createPlayer does.
 */
export async function updatePlayer(session, input) {
  // findTeamPlayer filters on session.teamId too, so an id from the other
  // squad simply doesn't match and comes back as a 404 here.
  const existing = await findTeamPlayer(session.teamId, input.id);
  if (!existing) throw new ActionError('That player is not on your team.', 404);

  const name = input.name.trim();
  const pin = (input.adminPin ?? '').trim();
  const fieldErrors = {};

  if (name.length < 2) fieldErrors.name = 'Enter a name.';
  if (!input.isAdmin && !input.isPlayer) fieldErrors.isPlayer = 'Pick at least one role.';
  if (input.isPlayer && !input.positionGroup) {
    fieldErrors.positionGroup = 'Anyone who trains needs a position group.';
  }
  if (pin && !isValidPinFormat(pin)) {
    fieldErrors.adminPin = 'PIN must be 4-8 digits.';
  } else if (input.isAdmin && !pin && existing.admin_pin_hash === null) {
    fieldErrors.adminPin = 'Set a PIN so they can sign in as an admin.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ActionError('Check the highlighted fields.', 422, fieldErrors);
  }

  if (existing.is_admin && !input.isAdmin) {
    const adminIds = await listTeamAdminIds(session.teamId);
    if (adminIds.length <= 1) {
      throw new ActionError(
        `${existing.name} is the only admin on this team. Give someone else admin access first.`,
        409,
      );
    }
  }

  // undefined => leave the stored hash untouched.
  const adminPinHash = !input.isAdmin ? null : pin ? hashPin(pin) : undefined;

  try {
    const row = await updateTeamPlayer(session.teamId, input.id, {
      name,
      positionGroup: input.positionGroup,
      isAdmin: input.isAdmin,
      isPlayer: input.isPlayer,
      adminPinHash,
    });
    if (!row) throw new ActionError('That player is not on your team.', 404);
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
