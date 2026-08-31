'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, ErrorNote, LoadingState, cn } from '@/components/shared';
import { api } from '@/lib/api';
import { formatShortDate } from '@/lib/domain/week';
import {
  cacheSessionDetail,
  enqueueCompletion,
  enqueueLog,
  readCachedSessionDetail,
  readDayTemplate,
  readLocalSession,
  readQueueFor,
  readServerSessionId,
} from '@/lib/offline/queue';
import { flushNow, useOfflineSync } from '@/lib/offline/useOfflineSync';
import type { ISODate } from '@/types/common';
import type { LoggedSet, SessionDetail } from '@/types/session';
import { ExerciseStep } from './ExerciseStep';
import { OfflineBanner } from './OfflineBanner';
import { RestTimer, createAudioContext } from './RestTimer';
import type { SetValues } from './SetRow';

/**
 * The logging screen.
 *
 * Every write goes to the local queue first and to the screen immediately; the
 * network is never on the path between a player finishing a set and seeing it
 * recorded. The session itself can come from three places — the server render,
 * the IndexedDB cache, or a day template captured last time the player was
 * online — which is what lets a session start with no signal at all.
 */

type LoadState = 'loading' | 'ready' | 'missing';

export function SessionRunner({
  sessionId,
  initialDetail,
  onExit,
}: {
  sessionId: string;
  initialDetail: SessionDetail | null;
  /** Set when the runner is embedded in the week board (started with no signal). */
  onExit?: () => void;
}) {
  const router = useRouter();
  const sync = useOfflineSync();

  const [detail, setDetail] = useState<SessionDetail | null>(initialDetail);
  const [loadState, setLoadState] = useState<LoadState>(initialDetail ? 'ready' : 'loading');
  const [serverBacked, setServerBacked] = useState(initialDetail !== null);
  const [index, setIndex] = useState(0);
  const [sets, setSets] = useState<Record<string, LoggedSet[]>>({});
  const [pending, setPending] = useState<Record<string, Set<number>>>({});
  const [rest, setRest] = useState<{ key: number; seconds: number; name: string } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(initialDetail?.completedAt != null);
  const [notice, setNotice] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null);

  /* ------------------------------------------------------------- loading */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (initialDetail) {
        await cacheSessionDetail(initialDetail);
        return;
      }

      const cached = await readCachedSessionDetail(sessionId);
      if (cached) {
        if (!cancelled) {
          setDetail(cached);
          setLoadState('ready');
          setFinished(cached.completedAt != null);
        }
        return;
      }

      // A session minted on the phone: rebuild it from the day's last download.
      const local = await readLocalSession(sessionId);
      if (local) {
        const template = await readDayTemplate(local.programDayId);
        if (template) {
          const blank = blankSession(template, sessionId, local.date);
          await cacheSessionDetail(blank);
          if (!cancelled) {
            setDetail(blank);
            setLoadState('ready');
          }
          return;
        }
      }

      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        try {
          const fetched = await api.get<SessionDetail>(`/api/player/session/${sessionId}`);
          await cacheSessionDetail(fetched);
          if (!cancelled) {
            setDetail(fetched);
            setServerBacked(true);
            setLoadState('ready');
            setFinished(fetched.completedAt != null);
          }
          return;
        } catch {
          // Fall through to the offline message below.
        }
      }

      if (!cancelled) setLoadState('missing');
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, initialDetail]);

  /* ------------------------------------------- merge server sets with queue */

  // Server sets plus whatever is still queued. Runs only when the session
  // itself changes: a sync empties the queue, and rebuilding from it then would
  // wipe sets off the screen the instant they were safely saved.
  useEffect(() => {
    if (!detail) return;
    let cancelled = false;

    async function merge(current: SessionDetail) {
      const queued = await readQueueFor(current.programDayId, current.date);
      if (cancelled) return;

      const merged: Record<string, LoggedSet[]> = {};
      for (const exercise of current.exercises) merged[exercise.programExerciseId] = [...exercise.sets];

      for (const entry of queued) {
        merged[entry.programExerciseId] = upsertSet(merged[entry.programExerciseId] ?? [], {
          setNumber: entry.setNumber,
          repsDone: entry.repsDone,
          weightUsed: entry.weightUsed,
          distanceOrTime: entry.distanceOrTime,
        });
      }

      setSets(merged);
    }

    void merge(detail);
    return () => {
      cancelled = true;
    };
  }, [detail]);

  // Which of those sets are still only on this phone. Re-read whenever the
  // queue drains so the "saved on this phone" markers clear on their own.
  const syncedAt = sync.lastSyncedAt;
  const pendingCount = sync.pendingSets;
  useEffect(() => {
    if (!detail) return;
    let cancelled = false;

    void readQueueFor(detail.programDayId, detail.date).then((queued) => {
      if (cancelled) return;
      const map: Record<string, Set<number>> = {};
      for (const entry of queued) {
        const numbers = map[entry.programExerciseId] ?? new Set<number>();
        numbers.add(entry.setNumber);
        map[entry.programExerciseId] = numbers;
      }
      setPending(map);
    });

    return () => {
      cancelled = true;
    };
  }, [detail, syncedAt, pendingCount]);

  // Keep this phone's copy of the session in step with what is on screen, so a
  // session opened again with no signal comes back with its sets intact.
  useEffect(() => {
    if (!detail) return;
    const merged: SessionDetail = {
      ...detail,
      exercises: detail.exercises.map((exercise) => ({
        ...exercise,
        sets: sets[exercise.programExerciseId] ?? exercise.sets,
      })),
    };
    const timer = window.setTimeout(() => void cacheSessionDetail(merged), 400);
    return () => window.clearTimeout(timer);
  }, [detail, sets]);

  /* ------------------------------------------------------------- logging */

  const logSet = useCallback(
    (programExerciseId: string, setNumber: number, values: SetValues) => {
      if (!detail) return;

      // Built here, inside the tap that logged the set: an AudioContext created
      // later would be blocked by autoplay policy and the rest beep lost.
      if (!audio.current) audio.current = createAudioContext();

      const exercise = detail.exercises.find((item) => item.programExerciseId === programExerciseId);
      const set: LoggedSet = {
        setNumber,
        repsDone: values.repsDone,
        weightUsed: values.weightUsed,
        distanceOrTime: values.distanceOrTime,
      };

      setSets((current) => ({
        ...current,
        [programExerciseId]: upsertSet(current[programExerciseId] ?? [], set),
      }));
      setPending((current) => {
        const numbers = new Set(current[programExerciseId] ?? []);
        numbers.add(setNumber);
        return { ...current, [programExerciseId]: numbers };
      });
      setNotice(null);
      setRest({
        key: Date.now(),
        seconds: exercise?.restSeconds ?? 90,
        name: exercise?.exercise.name ?? '',
      });

      void enqueueLog({
        programDayId: detail.programDayId,
        date: detail.date,
        programExerciseId,
        setNumber,
        repsDone: values.repsDone,
        weightUsed: values.weightUsed,
        distanceOrTime: values.distanceOrTime,
      }).then(() => flushNow());
    },
    [detail],
  );

  /* -------------------------------------------------------------- finish */

  async function resolveServerSessionId(current: SessionDetail): Promise<string> {
    if (serverBacked) return current.sessionId;
    const known = await readServerSessionId(current.programDayId, current.date);
    if (known) return known;
    const started = await api.post<{ sessionId: string }>('/api/player/session', {
      programDayId: current.programDayId,
      date: current.date,
    });
    return started.sessionId;
  }

  async function finish() {
    if (!detail) return;
    setNotice(null);
    setFinishing(true);
    try {
      if (!sync.online) {
        await enqueueCompletion(detail.programDayId, detail.date);
        setFinished(true);
        setNotice('Finished offline — this session will be recorded as soon as you have signal.');
        return;
      }

      await flushNow();
      const outstanding = await readQueueFor(detail.programDayId, detail.date);
      if (outstanding.length > 0) {
        setNotice(
          `${outstanding.length} ${outstanding.length === 1 ? 'set is' : 'sets are'} still on this phone. They are not lost — tap Retry sync, then finish.`,
        );
        return;
      }

      const id = await resolveServerSessionId(detail);
      await api.post(`/api/player/session/${id}/complete`, {});
      setFinished(true);
      leave();
    } catch {
      await enqueueCompletion(detail.programDayId, detail.date);
      setFinished(true);
      setNotice('Could not reach the server — this session is queued and will be recorded on sync.');
    } finally {
      setFinishing(false);
    }
  }

  function leave() {
    if (onExit) {
      onExit();
      return;
    }
    router.push('/player/today');
    router.refresh();
  }

  /* ---------------------------------------------------------------- views */

  if (loadState === 'loading') return <LoadingState label="Opening your session…" />;

  if (loadState === 'missing' || !detail) {
    return (
      <div className="flex flex-col gap-4">
        <OfflineBanner />
        <EmptyState
          icon={<span className="text-3xl">📡</span>}
          title="This session isn't on this phone yet"
          description="Open it once with a signal and it will be available offline from then on."
          action={
            <Button size="lg" onClick={leave}>
              Back to this week
            </Button>
          }
        />
      </div>
    );
  }

  const exercise = detail.exercises[Math.min(index, Math.max(0, detail.exercises.length - 1))];
  const totalSets = detail.exercises.reduce((sum, item) => sum + item.targetSets, 0);
  const loggedSets = Object.values(sets).reduce((sum, list) => sum + list.length, 0);
  const isLast = index >= detail.exercises.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-ink-400 uppercase">{detail.programName}</p>
          <h1 className="text-xl leading-tight font-bold text-ink-50">
            Day {detail.dayNumber}
            {detail.label ? ` · ${detail.label}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-ink-400">
            {formatShortDate(detail.date)} · {loggedSets}/{totalSets} sets logged
          </p>
        </div>
        <Button variant="ghost" onClick={leave} className="shrink-0">
          Close
        </Button>
      </header>

      <OfflineBanner />

      {finished && (
        <div className="rounded-xl border border-pitch-500/40 bg-pitch-500/10 px-3 py-2 text-sm text-pitch-400">
          Session finished. Anything else you log here still counts.
        </div>
      )}

      {detail.exercises.length === 0 ? (
        <EmptyState
          title="No exercises on this day"
          description="Your coach has not added anything to this session yet."
          action={
            <Button size="lg" onClick={leave}>
              Back to this week
            </Button>
          }
        />
      ) : (
        <>
          <ol className="flex flex-wrap gap-1.5" aria-label="Exercises in this session">
            {detail.exercises.map((item, position) => {
              const complete = (sets[item.programExerciseId]?.length ?? 0) >= item.targetSets;
              return (
                <li key={item.programExerciseId}>
                  <button
                    type="button"
                    onClick={() => setIndex(position)}
                    aria-label={`${item.exercise.name}${complete ? ', complete' : ''}`}
                    aria-current={position === index ? 'step' : undefined}
                    className={cn(
                      'size-11 rounded-lg border text-sm font-semibold transition-colors',
                      position === index
                        ? 'border-pitch-500 bg-pitch-500 text-ink-950'
                        : complete
                          ? 'border-pitch-500/40 bg-pitch-500/10 text-pitch-400'
                          : 'border-ink-700 bg-ink-900 text-ink-300',
                    )}
                  >
                    {position + 1}
                  </button>
                </li>
              );
            })}
          </ol>

          <ExerciseStep
            key={exercise.programExerciseId}
            exercise={exercise}
            sets={sets[exercise.programExerciseId] ?? []}
            pendingSetNumbers={pending[exercise.programExerciseId] ?? EMPTY_SET}
            onLogSet={(setNumber, values) => logSet(exercise.programExerciseId, setNumber, values)}
          />

          <ErrorNote message={notice} />

          <div className="sticky bottom-20 z-10 flex flex-col gap-2 md:bottom-4">
            {rest && (
              <RestTimer
                key={rest.key}
                seconds={rest.seconds}
                exerciseName={rest.name}
                audio={audio.current}
                onDismiss={() => setRest(null)}
              />
            )}

            <div className="flex gap-2 rounded-card border border-ink-800 bg-ink-950/95 p-2 backdrop-blur">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                disabled={index === 0}
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
              >
                ← Back
              </Button>
              {isLast ? (
                <Button size="lg" className="flex-1" loading={finishing} onClick={() => void finish()}>
                  Finish session
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => setIndex((value) => Math.min(detail.exercises.length - 1, value + 1))}
                >
                  Next →
                </Button>
              )}
            </div>

            {!isLast && (
              <Button
                variant="ghost"
                size="lg"
                loading={finishing}
                onClick={() => void finish()}
                className="bg-ink-950/95"
              >
                Finish session early
              </Button>
            )}
          </div>

          <p className="pt-2 text-center text-xs text-ink-500">
            <Badge tone={sync.pendingTotal > 0 ? 'warn' : 'good'}>
              {sync.pendingTotal > 0 ? `${sync.pendingTotal} waiting to sync` : 'All synced'}
            </Badge>
          </p>
        </>
      )}
    </div>
  );
}

const EMPTY_SET: Set<number> = new Set();

function upsertSet(list: LoggedSet[], set: LoggedSet): LoggedSet[] {
  const next = list.filter((item) => item.setNumber !== set.setNumber);
  next.push(set);
  return next.sort((a, b) => a.setNumber - b.setNumber);
}

/** A day template reused for a new date: keep the plan, drop the old sets. */
function blankSession(template: SessionDetail, sessionId: string, date: ISODate): SessionDetail {
  return {
    ...template,
    sessionId,
    date,
    completedAt: null,
    exercises: template.exercises.map((exercise) => ({ ...exercise, sets: [] })),
  };
}
