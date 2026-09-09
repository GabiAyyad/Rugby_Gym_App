'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, ErrorNote, LoadingState, cn } from '@/components/shared';
import { api } from '@/lib/api';
import { formatShortDate } from '@/lib/domain/week';
import { cacheSessionDetail, enqueueCompletion, enqueueLog, readCachedSessionDetail, readDayTemplate, readLocalSession, readQueueFor, readServerSessionId } from '@/lib/offline/queue';
import { flushNow, useOfflineSync } from '@/lib/offline/useOfflineSync';
import { ExerciseStep } from './ExerciseStep';
import { OfflineBanner } from './OfflineBanner';
import { RestTimer, createAudioContext } from './RestTimer';

/**
 * The set-by-set logging screen: steps through a session's exercises one at a
 * time (via <ExerciseStep>), showing a rest timer after each logged set, and
 * finishing with a "Finish session" action.
 *
 * Every write goes to the local queue first and to the screen immediately; the
 * network is never on the path between a player finishing a set and seeing it
 * recorded. The session itself can come from three places — the server render,
 * the IndexedDB cache, or a day template captured last time the player was
 * online — which is what lets a session start with no signal at all (see the
 * `load()` effect below for exactly which source wins).
 *
 * @param {object} props
 * @param {string} props.sessionId The session to run. May be a real server id,
 *   or a locally-minted id (see lib/offline/queue.js's saveLocalSession) for a
 *   session that was started with no signal and hasn't synced yet.
 * @param {object|null} props.initialDetail The SessionDetail rendered
 *   server-side, or null if the page couldn't fetch it (offline, or a
 *   not-yet-synced local session id).
 * @param {() => void} [props.onExit] Called instead of navigating to
 *   /player/today when the player closes/finishes — used when WeekBoard
 *   renders this component inline (offline mode) rather than as its own page.
 */
export function SessionRunner({ sessionId, initialDetail, onExit }) {
  const router = useRouter();
  const sync = useOfflineSync();

  const [detail, setDetail] = useState(initialDetail); // the session's exercises/targets/suggestions (static-ish; sets are tracked separately below)
  const [loadState, setLoadState] = useState(initialDetail ? 'ready' : 'loading'); // 'loading' | 'ready' | 'missing'
  const [serverBacked, setServerBacked] = useState(initialDetail !== null); // does `sessionId` refer to a real server row yet?
  const [index, setIndex] = useState(0); // which exercise is currently shown
  const [sets, setSets] = useState({}); // programExerciseId -> LoggedSet[] actually shown on screen (server + queued, merged)
  const [pending, setPending] = useState({}); // programExerciseId -> Set<setNumber> still only in the local queue
  const [rest, setRest] = useState(null); // the active RestTimer's {key, seconds, name}, or null
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(initialDetail?.completedAt != null);
  const [notice, setNotice] = useState(null); // inline status message (e.g. "N sets still on this phone")
  const audio = useRef(null); // lazily-created AudioContext for the rest-timer beep (see logSet below)

  /* ------------------------------------------------------------- loading */

  // Resolves `detail` from whichever source is available, in priority order:
  // 1. the server-rendered `initialDetail` prop (just cache it locally too)
  // 2. this session's own IndexedDB cache (a reload of this exact screen)
  // 3. a locally-minted session's day template (started offline, never synced)
  // 4. a live fetch, if online
  // Falls through to `loadState: 'missing'` if none of those produced anything.
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
          const fetched = await api.get(`/api/player/session/${sessionId}`);
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

  // Rebuilds `sets` from `detail`'s own sets plus whatever is still queued
  // locally for this session. Deliberately depends only on `detail` (not on
  // the queue's contents) and runs only when the session itself changes: a
  // sync draining the queue would otherwise re-run this and, for a brief
  // moment, wipe sets off the screen right as they were safely saved.
  useEffect(() => {
    if (!detail) return;
    let cancelled = false;

    async function merge(current) {
      const queued = await readQueueFor(current.programDayId, current.date);
      if (cancelled) return;

      const merged = {};
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

  // Recomputes `pending` (which set numbers are still only on this phone)
  // whenever the queue drains, so the "Saved on this phone" markers in
  // SetRow clear on their own the moment a sync confirms them.
  const syncedAt = sync.lastSyncedAt;
  const pendingCount = sync.pendingSets;
  useEffect(() => {
    if (!detail) return;
    let cancelled = false;

    void readQueueFor(detail.programDayId, detail.date).then((queued) => {
      if (cancelled) return;
      const map = {};
      for (const entry of queued) {
        const numbers = map[entry.programExerciseId] ?? new Set();
        numbers.add(entry.setNumber);
        map[entry.programExerciseId] = numbers;
      }
      setPending(map);
    });

    return () => {
      cancelled = true;
    };
  }, [detail, syncedAt, pendingCount]);

  // Debounced (400ms) write-back to the IndexedDB cache whenever `sets`
  // changes, so this phone's copy of the session stays in step with what's on
  // screen — meaning a session closed and reopened with no signal comes back
  // with all its sets intact, not just the ones that had already synced.
  useEffect(() => {
    if (!detail) return;
    const merged = {
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

  /**
   * Called by ExerciseStep/SetRow when a set is logged. Updates the on-screen
   * state immediately (optimistic — no network wait), starts the rest timer,
   * and queues the write locally; the queue is then flushed in the background
   * regardless of whether that succeeds right away.
   */
  const logSet = useCallback(
    (programExerciseId, setNumber, values) => {
      if (!detail) return;

      // Built here, inside the tap that logged the set: an AudioContext created
      // later would be blocked by autoplay policy and the rest beep lost.
      if (!audio.current) audio.current = createAudioContext();

      const exercise = detail.exercises.find((item) => item.programExerciseId === programExerciseId);
      const set = { setNumber, repsDone: values.repsDone, weightUsed: values.weightUsed, distanceOrTime: values.distanceOrTime };

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
      setRest({ key: Date.now(), seconds: exercise?.restSeconds ?? 90, name: exercise?.exercise.name ?? '' });

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

  /** Resolves the real server session id for `current`, starting the session server-side first if it's still only local. */
  async function resolveServerSessionId(current) {
    if (serverBacked) return current.sessionId;
    const known = await readServerSessionId(current.programDayId, current.date);
    if (known) return known;
    const started = await api.post('/api/player/session', { programDayId: current.programDayId, date: current.date });
    return started.sessionId;
  }

  /**
   * "Finish session" tapped. Three outcomes depending on connectivity/queue state:
   *  - offline: queues a "completion" locally and leaves; it's recorded on next sync.
   *  - online but sets are still queued: flushes first, and if anything is left
   *    over after that, tells the player rather than silently finishing anyway.
   *  - online and everything flushed: marks it complete on the server and leaves.
   */
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
        setNotice(`${outstanding.length} ${outstanding.length === 1 ? 'set is' : 'sets are'} still on this phone. They are not lost — tap Retry sync, then finish.`);
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

  /** Navigates away from the logging screen — or, when embedded inline (offline mode), calls `onExit` instead. */
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
      <header className="flex justify-between gap-3" style={{ alignItems: 'flex-start' }}>
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-ink-400 uppercase">{detail.programName}</p>
          <h1 className="text-xl leading-tight font-bold text-ink-50">
            Day {detail.dayNumber}
            {detail.label ? ` · ${detail.label}` : ''}
          </h1>
          <p className="mt-1" style={{ marginTop: '0.125rem' }}>
            <span className="text-sm text-ink-400">
              {formatShortDate(detail.date)} · {loggedSets}/{totalSets} sets logged
            </span>
          </p>
        </div>
        <Button variant="ghost" onClick={leave} className="shrink-0">
          Close
        </Button>
      </header>

      <OfflineBanner />

      {finished && (
        <div className="rounded-xl text-sm" style={{ border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: 'var(--pitch-400)', padding: '0.5rem 0.75rem' }}>
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
          <ol className="flex flex-wrap gap-1-5" aria-label="Exercises in this session" style={{ listStyle: 'none', padding: 0 }}>
            {detail.exercises.map((item, position) => {
              const complete = (sets[item.programExerciseId]?.length ?? 0) >= item.targetSets;
              return (
                <li key={item.programExerciseId}>
                  <button
                    type="button"
                    onClick={() => setIndex(position)}
                    aria-label={`${item.exercise.name}${complete ? ', complete' : ''}`}
                    aria-current={position === index ? 'step' : undefined}
                    className="size-11 rounded-lg text-sm font-semibold"
                    style={{
                      border: `1px solid ${position === index ? 'var(--pitch-500)' : complete ? 'rgba(34,197,94,0.4)' : 'var(--ink-700)'}`,
                      background: position === index ? 'var(--pitch-500)' : complete ? 'rgba(34,197,94,0.1)' : 'var(--ink-900)',
                      color: position === index ? 'var(--ink-950)' : complete ? 'var(--pitch-400)' : 'var(--ink-300)',
                      cursor: 'pointer',
                    }}
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

          <div className="sticky flex flex-col gap-2" style={{ bottom: '5rem', zIndex: 10 }}>
            {rest && <RestTimer key={rest.key} seconds={rest.seconds} exerciseName={rest.name} audio={audio.current} onDismiss={() => setRest(null)} />}

            <div className="flex gap-2 rounded-card backdrop-blur" style={{ border: '1px solid var(--ink-800)', background: 'rgba(14,18,17,0.95)', padding: '0.5rem' }}>
              <Button variant="secondary" size="lg" className="flex-1" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
                ← Back
              </Button>
              {isLast ? (
                <Button size="lg" className="flex-1" loading={finishing} onClick={() => void finish()}>
                  Finish session
                </Button>
              ) : (
                <Button size="lg" className="flex-1" onClick={() => setIndex((value) => Math.min(detail.exercises.length - 1, value + 1))}>
                  Next →
                </Button>
              )}
            </div>

            {!isLast && (
              <Button variant="ghost" size="lg" loading={finishing} onClick={() => void finish()} style={{ background: 'rgba(14,18,17,0.95)' }}>
                Finish session early
              </Button>
            )}
          </div>

          <p className="pt-2 text-center text-xs text-ink-500">
            <Badge tone={sync.pendingTotal > 0 ? 'warn' : 'good'}>{sync.pendingTotal > 0 ? `${sync.pendingTotal} waiting to sync` : 'All synced'}</Badge>
          </p>
        </>
      )}
    </div>
  );
}

const EMPTY_SET = new Set(); // shared constant so `pending[id] ?? EMPTY_SET` never allocates a new Set every render

/** Replaces the set numbered `set.setNumber` in `list` (or appends it), keeping the list sorted by set number. */
function upsertSet(list, set) {
  const next = list.filter((item) => item.setNumber !== set.setNumber);
  next.push(set);
  return next.sort((a, b) => a.setNumber - b.setNumber);
}

/** A day template reused for a new date: keep the plan, drop the old sets. */
function blankSession(template, sessionId, date) {
  return {
    ...template,
    sessionId,
    date,
    completedAt: null,
    exercises: template.exercises.map((exercise) => ({ ...exercise, sets: [] })),
  };
}
