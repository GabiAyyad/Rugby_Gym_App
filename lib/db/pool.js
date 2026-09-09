import 'server-only';
import pg from 'pg';
import { env } from '@/lib/env';

/**
 * The one connection pool in the app. Every query goes through this — there is
 * no per-request client, no RLS, no anon key: the Postgres credential is a
 * private secret that only this server process holds.
 *
 * Two type parsers matter here:
 *  - DATE (oid 1082) is returned as the raw 'YYYY-MM-DD' string, not parsed
 *    into a JS Date. node-postgres defaults to a Date at local midnight, which
 *    is exactly the DST-shifting bug lib/domain/week.js exists to avoid — every
 *    date in this app is a string end to end (see docs/ARCHITECTURE.md).
 *  - NUMERIC (oid 1700) is parsed to a JS number. Postgres sends numeric as
 *    text by default (pg leaves it a string to avoid float rounding surprises
 *    on money); weight_used has no such precision concerns and the rest of the
 *    app expects a number.
 */
pg.types.setTypeParser(1082, (value) => value);
pg.types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));

let cached = null;

/** Lazily creates (once) and returns the shared connection pool. */
export function pool() {
  if (!cached) {
    cached = new pg.Pool({ connectionString: env.databaseUrl, max: 10 });
  }
  return cached;
}

/** Run one query. Prefer this for anything that is not part of a transaction. */
export async function query(text, params = []) {
  return pool().query(text, params);
}

/**
 * Run a series of statements against one client inside BEGIN/COMMIT. `fn`
 * receives a client with the same `.query(text, params)` shape as the pool.
 */
export async function withTransaction(fn) {
  const client = await pool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
