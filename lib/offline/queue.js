'use client';

import { createStore, del, get, set } from 'idb-keyval';

/**
 * The local-first write path.
 *
 * Every set the player enters lands here first and is only ever *reported* as
 * saved once the server has accepted it. Gym wifi is assumed to be broken, so
 * nothing in the logging screen may await the network.
 *
 * Storage is IndexedDB (via idb-keyval) with an in-memory fallback, because
 * private browsing modes and locked-down browsers can refuse it outright — a
 * refused database must degrade to "works until you close the tab", never to a
 * crash mid-session.
 */

const DB_NAME = 'rugby-gym';
const STORE_NAME = 'offline';

const KEY_QUEUE = 'log-queue';
const KEY_COMPLETIONS = 'completion-queue';
const KEY_SESSION_IDS = 'server-session-ids';
const PREFIX_SESSION = 'session:';
const PREFIX_DAY = 'day:';
const PREFIX_LOCAL = 'local:';

/* ------------------------------------------------------------------- storage */

let store = null;
let storeBroken = false;
// Fallback store used whenever IndexedDB is unavailable/broken. Only lives for
// the current tab's lifetime, but keeps the app from crashing mid-session.
const memory = new Map();

/** Lazily opens (and caches) the IndexedDB store, or null if it's unavailable/broken. */
function idb() {
  if (storeBroken) return null;
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return null;
  if (!store) {
    try {
      store = createStore(DB_NAME, STORE_NAME);
    } catch {
      storeBroken = true;
      return null;
    }
  }
  return store;
}

/** Reads one key, trying IndexedDB first and falling back to the in-memory map. */
async function read(key) {
  const handle = idb();
  if (handle) {
    try {
      const value = await get(key, handle);
      if (value !== undefined) return value;
      return memory.get(key) ?? null;
    } catch {
      storeBroken = true;
    }
  }
  return memory.get(key) ?? null;
}

/** Writes one key to both the in-memory map and IndexedDB (best-effort). */
async function write(key, value) {
  memory.set(key, value);
  const handle = idb();
  if (!handle) return;
  try {
    await set(key, value, handle);
  } catch {
    storeBroken = true;
  }
}

/** Deletes one key from both the in-memory map and IndexedDB (best-effort). */
async function remove(key) {
  memory.delete(key);
  const handle = idb();
  if (!handle) return;
  try {
    await del(key, handle);
  } catch {
    storeBroken = true;
  }
}

/** All queue mutations run in order: read-modify-write on an array is not atomic. */
let chain = Promise.resolve();

/** Chains `task` onto the end of every previous serialize() call, so queue mutations never race each other. */
function serialize(task) {
  const next = chain.then(task, task);
  chain = next.catch(() => undefined);
  return next;
}

/* ----------------------------------------------------------------- listeners */

const listeners = new Set();

/** Subscribe to queue changes — the banner's set count updates without polling. */
export function subscribeToQueue(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fires every subscribed listener after a queue mutation. */
function notify() {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A broken subscriber must not stop the others from hearing about it.
    }
  }
}

/* --------------------------------------------------------------------- ids */

/**
 * Generates a random client-side id for a queued entry. Prefers the real
 * crypto.randomUUID(); falls back to building a v4-shaped UUID manually from
 * crypto.getRandomValues(), then to a plain timestamp+random string if even
 * that's unavailable (very old/locked-down browsers).
 */
export function newClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `local-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 12)}`;
}

/** programDayId|date — the key syncLogs answers with, so ids can be adopted. */
export function sessionKey(programDayId, date) {
  return `${programDayId}|${date}`;
}

/** The natural key of one queued log entry — used to replace rather than duplicate a re-logged set. */
function naturalKey(entry) {
  return `${entry.programDayId}|${entry.date}|${entry.programExerciseId}|${entry.setNumber}`;
}

/* ------------------------------------------------------------------- queue */

/** Every set currently queued locally, across all sessions. */
export async function readLogQueue() {
  return (await read(KEY_QUEUE)) ?? [];
}

/**
 * Queue one set. Re-logging the same set replaces the queued entry rather than
 * adding a second one, so a player fixing a typo does not ship two writes.
 */
export async function enqueueLog(entry) {
  const queued = { ...entry, clientId: newClientId(), queuedAt: new Date().toISOString() };

  await serialize(async () => {
    const current = (await read(KEY_QUEUE)) ?? [];
    const key = naturalKey(entry);
    const next = current.filter((item) => naturalKey(item) !== key);
    next.push(queued);
    await write(KEY_QUEUE, next);
  });

  notify();
  return queued;
}

/** Removes queued entries by clientId once the server has confirmed (or permanently rejected) them. */
export async function removeLogs(clientIds) {
  if (clientIds.length === 0) return;
  const drop = new Set(clientIds);
  await serialize(async () => {
    const current = (await read(KEY_QUEUE)) ?? [];
    await write(KEY_QUEUE, current.filter((item) => !drop.has(item.clientId)));
  });
  notify();
}

/** Sets still only on this phone, for one session. */
export async function countPendingFor(programDayId, date) {
  const queue = await readLogQueue();
  return queue.filter((item) => item.programDayId === programDayId && item.date === date).length;
}

/** The queued (not-yet-synced) sets for one specific session. */
export async function readQueueFor(programDayId, date) {
  const queue = await readLogQueue();
  return queue.filter((item) => item.programDayId === programDayId && item.date === date);
}

/* ------------------------------------------------------------- completions */

/** Every "finish this session" request currently queued locally. */
export async function readCompletionQueue() {
  return (await read(KEY_COMPLETIONS)) ?? [];
}

/**
 * Finishing a session offline. Keyed by (programDayId, date) rather than by
 * session id, because the id may still be a local one the server has never seen.
 */
export async function enqueueCompletion(programDayId, date) {
  await serialize(async () => {
    const current = (await read(KEY_COMPLETIONS)) ?? [];
    const key = sessionKey(programDayId, date);
    const next = current.filter((item) => sessionKey(item.programDayId, item.date) !== key);
    next.push({ programDayId, date, queuedAt: new Date().toISOString() });
    await write(KEY_COMPLETIONS, next);
  });
  notify();
}

/** Removes a queued completion once the server has confirmed it. */
export async function removeCompletion(programDayId, date) {
  const key = sessionKey(programDayId, date);
  await serialize(async () => {
    const current = (await read(KEY_COMPLETIONS)) ?? [];
    await write(KEY_COMPLETIONS, current.filter((item) => sessionKey(item.programDayId, item.date) !== key));
  });
  notify();
}

/** Counts of what's still waiting to sync — what the offline banner shows. */
export async function readSnapshot() {
  const [queue, completions] = await Promise.all([readLogQueue(), readCompletionQueue()]);
  return { pendingSets: queue.length, pendingCompletions: completions.length };
}

/* ------------------------------------------------------------ session cache */

/**
 * Cached twice on purpose: under its own id so a reload of the logging screen
 * still renders, and under the program day as a template so a session started
 * later with no signal has an exercise list to work from.
 */
export async function cacheSessionDetail(detail) {
  await write(`${PREFIX_SESSION}${detail.sessionId}`, detail);
  await write(`${PREFIX_DAY}${detail.programDayId}`, detail);
}

/** Reads back a session cached by cacheSessionDetail, by its own session id. */
export async function readCachedSessionDetail(sessionId) {
  return read(`${PREFIX_SESSION}${sessionId}`);
}

/** Reads the last-cached SessionDetail for a program day — used as a template for a brand-new offline session. */
export async function readDayTemplate(programDayId) {
  return read(`${PREFIX_DAY}${programDayId}`);
}

/** Drops one session's cache entry (its day-template cache is left alone). */
export async function forgetSessionDetail(sessionId) {
  await remove(`${PREFIX_SESSION}${sessionId}`);
}

/* ---------------------------------------------------------- local sessions */

/** Remembers a session that was started entirely offline (its id was minted on the phone, not the server). */
export async function saveLocalSession(ref) {
  await write(`${PREFIX_LOCAL}${ref.localSessionId}`, ref);
}

/** Looks up a locally-started session's reference by its local id. */
export async function readLocalSession(localSessionId) {
  return read(`${PREFIX_LOCAL}${localSessionId}`);
}

/* ------------------------------------------------------- server session ids */

/** Adopt the ids syncLogs resolved, so a locally started session finds its row. */
export async function rememberSessionIds(map) {
  const keys = Object.keys(map);
  if (keys.length === 0) return;
  await serialize(async () => {
    const current = (await read(KEY_SESSION_IDS)) ?? {};
    await write(KEY_SESSION_IDS, { ...current, ...map });
  });
}

/** Looks up the real server-side session id for a (programDayId, date), once syncLogs has resolved it. */
export async function readServerSessionId(programDayId, date) {
  const current = (await read(KEY_SESSION_IDS)) ?? {};
  return current[sessionKey(programDayId, date)] ?? null;
}
