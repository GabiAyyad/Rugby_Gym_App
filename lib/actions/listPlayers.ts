import 'server-only';
import { listTeamPlayers } from '@/lib/supabase/queries/players';
import type { SessionUser } from '@/types/common';
import type { PlayerRow, PositionGroup } from '@/types/database';
import type { ListPlayersResult, Player } from '@/types/player';

/**
 * Row -> contract. Lives here rather than in the query module because queries
 * return rows and actions return contracts; the sibling player actions import
 * it. The one rule it enforces: `admin_pin_hash` never crosses this boundary,
 * the client only ever learns whether a PIN exists.
 */
export function toPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    positionGroup: row.position_group,
    isAdmin: row.is_admin,
    isPlayer: row.is_player,
    hasAdminPin: row.admin_pin_hash !== null,
    leaderboardOptIn: row.leaderboard_opt_in,
    createdAt: row.created_at,
  };
}

const POSITION_RANK: Record<PositionGroup, number> = { forward: 0, back: 1 };

/** Coaches at the top, then forwards, then backs, alphabetical inside each. */
function byRoleThenPosition(a: Player, b: Player): number {
  if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
  const rankA = a.positionGroup ? POSITION_RANK[a.positionGroup] : 2;
  const rankB = b.positionGroup ? POSITION_RANK[b.positionGroup] : 2;
  if (rankA !== rankB) return rankA - rankB;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export async function listPlayers(session: SessionUser): Promise<ListPlayersResult> {
  const rows = await listTeamPlayers(session.teamId);
  return { players: rows.map(toPlayer).sort(byRoleThenPosition) };
}
