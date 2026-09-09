import 'server-only';
import { query } from './pool';
import { DataError } from './errors';

/**
 * Run a query, wrapping any Postgres error as a DataError so lib/http.js can
 * translate it uniformly (see isUniqueViolation / isForeignKeyViolation).
 */
export async function run(text, params = []) {
  try {
    return await query(text, params);
  } catch (error) {
    throw new DataError(error.message, error);
  }
}

/** First row, or null. */
export async function one(text, params = []) {
  const result = await run(text, params);
  return result.rows[0] ?? null;
}

/** All rows from a query (empty array if none matched). */
export async function many(text, params = []) {
  const result = await run(text, params);
  return result.rows;
}

/**
 * Builds `($1, $2), ($3, $4), ...` for a bulk INSERT, and flattens `rows` (each
 * an array of column values, in the same order for every row) into one params
 * array. `startAt` lets a caller reserve earlier placeholders for other values.
 */
export function valuesList(rows, startAt = 1) {
  let n = startAt;
  const params = [];
  const groups = rows.map((row) => {
    const placeholders = row.map(() => `$${n++}`);
    params.push(...row);
    return `(${placeholders.join(', ')})`;
  });
  return { sql: groups.join(', '), params };
}
