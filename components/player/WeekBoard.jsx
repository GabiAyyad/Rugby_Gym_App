'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, ErrorNote, PageHeader, cn } from '@/components/shared';
import { api, ApiError } from '@/lib/api';
import { formatShortDate } from '@/lib/domain/week';
import { newClientId, readCachedSessionDetail, readDayTemplate, rememberSessionIds, saveLocalSession, sessionKey } from '@/lib/offline/queue';
import { useOfflineSync } from '@/lib/offline/useOfflineSync';
import { OfflineBanner } from './OfflineBanner';
import { SessionRunner } from './SessionRunner';

/**
 * The week, as four tappable days.
 *
 * Program days are not pinned to weekdays: the highlighted day is simply the
 * next unfinished one, and any day can be opened directly — a player who misses
 * Monday does not lose Monday's session, they just train it on Wednesday.
 */
const STATUS = {
  completed: { label: 'Done', tone: 'good' },
  in_progress: { label: 'In progress', tone: 'warn' },
  not_started: { label: 'Not started', tone: 'neutral' },
};

/**
 * The player's main "Today"/"This week" screen: a progress bar, a big
 * "Start/Continue Day N" button for the next unfinished day, and the full
 * list of this week's four days to open any of them directly.
 *
 * Also owns the online/offline branching for opening a day: online, it just
 * navigates to /player/log/[sessionId] (starting the session server-side
 * first if needed); offline, it renders <SessionRunner> right here instead,
 * working from whatever this phone cached the last time it had signal.
 *
 * @param {object} props
 * @param {object} props.initial The WeekView from getWeekView, rendered server-side for first paint.
 */
export function WeekBoard({ initial }) {
  const router = useRouter();
  const sync = useOfflineSync();
  const [week, setWeek] = useState(initial); // the week data actually shown
  const [rendered, setRendered] = useState(initial); // last `initial` value seen, to detect a fresh server render
  const [busyDayId, setBusyDayId] = useState(null); // programDayId currently being opened (disables all day buttons)
  const [error, setError] = useState(null);
  const [offlineSessionId, setOfflineSessionId] = useState(null); // set -> render SessionRunner inline instead of this board

  // A fresh server render (router.refresh) wins over the copy held here — if
  // the `initial` prop is a new object since last render, the parent re-fetched
  // and we should adopt it, discarding any client-only state.
  if (rendered !== initial) {
    setRendered(initial);
    setWeek(initial);
  }

  // Whatever the queue just replayed is now on the server; re-read the board so
  // "in progress" and "done" reflect it.
  const syncedAt = sync.lastSyncedAt;
  useEffect(() => {
    if (syncedAt === null) return;
    let cancelled = false;
    api
      .get('/api/player/week')
      .then((next) => {
        if (!cancelled) setWeek(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [syncedAt]);

  /**
   * "Start"/"Continue" tapped for one day. Two completely different paths:
   *  - Online: always ends in a route change to /player/log/[sessionId] — the
   *    logging screen itself then does the actual data fetching.
   *  - Offline: no route change is possible (the next page's server render
   *    would need the network), so the session runs right here, sourced from
   *    whatever this phone cached last time it had signal (a finished
   *    session's IndexedDB copy, or a "day template" if it's brand new).
   */
  async function openDay(day) {
    setError(null);
    setBusyDayId(day.programDayId);
    try {
      if (sync.online) {
        if (day.sessionId) {
          router.push(`/player/log/${day.sessionId}`);
          return;
        }
        // No date: the server's clock decides what "today" is, so a page left
        // open across midnight cannot open yesterday's session.
        const started = await api.post('/api/player/session', { programDayId: day.programDayId });
        await rememberSessionIds({ [sessionKey(day.programDayId, started.date)]: started.sessionId });
        router.push(`/player/log/${started.sessionId}`);
        return;
      }

      // No signal: a route change would need the server, so the session runs
      // here instead, off whatever this phone downloaded last.
      if (day.sessionId && (await readCachedSessionDetail(day.sessionId))) {
        setOfflineSessionId(day.sessionId);
        return;
      }

      const template = await readDayTemplate(day.programDayId);
      if (!template) {
        setError(`Day ${day.dayNumber} has not been downloaded to this phone yet. Open it once with a signal and it will work offline after that.`);
        return;
      }

      const localId = newClientId();
      await saveLocalSession({
        localSessionId: localId,
        programDayId: day.programDayId,
        // Reuse the week's existing session date so the replay upserts into that
        // same session instead of opening a second one.
        date: day.date ?? week.today,
        createdAt: new Date().toISOString(),
      });
      setOfflineSessionId(localId);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not open that session.');
    } finally {
      setBusyDayId(null);
    }
  }

  /** Called by the inline SessionRunner when the player closes/finishes an offline session. */
  function closeOfflineSession() {
    setOfflineSessionId(null);
    if (sync.online) {
      api.get('/api/player/week').then(setWeek).catch(() => undefined);
    }
  }

  if (offlineSessionId) {
    return <SessionRunner sessionId={offlineSessionId} initialDetail={null} onExit={closeOfflineSession} />;
  }

  const nextDay = week.days.find((day) => day.dayNumber === week.nextDayNumber) ?? null;
  const progress = week.scheduledThisWeek === 0 ? 0 : Math.round((week.completedThisWeek / week.scheduledThisWeek) * 100);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="This week" subtitle={week.program ? `${week.program.name} · ${formatShortDate(week.weekStart)} – ${formatShortDate(week.weekEnd)}` : formatShortDate(week.today)} />

      <OfflineBanner />
      <ErrorNote message={error} />

      {!week.program || week.days.length === 0 ? (
        <EmptyState icon={<span className="text-3xl">🏉</span>} title="No training block yet" description="Your coach has not published a block for your position group. Check back once they have." />
      ) : (
        <>
          <section className="rounded-card p-4" style={{ border: '1px solid var(--ink-800)', background: 'var(--ink-900)' }}>
            <div className="flex justify-between gap-3" style={{ alignItems: 'baseline' }}>
              <p className="text-sm text-ink-300">
                <span className="text-2xl font-bold text-ink-50">{week.completedThisWeek}</span>
                <span className="text-ink-400"> of {week.scheduledThisWeek} days done</span>
              </p>
              {week.nextDayNumber === null && <Badge tone="good">Week complete</Badge>}
            </div>
            <div className="mt-3 progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </section>

          {nextDay && (
            <Button size="lg" fullWidth loading={busyDayId === nextDay.programDayId} onClick={() => void openDay(nextDay)}>
              {nextDay.status === 'in_progress' ? 'Continue' : 'Start'} Day {nextDay.dayNumber}
              {nextDay.label ? ` · ${nextDay.label}` : ''}
            </Button>
          )}

          <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0 }}>
            {week.days.map((day) => {
              const status = STATUS[day.status];
              const isNext = day.dayNumber === week.nextDayNumber;
              return (
                <li key={day.programDayId}>
                  <button
                    type="button"
                    disabled={busyDayId !== null}
                    onClick={() => void openDay(day)}
                    className="flex w-full gap-3 rounded-card text-left"
                    style={{
                      alignItems: 'center',
                      padding: '0.75rem',
                      border: `1px solid ${isNext ? 'rgba(34,197,94,0.5)' : 'var(--ink-800)'}`,
                      background: isNext ? 'rgba(34,197,94,0.05)' : 'var(--ink-900)',
                      opacity: busyDayId !== null ? 0.6 : 1,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      className="shrink-0 text-lg font-bold"
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: '3rem',
                        height: '3rem',
                        borderRadius: '0.75rem',
                        background: day.status === 'completed' ? 'rgba(34,197,94,0.15)' : 'var(--ink-800)',
                        color: day.status === 'completed' ? 'var(--pitch-400)' : 'var(--ink-200)',
                      }}
                    >
                      {day.dayNumber}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="truncate font-semibold text-ink-50" style={{ display: 'block' }}>
                        {day.label ?? `Day ${day.dayNumber}`}
                      </span>
                      <span className="truncate text-sm text-ink-400" style={{ display: 'block' }}>
                        {day.exerciseCount} {day.exerciseCount === 1 ? 'exercise' : 'exercises'}
                        {day.date ? ` · ${formatShortDate(day.date)}` : ''}
                      </span>
                    </span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="text-center text-xs" style={{ color: 'var(--ink-500)' }}>
            Train the days in any order — the next unfinished one is highlighted.
          </p>
        </>
      )}
    </div>
  );
}
