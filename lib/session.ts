import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { SessionUser } from '@/types/common';
import type { PositionGroup } from '@/types/database';
import { env } from '@/lib/env';

/**
 * The session is established server-side at login and signed into an httpOnly
 * cookie. Role flags and team_id are read from here and never from the request
 * body — a client that edits its own cookie fails signature verification.
 */

const COOKIE_NAME = 'rgt_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days — a season, not a gym visit

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({
    teamId: user.teamId,
    teamName: user.teamName,
    name: user.name,
    isAdmin: user.isAdmin,
    isPlayer: user.isPlayer,
    positionGroup: user.positionGroup,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.playerId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (!payload.sub || typeof payload.teamId !== 'string') return null;
    return {
      playerId: payload.sub,
      teamId: payload.teamId,
      teamName: String(payload.teamName ?? ''),
      name: String(payload.name ?? ''),
      isAdmin: payload.isAdmin === true,
      isPlayer: payload.isPlayer === true,
      positionGroup: (payload.positionGroup as PositionGroup | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
