import 'server-only';
import { landingPath } from '@/lib/auth';
import { ActionError } from '@/lib/http';
import { hashPin, isValidPinFormat } from '@/lib/pin';
import { createSession } from '@/lib/session';
import { countTeamAdmins, findTeamByLoginCode, insertAdminPlayer } from '@/lib/supabase/queries/auth';
import type { SessionUser } from '@/types/common';

export interface BootstrapAdminInput {
  loginCode: string;
  name: string;
  pin: string;
}

/**
 * First-run only: creates the first admin for a team straight from the login
 * screen, so a fresh deployment needs no seeding script and no SQL console.
 * Hard-gated on the team having zero admins - once one exists this path is
 * closed and further admins are created from /admin/players.
 */
export async function bootstrapAdmin(input: BootstrapAdminInput): Promise<{ redirectTo: string }> {
  const team = await findTeamByLoginCode(input.loginCode);
  if (!team) throw new ActionError('That team code was not recognised.', 404);

  if ((await countTeamAdmins(team.id)) > 0) {
    throw new ActionError('This team already has an admin. Ask them to add your account.', 409);
  }

  const name = input.name.trim();
  if (name.length < 2) throw new ActionError('Enter your name.', 400, { name: 'Enter your name.' });
  if (!isValidPinFormat(input.pin)) {
    throw new ActionError('PIN must be 4-8 digits.', 400, { pin: 'PIN must be 4-8 digits.' });
  }

  const player = await insertAdminPlayer({ teamId: team.id, name, pinHash: hashPin(input.pin) });

  const user: SessionUser = {
    playerId: player.id,
    teamId: team.id,
    teamName: team.name,
    name: player.name,
    isAdmin: true,
    isPlayer: false,
    positionGroup: null,
  };
  await createSession(user);
  return { redirectTo: landingPath(user) };
}
