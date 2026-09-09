import 'server-only';

/**
 * Wraps a Postgres error thrown by `pg`. Kept distinct from a plain Error so
 * lib/http.js can tell "the database misbehaved" apart from "the caller's
 * request was bad" without inspecting error messages.
 */
export class DataError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'DataError';
    this.cause = cause ?? null;
  }
}

/** Postgres unique-violation, e.g. a duplicate player name inside a team. */
export function isUniqueViolation(error) {
  return error instanceof DataError && error.cause?.code === '23505';
}

/**
 * Both codes matter: a plain FK violation is 23503, but a RESTRICT reference —
 * which is how program_exercises pins an exercise in the library — raises 23001.
 */
export function isForeignKeyViolation(error) {
  return error instanceof DataError && (error.cause?.code === '23503' || error.cause?.code === '23001');
}

/** Postgres check-constraint violation, e.g. an admin player with no PIN hash. Not currently used by any action, but available for callers that want a friendlier message than a raw 500. */
export function isCheckViolation(error) {
  return error instanceof DataError && error.cause?.code === '23514';
}
