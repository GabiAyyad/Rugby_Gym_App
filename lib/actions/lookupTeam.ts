import 'server-only';
import { ActionError } from '@/lib/http';
import { countTeamAdmins, findTeamByLoginCode, listTeamRoster } from '@/lib/supabase/queries/auth';
import type { PositionGroup } from '@/types/database';

export interface RosterEntry {
  id: string;
  name: string;
  positionGroup: PositionGroup | null;
  isAdmin: boolean;
  isPlayer: boolean;
}

export interface LookupTeamResult {
  teamId: string;
  teamName: string;
  /** True when the team has no admin yet — the login screen offers to create one. */
  needsAdminSetup: boolean;
  roster: RosterEntry[];
}

/**
 * Step one of login: a team code exchanges for that team's roster. The code is
 * the shared secret here, but the PIN hash never leaves the server — so seeing
 * the roster does not get you an admin account.
 */
export async function lookupTeam(loginCode: string): Promise<LookupTeamResult> {
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
