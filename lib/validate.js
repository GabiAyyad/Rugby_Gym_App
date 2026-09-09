import 'server-only';
import { ActionError } from '@/lib/http';
import { isISODate } from '@/lib/domain/week';

/**
 * There is no schema library in this port (see lib/http.js) — route handlers
 * validate the shapes that matter (ids, enums, dates) with these small
 * helpers, and leave field-by-field business messages ("enter a name") to the
 * actions, exactly as the original design intended for that half of the work.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if `value` is a syntactically valid UUID string (any version). */
export function isUUID(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Returns `value` if it's a UUID, otherwise throws a 400 ActionError naming `field`. */
export function requireUUID(value, field, message = 'Unknown id.') {
  if (!isUUID(value)) throw new ActionError(message, 400, { [field]: message });
  return value;
}

/** Returns `value` if it's a 'YYYY-MM-DD' date string, otherwise throws a 422 ActionError. */
export function requireISODate(value, field, message = 'Use a YYYY-MM-DD date.') {
  if (typeof value !== 'string' || !isISODate(value)) {
    throw new ActionError('Check the highlighted fields.', 422, { [field]: message });
  }
  return value;
}

/** Like requireISODate, but undefined/null/'' passes through as undefined (the field is optional). */
export function optionalISODate(value, field, message = 'Use a YYYY-MM-DD date.') {
  if (value === undefined || value === null || value === '') return undefined;
  return requireISODate(value, field, message);
}

/** Returns `value` if it's a boolean, otherwise throws a 422 ActionError. */
export function requireBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new ActionError('Check the highlighted fields.', 422, { [field]: 'Invalid value.' });
  }
  return value;
}

/** Returns `value` if it's one of `allowed`, otherwise throws a 422 ActionError. */
export function requireEnum(value, allowed, field, message = 'Invalid value.') {
  if (!allowed.includes(value)) {
    throw new ActionError('Check the highlighted fields.', 422, { [field]: message });
  }
  return value;
}

/** Like requireEnum, but undefined/null/'' passes through as undefined (the field is optional). */
export function optionalEnum(value, allowed, field, message) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireEnum(value, allowed, field, message);
}

/** Returns `value` if it's an integer within [min, max], otherwise throws a 422 ActionError. */
export function requireInt(value, field, { min = -Infinity, max = Infinity } = {}) {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ActionError('Check the highlighted fields.', 422, { [field]: 'Invalid value.' });
  }
  return n;
}

/** Returns `value` if it's a finite number within [min, max], otherwise throws a 422 ActionError. */
export function requireNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new ActionError('Check the highlighted fields.', 422, { [field]: 'Invalid value.' });
  }
  return n;
}

/** Returns `value` if it's a string within [min, max] length, otherwise throws a 422 ActionError. */
export function requireString(value, field, { min = 0, max = Infinity } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    throw new ActionError('Check the highlighted fields.', 422, { [field]: 'Invalid value.' });
  }
  return value;
}

/** Like requireString, but undefined/null becomes null instead of throwing (the field is nullable). */
export function nullableString(value, field, { max = Infinity } = {}) {
  if (value === undefined || value === null) return null;
  return requireString(value, field, { max });
}

/** Like requireString, but undefined/null passes through as undefined (the field is optional). */
export function optionalString(value, field, { max = Infinity } = {}) {
  if (value === undefined || value === null) return undefined;
  return requireString(value, field, { max });
}

/**
 * Shared by the two program routes (create and update take an identical body
 * shape). Mirrors the constraints the original zod schema enforced: bounds on
 * every field, at most 4 days, at most 30 exercises per day.
 */
export function parseProgramInput(body) {
  const days = Array.isArray(body.days) ? body.days : [];
  if (days.length < 1 || days.length > 4) {
    throw new ActionError('Check the highlighted fields.', 422, { days: 'A block needs 1 to 4 days.' });
  }

  return {
    positionGroup: requireEnum(body.positionGroup, ['forward', 'back'], 'positionGroup'),
    name: requireString(body.name?.trim?.() ?? body.name, 'name', { min: 1, max: 80 }),
    startDate: requireISODate(body.startDate, 'startDate'),
    endDate: requireISODate(body.endDate, 'endDate'),
    isActiveOverride: body.isActiveOverride === null ? null : requireBoolean(body.isActiveOverride, 'isActiveOverride'),
    days: days.slice(0, 4).map((day) => parseProgramDay(day)),
  };
}

/** Validates and normalises one day entry within a program payload (see parseProgramInput). */
function parseProgramDay(day) {
  const exercises = Array.isArray(day.exercises) ? day.exercises.slice(0, 30) : [];
  return {
    dayNumber: requireInt(day.dayNumber, 'days', { min: 1, max: 4 }),
    label: nullableString(day.label, 'days', { max: 60 }),
    exercises: exercises.map((exercise) => ({
      exerciseId: requireUUID(exercise.exerciseId, 'days'),
      order: requireInt(exercise.order, 'days', { min: 1 }),
      targetSets: requireInt(exercise.targetSets, 'days', { min: 1, max: 20 }),
      targetReps: requireString(exercise.targetReps, 'days', { min: 1, max: 40 }),
      restSeconds: requireInt(exercise.restSeconds, 'days', { min: 0, max: 3600 }),
      notes: nullableString(exercise.notes, 'days', { max: 500 }),
    })),
  };
}
