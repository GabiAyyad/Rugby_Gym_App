import 'server-only';
import { redirect } from 'next/navigation';
import type { SessionUser } from '@/types/common';
import { readSession } from '@/lib/session';

/**
 * Access control, in one place.
 *
 * Every action takes the caller's SessionUser as its first argument rather than
 * reading a team_id or role off the request — so team isolation is a type-level
 * requirement, not a convention someone can forget.
 */

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/* ---------------------------------------------------- route handlers (throw) */

export async function requireSession(): Promise<SessionUser> {
  const session = await readSession();
  if (!session) throw new AuthError('Not signed in.', 401);
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (!session.isAdmin) throw new AuthError('Admin access required.', 403);
  return session;
}

export async function requirePlayer(): Promise<SessionUser> {
  const session = await requireSession();
  if (!session.isPlayer) throw new AuthError('This account does not have a training profile.', 403);
  return session;
}

/* ------------------------------------------------------------ pages (redirect) */

export async function requireSessionPage(): Promise<SessionUser> {
  const session = await readSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireAdminPage(): Promise<SessionUser> {
  const session = await requireSessionPage();
  if (!session.isAdmin) redirect('/player/today');
  return session;
}

export async function requirePlayerPage(): Promise<SessionUser> {
  const session = await requireSessionPage();
  if (!session.isPlayer) redirect('/admin/dashboard');
  return session;
}

/** Where a freshly signed-in user should land. */
export function landingPath(session: SessionUser): string {
  return session.isAdmin ? '/admin/dashboard' : '/player/today';
}
