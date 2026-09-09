import 'server-only';
import { listTeamPlayers } from '@/lib/db/queries/players';

/**
 * Row -> contract. Lives here rather than in the query module because queries
 * return rows and actions return contracts; the sibling player actions import
 * it. The one rule it enforces: `admin_pin_hash` never crosses this boundary,
 * the client only ever learns whether a PIN exists.
 */
/** Converts one raw `players` table row into the client-facing Player shape. */
export function toPlayer(row) {
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

const POSITION_RANK = { forward: 0, back: 1 };

/** Coaches at the top, then forwards, then backs, alphabetical inside each. */
function byRoleThenPosition(a, b) {
  if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
  const rankA = a.positionGroup ? POSITION_RANK[a.positionGroup] : 2;
  const rankB = b.positionGroup ? POSITION_RANK[b.positionGroup] : 2;
  if (rankA !== rankB) return rankA - rankB;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

/** The whole roster for the caller's own team (session.teamId), sorted for the admin Players screen. */
export async function listPlayers(session) {
  const rows = await listTeamPlayers(session.teamId);
  return { players: rows.map(toPlayer).sort(byRoleThenPosition) };
}
