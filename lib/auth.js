import 'server-only';
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/session';

/**
 * Access control, in one place.
 *
 * Every action takes the caller's SessionUser as its first argument rather than
 * reading a team_id or role off the request — so team isolation is a type-level
 * requirement in the TS original, and here a hard convention every action
 * follows: never accept teamId/playerId/role flags from request input.
 */

/** Thrown by the require*() helpers below; lib/http.js turns this into the right HTTP status. */
export class AuthError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/* ---------------------------------------------------- route handlers (throw) */

/** Returns the signed-in SessionUser, or throws a 401 AuthError. Used by API routes. */
export async function requireSession() {
  const session = await readSession();
  if (!session) throw new AuthError('Not signed in.', 401);
  return session;
}

/** Like requireSession, but also throws a 403 if the caller isn't an admin. */
export async function requireAdmin() {
  const session = await requireSession();
  if (!session.isAdmin) throw new AuthError('Admin access required.', 403);
  return session;
}

/** Like requireSession, but also throws a 403 if the caller has no player (training) profile. */
export async function requirePlayer() {
  const session = await requireSession();
  if (!session.isPlayer) throw new AuthError('This account does not have a training profile.', 403);
  return session;
}

/* ------------------------------------------------------------ pages (redirect) */

/** Page-component version of requireSession: redirects to /login instead of throwing. */
export async function requireSessionPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  return session;
}

/** Page-component version of requireAdmin: redirects a non-admin to their own "today" page instead of throwing. */
export async function requireAdminPage() {
  const session = await requireSessionPage();
  if (!session.isAdmin) redirect('/player/today');
  return session;
}

/** Page-component version of requirePlayer: redirects a non-player to the admin dashboard instead of throwing. */
export async function requirePlayerPage() {
  const session = await requireSessionPage();
  if (!session.isPlayer) redirect('/admin/dashboard');
  return session;
}

/** Where a freshly signed-in user should land. */
export function landingPath(session) {
  return session.isAdmin ? '/admin/dashboard' : '/player/today';
}
