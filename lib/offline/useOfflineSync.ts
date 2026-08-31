'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { api, ApiError } from '@/lib/api';
import type { SyncLogsResult } from '@/types/session';
import {
  readCompletionQueue,
  readLogQueue,
  readServerSessionId,
  rememberSessionIds,
  removeCompletion,
  removeLogs,
  readSnapshot,
  sessionKey,
  subscribeToQueue,
  type OfflineSnapshot,
} from './queue';

/**
 * The background flusher.
 *
 * Runs on mount, when the browser says it is back online, when the tab becomes
 * visible again (phones suspend timers in the background) and on a slow timer.
 * Every trigger shares one in-flight request, so four triggers firing at once
 * still only replays the queue once.
 */

const BATCH_SIZE = 200;
const POLL_MS = 30_000;

export interface FlushOutcome {
  syncedSets: number;
  syncedCompletions: number;
  droppedSets: number;
  error: string | null;
}

interface SyncState {
  syncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;
}

let syncState: SyncState = { syncing: false, lastSyncedAt: null, error: null };
const syncListeners = new Set<() => void>();

function setSyncState(patch: Partial<SyncState>): void {
  syncState = { ...syncState, ...patch };
  for (const listener of [...syncListeners]) listener();
}

function subscribeSync(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

function getSyncSnapshot(): SyncState {
  return syncState;
}

let inFlight: Promise<FlushOutcome> | null = null;

/** Replay whatever is queued. Safe to call from anywhere, as often as you like. */
export function flushNow(): Promise<FlushOutcome> {
  if (inFlight) return inFlight;
  const run = runFlush().finally(() => {
    inFlight = null;
  });
  inFlight = run;
  return run;
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

async function runFlush(): Promise<FlushOutcome> {
  const idle: FlushOutcome = { syncedSets: 0, syncedCompletions: 0, droppedSets: 0, error: null };
  if (typeof window === 'undefined') return idle;

  const [queue, completions] = await Promise.all([readLogQueue(), readCompletionQueue()]);
  if (queue.length === 0 && completions.length === 0) return idle;
  if (!isOnline()) {
    return { ...idle, error: null };
  }

  setSyncState({ syncing: true, error: null });
  let syncedSets = 0;
  let droppedSets = 0;
  let syncedCompletions = 0;
  let error: string | null = null;

  try {
    for (let offset = 0; offset < queue.length; offset += BATCH_SIZE) {
      const batch = queue.slice(offset, offset + BATCH_SIZE);
      try {
        const result = await api.post<SyncLogsResult>('/api/player/sync', { entries: batch });
        await rememberSessionIds(result.sessionIds);
        await removeLogs([...result.accepted, ...result.rejected.map((item) => item.clientId)]);
        syncedSets += result.accepted.length;
        droppedSets += result.rejected.length;
        if (result.rejected.length > 0) error = result.rejected[0].error;
      } catch (caught) {
        if (caught instanceof ApiError && isPermanent(caught.status)) {
          // A batch the server will never accept would otherwise block every
          // future set behind it, so it is dropped — loudly, never silently.
          await removeLogs(batch.map((item) => item.clientId));
          droppedSets += batch.length;
          error = `${batch.length} ${batch.length === 1 ? 'set' : 'sets'} could not be saved and were discarded.`;
          continue;
        }
        error = describe(caught);
        break;
      }
    }

    if (!error || droppedSets > 0) {
      for (const completion of completions) {
        try {
          const sessionId = await resolveSessionId(completion.programDayId, completion.date);
          await api.post(`/api/player/session/${sessionId}/complete`, {});
          await removeCompletion(completion.programDayId, completion.date);
          syncedCompletions += 1;
        } catch (caught) {
          if (caught instanceof ApiError && isPermanent(caught.status)) {
            await removeCompletion(completion.programDayId, completion.date);
            error = 'A finished session could not be recorded.';
            continue;
          }
          error = describe(caught);
          break;
        }
      }
    }
  } finally {
    setSyncState({
      syncing: false,
      error,
      lastSyncedAt: syncedSets > 0 || syncedCompletions > 0 ? Date.now() : syncState.lastSyncedAt,
    });
  }

  return { syncedSets, syncedCompletions, droppedSets, error };
}

/**
 * A session finished offline may still be carrying a locally minted id, so the
 * real one is either the id sync already handed back or one resolved now.
 */
async function resolveSessionId(programDayId: string, date: string): Promise<string> {
  const known = await readServerSessionId(programDayId, date);
  if (known) return known;
  const started = await api.post<{ sessionId: string }>('/api/player/session', {
    programDayId,
    date,
  });
  await rememberSessionIds({ [sessionKey(programDayId, date)]: started.sessionId });
  return started.sessionId;
}

/** 400/422 mean the payload itself is wrong; everything else is worth retrying. */
function isPermanent(status: number): boolean {
  return status === 400 || status === 422;
}

function describe(caught: unknown): string {
  if (caught instanceof ApiError) {
    if (caught.status === 401) return 'You have been signed out — sign in again to save your sets.';
    return caught.message;
  }
  return 'No connection — your sets are saved on this phone.';
}

/* --------------------------------------------------------------------- hook */

export interface OfflineSyncStatus extends OfflineSnapshot {
  online: boolean;
  syncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;
  /** Total items the server has not accepted yet. */
  pendingTotal: number;
  flush: () => void;
  dismissError: () => void;
}

/* Connection state is read straight from the browser rather than mirrored into
   component state, so there is one source of truth and no stale flag. */
function subscribeOnline(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine !== false;
}

function getOnlineServerSnapshot(): boolean {
  return true;
}

export function useOfflineSync(): OfflineSyncStatus {
  const sync = useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot);
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const [counts, setCounts] = useState<OfflineSnapshot>({ pendingSets: 0, pendingCompletions: 0 });

  const refresh = useCallback(() => {
    void readSnapshot().then(setCounts);
  }, []);

  useEffect(() => {
    refresh();
    return subscribeToQueue(refresh);
  }, [refresh]);

  // Mount, and again the moment the browser says the signal is back.
  useEffect(() => {
    if (!online) return;
    void flushNow().then(refresh);
  }, [online, refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void flushNow().then(refresh);
    };
    document.addEventListener('visibilitychange', onVisible);

    const timer = window.setInterval(() => {
      if (isOnline()) void flushNow().then(refresh);
    }, POLL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const flush = useCallback(() => {
    void flushNow().then(refresh);
  }, [refresh]);

  const dismissError = useCallback(() => setSyncState({ error: null }), []);

  return {
    ...counts,
    pendingTotal: counts.pendingSets + counts.pendingCompletions,
    online,
    syncing: sync.syncing,
    lastSyncedAt: sync.lastSyncedAt,
    error: sync.error,
    flush,
    dismissError,
  };
}
