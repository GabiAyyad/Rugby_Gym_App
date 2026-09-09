import 'server-only';
import { landingPath } from '@/lib/auth';
import { ActionError } from '@/lib/http';
import { verifyPin } from '@/lib/pin';
import { createSession } from '@/lib/session';
import { findPlayerInTeam, findTeamByLoginCode } from '@/lib/db/queries/auth';

/**
 * PIN attempt throttling. In-process, so on serverless it is per-instance rather
 * than global — with a 4-8 digit PIN sitting behind a team code and ~40 users,
 * that is a proportionate speed bump rather than a claim of rate-limiting rigour.
 */
const attempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Records one PIN attempt for `key` (an admin player id) and throws once that
 * player has failed more than MAX_ATTEMPTS times inside the rolling WINDOW_MS
 * window. Resets the counter once the window has fully elapsed.
 */
function checkThrottle(key) {
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

/**
 * Step two of login (after lookupTeam): the player picked a name from the
 * roster, so sign them in. `input` is `{ loginCode, playerId, pin }` — the
 * PIN is required and checked only when the chosen player is an admin.
 *
 * On success, writes the signed session cookie and returns where to send the
 * browser next (`landingPath`). Every failure path uses a 404 for "team code
 * wrong" / "player not on this team" and a 401 for "PIN wrong", so a caller
 * can't distinguish "no such player" from "wrong PIN" and enumerate the roster.
 */
export async function login(input) {
  const team = await findTeamByLoginCode(input.loginCode);
  if (!team) throw new ActionError('That team code was not recognised.', 404);

  // Re-validates that `playerId` actually belongs to `team` — a request that
  // sends a real player id from a different team is rejected here.
  const player = await findPlayerInTeam(team.id, input.playerId);
  if (!player) throw new ActionError('That player is not on this team.', 404);

  if (player.is_admin) {
    checkThrottle(player.id);
    const pin = (input.pin ?? '').trim();
    if (!pin) throw new ActionError('Enter the admin PIN.', 400, { pin: 'Required for admin accounts.' });
    if (!verifyPin(pin, player.admin_pin_hash)) {
      throw new ActionError('Incorrect PIN.', 401, { pin: 'Incorrect PIN.' });
    }
    // A successful login clears any accumulated failed-attempt count.
    attempts.delete(player.id);
  }

  // This is the SessionUser shape that gets signed into the cookie — see
  // lib/session.js. Role flags and team_id come from the database row just
  // looked up, never from the request body.
  const user = {
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
