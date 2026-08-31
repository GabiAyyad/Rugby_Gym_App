'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, ErrorNote, PageHeader, cn } from '@/components/shared';
import { api, ApiError } from '@/lib/api';
import { formatShortDate } from '@/lib/domain/week';
import {
  newClientId,
  readCachedSessionDetail,
  readDayTemplate,
  rememberSessionIds,
  saveLocalSession,
  sessionKey,
} from '@/lib/offline/queue';
import { useOfflineSync } from '@/lib/offline/useOfflineSync';
import type { DayStatus, WeekDay, WeekView } from '@/types/session';
import { OfflineBanner } from './OfflineBanner';
import { SessionRunner } from './SessionRunner';

/**
 * The week, as four tappable days.
 *
 * Program days are not pinned to weekdays: the highlighted day is simply the
 * next unfinished one, and any day can be opened directly — a player who misses
 * Monday does not lose Monday's session, they just train it on Wednesday.
 */

const STATUS: Record<DayStatus, { label: string; tone: 'good' | 'warn' | 'neutral' }> = {
  completed: { label: 'Done', tone: 'good' },
  in_progress: { label: 'In progress', tone: 'warn' },
  not_started: { label: 'Not started', tone: 'neutral' },
};

export function WeekBoard({ initial }: { initial: WeekView }) {
  const router = useRouter();
  const sync = useOfflineSync();
  const [week, setWeek] = useState<WeekView>(initial);
  const [rendered, setRendered] = useState<WeekView>(initial);
  const [busyDayId, setBusyDayId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineSessionId, setOfflineSessionId] = useState<string | null>(null);

  // A fresh server render (router.refresh) wins over the copy held here.
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
      .get<WeekView>('/api/player/week')
      .then((next) => {
        if (!cancelled) setWeek(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [syncedAt]);

  async function openDay(day: WeekDay) {
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
        const started = await api.post<{ sessionId: string; date: string }>('/api/player/session', {
          programDayId: day.programDayId,
        });
        await rememberSessionIds({
          [sessionKey(day.programDayId, started.date)]: started.sessionId,
        });
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
        setError(
          `Day ${day.dayNumber} has not been downloaded to this phone yet. Open it once with a signal and it will work offline after that.`,
        );
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

  function closeOfflineSession() {
    setOfflineSessionId(null);
    if (sync.online) {
      api
        .get<WeekView>('/api/player/week')
        .then(setWeek)
        .catch(() => undefined);
    }
  }

  if (offlineSessionId) {
    return (
      <SessionRunner sessionId={offlineSessionId} initialDetail={null} onExit={closeOfflineSession} />
    );
  }

  const nextDay = week.days.find((day) => day.dayNumber === week.nextDayNumber) ?? null;
  const progress =
    week.scheduledThisWeek === 0
      ? 0
      : Math.round((week.completedThisWeek / week.scheduledThisWeek) * 100);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="This week"
        subtitle={
          week.program
            ? `${week.program.name} · ${formatShortDate(week.weekStart)} – ${formatShortDate(week.weekEnd)}`
            : formatShortDate(week.today)
        }
      />

      <OfflineBanner />
      <ErrorNote message={error} />

      {!week.program || week.days.length === 0 ? (
        <EmptyState
          icon={<span className="text-3xl">🏉</span>}
          title="No training block yet"
          description="Your coach has not published a block for your position group. Check back once they have."
        />
      ) : (
        <>
          <section className="rounded-card border border-ink-800 bg-ink-900 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-ink-300">
                <span className="text-2xl font-bold text-ink-50">{week.completedThisWeek}</span>
                <span className="text-ink-400"> of {week.scheduledThisWeek} days done</span>
              </p>
              {week.nextDayNumber === null && <Badge tone="good">Week complete</Badge>}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-800">
              <div className="h-full bg-pitch-500 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </section>

          {nextDay && (
            <Button
              size="lg"
              fullWidth
              loading={busyDayId === nextDay.programDayId}
              onClick={() => void openDay(nextDay)}
            >
              {nextDay.status === 'in_progress' ? 'Continue' : 'Start'} Day {nextDay.dayNumber}
              {nextDay.label ? ` · ${nextDay.label}` : ''}
            </Button>
          )}

          <ul className="flex flex-col gap-2">
            {week.days.map((day) => {
              const status = STATUS[day.status];
              const isNext = day.dayNumber === week.nextDayNumber;
              return (
                <li key={day.programDayId}>
                  <button
                    type="button"
                    disabled={busyDayId !== null}
                    onClick={() => void openDay(day)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-card border p-3 text-left transition-colors disabled:opacity-60',
                      isNext
                        ? 'border-pitch-500/50 bg-pitch-500/5'
                        : 'border-ink-800 bg-ink-900 hover:border-ink-700',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-12 shrink-0 place-items-center rounded-xl text-lg font-bold',
                        day.status === 'completed'
                          ? 'bg-pitch-500/15 text-pitch-400'
                          : 'bg-ink-800 text-ink-200',
                      )}
                    >
                      {day.dayNumber}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink-50">
                        {day.label ?? `Day ${day.dayNumber}`}
                      </span>
                      <span className="block truncate text-sm text-ink-400">
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

          <p className="text-center text-xs text-ink-500">
            Train the days in any order — the next unfinished one is highlighted.
          </p>
        </>
      )}
    </div>
  );
}
