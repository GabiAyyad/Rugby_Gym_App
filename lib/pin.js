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

/** True if `pin` is 4-8 digits (the only format the app accepts). */
export function isValidPinFormat(pin) {
  return PIN_PATTERN.test(pin);
}

/**
 * Hashes a PIN with scrypt and a fresh random salt, returning a single string
 * that encodes the scheme, cost, salt and derived key together
 * ("scrypt$<cost>$<salt>$<hash>") so verifyPin can check it without any other
 * stored parameters.
 */
export function hashPin(pin) {
  if (!isValidPinFormat(pin)) throw new Error('PIN must be 4–8 digits.');
  const salt = randomBytes(16);
  const derived = scryptSync(pin, salt, KEY_LENGTH, { N: SCRYPT_COST });
  return `scrypt$${SCRYPT_COST}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/**
 * Checks a plaintext PIN against a hash produced by hashPin(). Uses
 * timingSafeEqual so the comparison takes the same time whether the PIN is
 * close to correct or completely wrong, which avoids leaking information
 * through response-time differences.
 */
export function verifyPin(pin, stored) {
  if (!stored) return false;
  const [scheme, cost, salt, digest] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  try {
    const expected = Buffer.from(digest, 'base64');
    const actual = scryptSync(pin, Buffer.from(salt, 'base64'), expected.length, { N: Number(cost) });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
