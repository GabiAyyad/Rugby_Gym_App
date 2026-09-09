'use client';

import { Button, cn } from '@/components/shared';
import { useOfflineSync } from '@/lib/offline/useOfflineSync';

/**
 * The small status strip shown at the top of the week board and the logging
 * screen, reporting the offline sync state from useOfflineSync().
 *
 * This is "the honesty layer": a set that is only in the local queue is never
 * described as saved — it is "saved on this phone". The distinction matters:
 * a player who believes the server has their session will not think twice
 * about clearing site data.
 *
 * Renders nothing at all once everything is settled (online, nothing pending,
 * no error) AND nothing has ever synced yet in this tab — so a player who's
 * always been online with an empty queue never sees this banner at all.
 *
 * @param {object} [props]
 * @param {string} [props.className] Extra classes merged onto the banner.
 */
export function OfflineBanner({ className }) {
  const { online, pendingSets, pendingCompletions, pendingTotal, syncing, error, lastSyncedAt, flush, dismissError } = useOfflineSync();

  const settled = online && pendingTotal === 0 && !error;
  if (settled && lastSyncedAt === null) return null;

  // Builds the "3 sets and 1 finished session" clause used in a couple of the messages below.
  const parts = [];
  if (pendingSets > 0) parts.push(`${pendingSets} ${pendingSets === 1 ? 'set' : 'sets'}`);
  if (pendingCompletions > 0) {
    parts.push(`${pendingCompletions} finished ${pendingCompletions === 1 ? 'session' : 'sessions'}`);
  }

  // Colour scheme, in priority order: an error is always red, then offline is
  // amber, then "still syncing" is neutral grey, and fully-synced is green.
  const colours = error
    ? { border: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: 'var(--alert-400)' }
    : !online
      ? { border: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)', color: 'var(--flare-400)' }
      : pendingTotal > 0
        ? { border: 'var(--ink-700)', background: 'var(--ink-850)', color: 'var(--ink-200)' }
        : { border: 'rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: 'var(--pitch-400)' };

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
      className={cn('flex items-center justify-between gap-3 rounded-xl text-sm', className)}
      style={{ border: `1px solid ${colours.border}`, background: colours.background, color: colours.color, padding: '0.5rem 0.75rem' }}
    >
      <span className="min-w-0">
        <span aria-hidden className="ml-2" style={{ marginRight: '0.375rem' }}>
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
