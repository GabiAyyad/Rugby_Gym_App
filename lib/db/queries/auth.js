import 'server-only';
import { many, one } from '@/lib/db/helpers';

/** Looks up a team by its login code (case-insensitive) — step one of signing in. */
export async function findTeamByLoginCode(code) {
  return one('select * from teams where login_code ilike $1 limit 1', [code.trim()]);
}

/** The full roster (players + admins) for one team, alphabetical by name. */
export async function listTeamRoster(teamId) {
  return many('select * from players where team_id = $1 order by name', [teamId]);
}

/** Looks up one player, scoped to a team — used to prove a chosen player id actually belongs to that team. */
export async function findPlayerInTeam(teamId, playerId) {
  return one('select * from players where team_id = $1 and id = $2', [teamId, playerId]);
}

/** How many admins a team currently has — 0 means the "set up the first admin" flow is still open. */
export async function countTeamAdmins(teamId) {
  const row = await one(
    'select count(*)::int as count from players where team_id = $1 and is_admin = true',
    [teamId],
  );
  return row?.count ?? 0;
}

/** Creates the team's first admin (is_admin: true, is_player: false, no position group). */
export async function insertAdminPlayer({ teamId, name, pinHash }) {
  return one(
    `insert into players (team_id, name, is_admin, is_player, position_group, admin_pin_hash)
     values ($1, $2, true, false, null, $3)
     returning *`,
    [teamId, name, pinHash],
  );
}
