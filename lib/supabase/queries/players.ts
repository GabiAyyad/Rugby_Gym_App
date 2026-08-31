import 'server-only';
import { db } from '@/lib/supabase/client';
import type { PlayerRow, PositionGroup } from '@/types/database';
import { unwrap, unwrapMaybe } from './index';

/**
 * Roster access. Every function takes a teamId and puts it in the WHERE clause
 * on purpose: the service-role client bypasses RLS, so this filter is the only
 * thing keeping the two squads apart. There is deliberately no "find player by
 * id" here — an id on its own is never enough to reach a row.
 */

export interface PlayerWrite {
  name: string;
  positionGroup: PositionGroup | null;
  isAdmin: boolean;
  isPlayer: boolean;
  /**
   * `undefined` leaves an existing hash untouched (update only), `null` clears
   * it, a string replaces it. Hashing happens in lib/pin.ts, never here.
   */
  adminPinHash?: string | null;
}

export async function listTeamPlayers(teamId: string): Promise<PlayerRow[]> {
  return unwrap(
    await db().from('players').select('*').eq('team_id', teamId).order('name'),
    'listTeamPlayers',
  );
}

export async function findTeamPlayer(teamId: string, playerId: string): Promise<PlayerRow | null> {
  return unwrapMaybe(
    await db().from('players').select('*').eq('team_id', teamId).eq('id', playerId).maybeSingle(),
    'findTeamPlayer',
  );
}

/** Ids rather than a count, so callers can tell "the last admin" from "you". */
export async function listTeamAdminIds(teamId: string): Promise<string[]> {
  const rows = unwrap(
    await db().from('players').select('id').eq('team_id', teamId).eq('is_admin', true),
    'listTeamAdminIds',
  );
  return rows.map((row) => row.id);
}

export async function insertTeamPlayer(
  teamId: string,
  write: PlayerWrite & { adminPinHash: string | null },
): Promise<PlayerRow> {
  return unwrap(
    await db()
      .from('players')
      .insert({
        team_id: teamId,
        name: write.name,
        position_group: write.positionGroup,
        is_admin: write.isAdmin,
        is_player: write.isPlayer,
        admin_pin_hash: write.adminPinHash,
      })
      .select('*')
      .single(),
    'insertTeamPlayer',
  );
}

/** Returns null when no row matched — i.e. that id belongs to another team. */
export async function updateTeamPlayer(
  teamId: string,
  playerId: string,
  write: PlayerWrite,
): Promise<PlayerRow | null> {
  const patch: {
    name: string;
    position_group: PositionGroup | null;
    is_admin: boolean;
    is_player: boolean;
    admin_pin_hash?: string | null;
  } = {
    name: write.name,
    position_group: write.positionGroup,
    is_admin: write.isAdmin,
    is_player: write.isPlayer,
  };
  if (write.adminPinHash !== undefined) patch.admin_pin_hash = write.adminPinHash;

  return unwrapMaybe(
    await db()
      .from('players')
      .update(patch)
      .eq('team_id', teamId)
      .eq('id', playerId)
      .select('*')
      .maybeSingle(),
    'updateTeamPlayer',
  );
}

/** Cascades to the player's sessions and logs (see the FKs in the init migration). */
export async function deleteTeamPlayer(teamId: string, playerId: string): Promise<PlayerRow | null> {
  return unwrapMaybe(
    await db()
      .from('players')
      .delete()
      .eq('team_id', teamId)
      .eq('id', playerId)
      .select('*')
      .maybeSingle(),
    'deleteTeamPlayer',
  );
}
