import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';

/**
 * The session is established server-side at login and signed into an httpOnly
 * cookie. Role flags and team_id are read from here and never from the request
 * body — a client that edits its own cookie fails signature verification.
 *
 * @typedef {object} SessionUser
 * @property {string} playerId
 * @property {string} teamId
 * @property {string} teamName
 * @property {string} name
 * @property {boolean} isAdmin
 * @property {boolean} isPlayer
 * @property {'forward'|'back'|null} positionGroup
 */

const COOKIE_NAME = 'rgt_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days — a season, not a gym visit

/** Encodes SESSION_SECRET into the byte key `jose` needs for HMAC signing/verifying. */
function secretKey() {
  return new TextEncoder().encode(env.sessionSecret);
}

/** Signs `user` into a JWT and sets it as the httpOnly session cookie. Called once, at login. */
export async function createSession(user) {
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

/**
 * Reads and verifies the session cookie. Returns null (never throws) for a
 * missing, expired, tampered, or otherwise invalid cookie — every caller
 * treats "no session" and "bad session" identically.
 * @returns {Promise<SessionUser|null>}
 */
export async function readSession() {
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
      positionGroup: payload.positionGroup ?? null,
    };
  } catch {
    return null;
  }
}

/** Clears the session cookie. Called on sign-out. */
export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
