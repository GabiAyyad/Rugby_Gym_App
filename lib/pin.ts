import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Admin PINs. The team login code gets you the roster; it must not get you the
 * coach's account, so admin selection additionally requires a PIN. Stored as
 * scrypt(salt, pin) — never plaintext, never reversible, never sent to the client.
 */

const KEY_LENGTH = 32;
const SCRYPT_COST = 16384;

export const PIN_PATTERN = /^\d{4,8}$/;

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function hashPin(pin: string): string {
  if (!isValidPinFormat(pin)) throw new Error('PIN must be 4–8 digits.');
  const salt = randomBytes(16);
  const derived = scryptSync(pin, salt, KEY_LENGTH, { N: SCRYPT_COST });
  return `scrypt$${SCRYPT_COST}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, cost, salt, digest] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  try {
    const expected = Buffer.from(digest, 'base64');
    const actual = scryptSync(pin, Buffer.from(salt, 'base64'), expected.length, { N: Number(cost) });
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
