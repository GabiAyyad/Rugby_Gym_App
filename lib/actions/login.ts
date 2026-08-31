import 'server-only';
import { landingPath } from '@/lib/auth';
import { ActionError } from '@/lib/http';
import { verifyPin } from '@/lib/pin';
import { createSession } from '@/lib/session';
import { findPlayerInTeam, findTeamByLoginCode } from '@/lib/supabase/queries/auth';
import type { SessionUser } from '@/types/common';

/**
 * PIN attempt throttling. In-process, so on serverless it is per-instance rather
 * than global — with a 4-8 digit PIN sitting behind a team code and ~40 users,
 * that is a proportionate speed bump rather than a claim of rate-limiting rigour.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function checkThrottle(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    throw new ActionError('Too many incorrect PIN attempts. Try again in 15 minutes.', 429);
  }
}

export interface LoginInput {
  loginCode: string;
  playerId: string;
  pin?: string | null;
}

export interface LoginResult {
  redirectTo: string;
  user: SessionUser;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const team = await findTeamByLoginCode(input.loginCode);
  if (!team) throw new ActionError('That team code was not recognised.', 404);

  const player = await findPlayerInTeam(team.id, input.playerId);
  if (!player) throw new ActionError('That player is not on this team.', 404);

  if (player.is_admin) {
    checkThrottle(player.id);
    const pin = (input.pin ?? '').trim();
    if (!pin) throw new ActionError('Enter the admin PIN.', 400, { pin: 'Required for admin accounts.' });
    if (!verifyPin(pin, player.admin_pin_hash)) {
      throw new ActionError('Incorrect PIN.', 401, { pin: 'Incorrect PIN.' });
    }
    attempts.delete(player.id);
  }

  const user: SessionUser = {
    playerId: player.id,
    teamId: team.id,
    teamName: team.name,
    name: player.name,
    isAdmin: player.is_admin,
    isPlayer: player.is_player,
    positionGroup: player.position_group,
  };

  await createSession(user);
  return { redirectTo: landingPath(user), user };
}
