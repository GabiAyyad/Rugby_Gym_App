import 'server-only';
import { ActionError } from '@/lib/http';
import { countTeamAdmins, findTeamByLoginCode, listTeamRoster } from '@/lib/db/queries/auth';

/**
 * Step one of login: a team code exchanges for that team's roster. The code is
 * the shared secret here, but the PIN hash never leaves the server — so seeing
 * the roster does not get you an admin account.
 */
/**
 * `loginCode` -> that team's public info + roster. `needsAdminSetup` tells the
 * login screen whether to offer "Set up the first admin account" (true only
 * while the team has zero admins — see bootstrapAdmin.js). Note this returns
 * names and roles for the whole roster, but never `admin_pin_hash`.
 */
export async function lookupTeam(loginCode) {
  const code = loginCode.trim();
  if (!code) throw new ActionError('Enter your team code.', 400);

  const team = await findTeamByLoginCode(code);
  if (!team) throw new ActionError('That team code was not recognised.', 404);

  const [roster, adminCount] = await Promise.all([listTeamRoster(team.id), countTeamAdmins(team.id)]);

  return {
    teamId: team.id,
    teamName: team.name,
    needsAdminSetup: adminCount === 0,
    roster: roster.map((player) => ({
      id: player.id,
      name: player.name,
      positionGroup: player.position_group,
      isAdmin: player.is_admin,
      isPlayer: player.is_player,
    })),
  };
}
