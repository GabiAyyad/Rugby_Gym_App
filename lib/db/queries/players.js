import 'server-only';
import { many, one } from '@/lib/db/helpers';

/**
 * Roster access. Every function takes a teamId and puts it in the WHERE clause
 * on purpose: this pool connects with one shared credential and there is no
 * RLS in front of it, so this filter is the only thing keeping the two squads
 * apart. There is deliberately no "find player by id" here — an id on its own
 * is never enough to reach a row.
 */

export async function listTeamPlayers(teamId) {
  return many('select * from players where team_id = $1 order by name', [teamId]);
}

export async function findTeamPlayer(teamId, playerId) {
  return one('select * from players where team_id = $1 and id = $2', [teamId, playerId]);
}

/** Ids rather than a count, so callers can tell "the last admin" from "you". */
export async function listTeamAdminIds(teamId) {
  const rows = await many('select id from players where team_id = $1 and is_admin = true', [teamId]);
  return rows.map((row) => row.id);
}

export async function insertTeamPlayer(teamId, write) {
  return one(
    `insert into players (team_id, name, position_group, is_admin, is_player, admin_pin_hash)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [teamId, write.name, write.positionGroup, write.isAdmin, write.isPlayer, write.adminPinHash],
  );
}

/** Returns null when no row matched — i.e. that id belongs to another team. */
export async function updateTeamPlayer(teamId, playerId, write) {
  // adminPinHash === undefined means "leave the stored hash untouched" (update
  // only), so it is left out of the SET list entirely rather than written as null.
  const setPin = write.adminPinHash !== undefined;
  return one(
    `update players
        set name = $3,
            position_group = $4,
            is_admin = $5,
            is_player = $6
            ${setPin ? ', admin_pin_hash = $7' : ''}
      where team_id = $1 and id = $2
      returning *`,
    setPin
      ? [teamId, playerId, write.name, write.positionGroup, write.isAdmin, write.isPlayer, write.adminPinHash]
      : [teamId, playerId, write.name, write.positionGroup, write.isAdmin, write.isPlayer],
  );
}

/** Cascades to the player's sessions and logs (see the FKs in the init migration). */
export async function deleteTeamPlayer(teamId, playerId) {
  return one('delete from players where team_id = $1 and id = $2 returning *', [teamId, playerId]);
}
