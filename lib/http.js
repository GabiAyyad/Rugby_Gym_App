import 'server-only';
import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/auth';
import { DataError, isForeignKeyViolation, isUniqueViolation } from '@/lib/db/errors';

/**
 * Route handlers stay thin: parse, call one action, return. All the error
 * translation lives here so no route re-implements it.
 *
 * There is no schema library in this port — actions validate their own input
 * field by field and throw ActionError with fieldErrors, same as the shape a
 * schema library would produce. Route handlers only parse JSON.
 */

/** Throw from an action to return a specific message and status to the client. */
export class ActionError extends Error {
  constructor(message, status = 400, fieldErrors) {
    super(message);
    this.name = 'ActionError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Wraps a successful action result in the standard `{ ok: true, data }` envelope. */
export function ok(data, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/** Wraps an error in the standard `{ ok: false, error, fieldErrors? }` envelope. */
export function fail(error, status = 400, fieldErrors) {
  return NextResponse.json({ ok: false, error, fieldErrors }, { status });
}

/**
 * Wrap a route handler body; turns thrown errors into the ApiResult envelope.
 * Every route handler in app/api is a one-liner: `return handle(async () =>
 * { ...call an action... })`. Recognised error types are mapped to a specific
 * status/message; anything else is logged server-side and reported as a
 * generic 500 (so an unexpected bug never leaks its internals to the client).
 */
export async function handle(fn) {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message, error.status);
    if (error instanceof ActionError) return fail(error.message, error.status, error.fieldErrors);
    if (isUniqueViolation(error)) return fail('That already exists.', 409);
    if (isForeignKeyViolation(error)) return fail('That record is still in use elsewhere.', 409);
    if (error instanceof DataError) {
      console.error('[data]', error.message, error.cause);
      return fail('Something went wrong reaching the database.', 500);
    }
    console.error('[unhandled]', error);
    return fail('Something went wrong.', 500);
  }
}

/** Parse a JSON request body, or throw an ActionError for `handle`. */
export async function parseBody(request) {
  try {
    const json = await request.json();
    if (json === null || typeof json !== 'object' || Array.isArray(json)) {
      throw new ActionError('Expected a JSON object body.', 400);
    }
    return json;
  } catch (error) {
    if (error instanceof ActionError) throw error;
    throw new ActionError('Expected a JSON body.', 400);
  }
}

/** Reads a request's `?key=value` query string into a plain object of strings. */
export function parseQuery(request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
