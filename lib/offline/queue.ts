'use client';

import { createStore, del, get, set, type UseStore } from 'idb-keyval';
import type { ISODate } from '@/types/common';
import type { LogSetInput, QueuedLog, SessionDetail } from '@/types/session';

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

export interface PendingCompletion {
  programDayId: string;
  date: ISODate;
  queuedAt: string;
}

/** A session started while offline: a locally minted id and what it points at. */
export interface LocalSessionRef {
  localSessionId: string;
  programDayId: string;
  date: ISODate;
  createdAt: string;
}

export interface OfflineSnapshot {
  pendingSets: number;
  pendingCompletions: number;
}

/* ------------------------------------------------------------------- storage */

let store: UseStore | null = null;
let storeBroken = false;
const memory = new Map<string, unknown>();

function idb(): UseStore | null {
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

async function read<T>(key: string): Promise<T | null> {
  const handle = idb();
  if (handle) {
    try {
      const value = await get<T>(key, handle);
      if (value !== undefined) return value;
      return (memory.get(key) as T | undefined) ?? null;
    } catch {
      storeBroken = true;
    }
  }
  return (memory.get(key) as T | undefined) ?? null;
}

async function write<T>(key: string, value: T): Promise<void> {
  memory.set(key, value);
  const handle = idb();
  if (!handle) return;
  try {
    await set(key, value, handle);
  } catch {
    storeBroken = true;
  }
}

async function remove(key: string): Promise<void> {
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
let chain: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch(() => undefined);
  return next;
}

/* ----------------------------------------------------------------- listeners */

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to queue changes — the banner's set count updates without polling. */
export function subscribeToQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A broken subscriber must not stop the others from hearing about it.
    }
  }
}

/* --------------------------------------------------------------------- ids */

export function newClientId(): string {
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
export function sessionKey(programDayId: string, date: ISODate): string {
  return `${programDayId}|${date}`;
}

function naturalKey(entry: LogSetInput): string {
  return `${entry.programDayId}|${entry.date}|${entry.programExerciseId}|${entry.setNumber}`;
}

/* ------------------------------------------------------------------- queue */

export async function readLogQueue(): Promise<QueuedLog[]> {
  return (await read<QueuedLog[]>(KEY_QUEUE)) ?? [];
}

/**
 * Queue one set. Re-logging the same set replaces the queued entry rather than
 * adding a second one, so a player fixing a typo does not ship two writes.
 */
export async function enqueueLog(entry: LogSetInput): Promise<QueuedLog> {
  const queued: QueuedLog = {
    ...entry,
    clientId: newClientId(),
    queuedAt: new Date().toISOString(),
  };

  await serialize(async () => {
    const current = (await read<QueuedLog[]>(KEY_QUEUE)) ?? [];
    const key = naturalKey(entry);
    const next = current.filter((item) => naturalKey(item) !== key);
    next.push(queued);
    await write(KEY_QUEUE, next);
  });

  notify();
  return queued;
}

export async function removeLogs(clientIds: string[]): Promise<void> {
  if (clientIds.length === 0) return;
  const drop = new Set(clientIds);
  await serialize(async () => {
    const current = (await read<QueuedLog[]>(KEY_QUEUE)) ?? [];
    await write(
      KEY_QUEUE,
      current.filter((item) => !drop.has(item.clientId)),
    );
  });
  notify();
}

/** Sets still only on this phone, for one session. */
export async function countPendingFor(programDayId: string, date: ISODate): Promise<number> {
  const queue = await readLogQueue();
  return queue.filter((item) => item.programDayId === programDayId && item.date === date).length;
}

export async function readQueueFor(programDayId: string, date: ISODate): Promise<QueuedLog[]> {
  const queue = await readLogQueue();
  return queue.filter((item) => item.programDayId === programDayId && item.date === date);
}

/* ------------------------------------------------------------- completions */

export async function readCompletionQueue(): Promise<PendingCompletion[]> {
  return (await read<PendingCompletion[]>(KEY_COMPLETIONS)) ?? [];
}

/**
 * Finishing a session offline. Keyed by (programDayId, date) rather than by
 * session id, because the id may still be a local one the server has never seen.
 */
export async function enqueueCompletion(programDayId: string, date: ISODate): Promise<void> {
  await serialize(async () => {
    const current = (await read<PendingCompletion[]>(KEY_COMPLETIONS)) ?? [];
    const key = sessionKey(programDayId, date);
    const next = current.filter((item) => sessionKey(item.programDayId, item.date) !== key);
    next.push({ programDayId, date, queuedAt: new Date().toISOString() });
    await write(KEY_COMPLETIONS, next);
  });
  notify();
}

export async function removeCompletion(programDayId: string, date: ISODate): Promise<void> {
  const key = sessionKey(programDayId, date);
  await serialize(async () => {
    const current = (await read<PendingCompletion[]>(KEY_COMPLETIONS)) ?? [];
    await write(
      KEY_COMPLETIONS,
      current.filter((item) => sessionKey(item.programDayId, item.date) !== key),
    );
  });
  notify();
}

export async function readSnapshot(): Promise<OfflineSnapshot> {
  const [queue, completions] = await Promise.all([readLogQueue(), readCompletionQueue()]);
  return { pendingSets: queue.length, pendingCompletions: completions.length };
}

/* ------------------------------------------------------------ session cache */

/**
 * Cached twice on purpose: under its own id so a reload of the logging screen
 * still renders, and under the program day as a template so a session started
 * later with no signal has an exercise list to work from.
 */
export async function cacheSessionDetail(detail: SessionDetail): Promise<void> {
  await write(`${PREFIX_SESSION}${detail.sessionId}`, detail);
  await write(`${PREFIX_DAY}${detail.programDayId}`, detail);
}

export async function readCachedSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  return read<SessionDetail>(`${PREFIX_SESSION}${sessionId}`);
}

export async function readDayTemplate(programDayId: string): Promise<SessionDetail | null> {
  return read<SessionDetail>(`${PREFIX_DAY}${programDayId}`);
}

export async function forgetSessionDetail(sessionId: string): Promise<void> {
  await remove(`${PREFIX_SESSION}${sessionId}`);
}

/* ---------------------------------------------------------- local sessions */

export async function saveLocalSession(ref: LocalSessionRef): Promise<void> {
  await write(`${PREFIX_LOCAL}${ref.localSessionId}`, ref);
}

export async function readLocalSession(localSessionId: string): Promise<LocalSessionRef | null> {
  return read<LocalSessionRef>(`${PREFIX_LOCAL}${localSessionId}`);
}

/* ------------------------------------------------------- server session ids */

/** Adopt the ids syncLogs resolved, so a locally started session finds its row. */
export async function rememberSessionIds(map: Record<string, string>): Promise<void> {
  const keys = Object.keys(map);
  if (keys.length === 0) return;
  await serialize(async () => {
    const current = (await read<Record<string, string>>(KEY_SESSION_IDS)) ?? {};
    await write(KEY_SESSION_IDS, { ...current, ...map });
  });
}

export async function readServerSessionId(
  programDayId: string,
  date: ISODate,
): Promise<string | null> {
  const current = (await read<Record<string, string>>(KEY_SESSION_IDS)) ?? {};
  return current[sessionKey(programDayId, date)] ?? null;
}
