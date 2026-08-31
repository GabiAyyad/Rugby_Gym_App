import 'server-only';
import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Shared low-level helpers for the per-feature query modules that sit beside
 * this file. Feature queries live in their own module (players.ts, programs.ts,
 * …) and are called only from lib/actions/*.
 */

export class DataError extends Error {
  constructor(
    message: string,
    readonly cause?: PostgrestError | null,
  ) {
    super(message);
    this.name = 'DataError';
  }
}

/**
 * A supabase-js response is a discriminated union of a success and a failure
 * branch. Inferring a bare `T` out of `data: T | null` against that union makes
 * TypeScript settle on `never`, so these helpers infer the whole response and
 * read the payload back off it instead.
 */
type PostgrestResult = { data: unknown; error: PostgrestError | null };

/** Unwrap a supabase-js result, turning its error branch into a thrown DataError. */
export function unwrap<R extends PostgrestResult>(result: R, context: string): NonNullable<R['data']> {
  if (result.error) throw new DataError(`${context}: ${result.error.message}`, result.error);
  if (result.data === null || result.data === undefined) {
    throw new DataError(`${context}: no data returned`);
  }
  return result.data as NonNullable<R['data']>;
}

export function unwrapMaybe<R extends PostgrestResult>(
  result: R,
  context: string,
): NonNullable<R['data']> | null {
  if (result.error) throw new DataError(`${context}: ${result.error.message}`, result.error);
  return (result.data ?? null) as NonNullable<R['data']> | null;
}

/** Postgres unique-violation, e.g. a duplicate player name inside a team. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof DataError && error.cause?.code === '23505';
}

/**
 * Both codes matter: a plain FK violation is 23503, but a RESTRICT reference —
 * which is how program_exercises pins an exercise in the library — raises 23001.
 * Verified against Postgres in scripts/check-schema.mjs.
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof DataError && (error.cause?.code === '23503' || error.cause?.code === '23001');
}

export function isCheckViolation(error: unknown): boolean {
  return error instanceof DataError && error.cause?.code === '23514';
}
