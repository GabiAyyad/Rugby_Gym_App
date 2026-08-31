'use client';

import { Button, cn } from '@/components/shared';
import { useOfflineSync } from '@/lib/offline/useOfflineSync';

/**
 * The honesty layer.
 *
 * A set that is only in the local queue is never described as saved — it is
 * "saved on this phone". The distinction matters: a player who believes the
 * server has their session will not think twice about clearing site data.
 */
export function OfflineBanner({ className }: { className?: string }) {
  const {
    online,
    pendingSets,
    pendingCompletions,
    pendingTotal,
    syncing,
    error,
    lastSyncedAt,
    flush,
    dismissError,
  } = useOfflineSync();

  const settled = online && pendingTotal === 0 && !error;
  if (settled && lastSyncedAt === null) return null;

  const parts: string[] = [];
  if (pendingSets > 0) parts.push(`${pendingSets} ${pendingSets === 1 ? 'set' : 'sets'}`);
  if (pendingCompletions > 0) {
    parts.push(`${pendingCompletions} finished ${pendingCompletions === 1 ? 'session' : 'sessions'}`);
  }

  const tone = error
    ? 'border-alert-500/40 bg-alert-500/10 text-alert-400'
    : !online
      ? 'border-flare-500/40 bg-flare-500/10 text-flare-400'
      : pendingTotal > 0
        ? 'border-ink-700 bg-ink-850 text-ink-200'
        : 'border-pitch-500/40 bg-pitch-500/10 text-pitch-400';

  const message = error
    ? error
    : !online
      ? pendingTotal > 0
        ? `Offline · ${parts.join(' and ')} waiting on this phone`
        : 'Offline · your sets are saved on this phone'
      : pendingTotal > 0
        ? syncing
          ? `Saving ${parts.join(' and ')}…`
          : `${parts.join(' and ')} not saved to the server yet`
        : 'Everything is saved to the server';

  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm',
        tone,
        className,
      )}
    >
      <span className="min-w-0">
        <span aria-hidden className="mr-1.5">
          {error ? '⚠' : !online ? '⚡' : pendingTotal > 0 ? '⟳' : '✓'}
        </span>
        {message}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {(pendingTotal > 0 || error) && (
          <Button variant="secondary" onClick={flush} loading={syncing}>
            Retry sync
          </Button>
        )}
        {error && (
          <Button variant="ghost" onClick={dismissError} aria-label="Dismiss" className="px-3">
            ✕
          </Button>
        )}
      </span>
    </div>
  );
}
