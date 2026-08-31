import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import type { ApiResult } from '@/types/common';
import { AuthError } from '@/lib/auth';
import { DataError, isForeignKeyViolation, isUniqueViolation } from '@/lib/supabase/queries';

/**
 * Route handlers stay thin: parse, call one action, return. All the error
 * translation lives here so no route re-implements it.
 */

/** Throw from an action to return a specific message and status to the client. */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ActionError';
  }
}

export function ok<T>(data: T, status = 200): NextResponse<ApiResult<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(
  error: string,
  status = 400,
  fieldErrors?: Record<string, string>,
): NextResponse<ApiResult<never>> {
  return NextResponse.json({ ok: false, error, fieldErrors }, { status });
}

function flatten(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** Wrap a route handler body; turns thrown errors into the ApiResult envelope. */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse<ApiResult<T>>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message, error.status);
    if (error instanceof ActionError) return fail(error.message, error.status, error.fieldErrors);
    if (error instanceof ZodError) return fail('Check the highlighted fields.', 422, flatten(error));
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

/** Parse a JSON request body against a schema, or throw a ZodError for `handle`. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ActionError('Expected a JSON body.', 400);
  }
  return schema.parse(json);
}

export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return schema.parse(params);
}
