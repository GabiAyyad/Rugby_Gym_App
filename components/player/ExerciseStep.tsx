'use client';

import { useState } from 'react';
import { Badge, Button, cn } from '@/components/shared';
import { formatShortDate } from '@/lib/domain/week';
import type { LoggedSet, SessionExercise } from '@/types/session';
import { SetRow, summarise, type SetMode, type SetValues } from './SetRow';

/**
 * One exercise in the session: what to do, what you did last time, and the rows
 * to log it. Deliberately one exercise per screen — scrolling a full workout on
 * a phone between sets is how sets get logged against the wrong lift.
 */

export function ExerciseStep({
  exercise,
  sets,
  pendingSetNumbers,
  onLogSet,
}: {
  exercise: SessionExercise;
  sets: LoggedSet[];
  /** Set numbers still sitting in the local queue. */
  pendingSetNumbers: Set<number>;
  onLogSet: (setNumber: number, values: SetValues) => void;
}) {
  // Reset per exercise comes from the caller's `key`, not from an effect.
  const [extraSets, setExtraSets] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  const mode = setMode(exercise);
  const loggedByNumber = new Map(sets.map((set) => [set.setNumber, set]));
  const highestLogged = sets.reduce((max, set) => Math.max(max, set.setNumber), 0);
  const rowCount = Math.max(exercise.targetSets, highestLogged) + extraSets;
  const rows = Array.from({ length: rowCount }, (_, index) => index + 1);

  const embed = exercise.exercise.videoUrl ? youtubeEmbed(exercise.exercise.videoUrl) : null;
  const link = exercise.exercise.videoUrl ? externalHref(exercise.exercise.videoUrl) : null;
  const done = sets.length;

  return (
    <section className="flex flex-col gap-4">
      <header>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl leading-tight font-bold text-ink-50">{exercise.exercise.name}</h2>
          <Badge tone={done >= exercise.targetSets ? 'good' : 'neutral'}>
            {done}/{exercise.targetSets} sets
          </Badge>
        </div>
        <p className="mt-1 text-sm text-ink-300">
          <span className="font-semibold text-ink-100">
            {exercise.targetSets} × {exercise.targetReps}
          </span>
          <span className="text-ink-500"> · </span>
          <span>{exercise.restSeconds}s rest</span>
          {exercise.exercise.movementPattern && (
            <>
              <span className="text-ink-500"> · </span>
              <span>{exercise.exercise.movementPattern}</span>
            </>
          )}
        </p>
      </header>

      {exercise.notes && (
        <p className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-200">
          <span className="font-semibold text-ink-100">Coach: </span>
          {exercise.notes}
        </p>
      )}

      <div
        className={cn(
          'rounded-xl border px-3 py-2 text-sm',
          exercise.suggestion.isProgression
            ? 'border-pitch-500/40 bg-pitch-500/10 text-pitch-400'
            : 'border-ink-700 bg-ink-900 text-ink-300',
        )}
      >
        <p className="font-medium">{exercise.suggestion.reason}</p>
        {exercise.lastSession && (
          <p className="mt-1 text-xs text-ink-400">
            Last time ({formatShortDate(exercise.lastSession.date)}):{' '}
            {exercise.lastSession.sets.map(summarise).join(', ')}
          </p>
        )}
      </div>

      {(embed || link) && (
        <div>
          {embed ? (
            <>
              <Button variant="secondary" fullWidth onClick={() => setShowVideo((value) => !value)}>
                {showVideo ? 'Hide demo' : 'Watch demo'}
              </Button>
              {showVideo && (
                <div className="mt-2 aspect-video w-full overflow-hidden rounded-xl border border-ink-700 bg-black">
                  <iframe
                    src={embed}
                    title={`${exercise.exercise.name} demonstration`}
                    className="size-full"
                    loading="lazy"
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              )}
            </>
          ) : (
            <a
              href={link ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 px-4 text-sm font-medium text-ink-200"
            >
              Open demo video ↗
            </a>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map((setNumber) => (
          <SetRow
            key={setNumber}
            setNumber={setNumber}
            mode={mode}
            logged={loggedByNumber.get(setNumber) ?? null}
            pending={pendingSetNumbers.has(setNumber)}
            defaults={{
              weight: exercise.suggestion.weight,
              reps: exercise.suggestion.reps,
              measure: exercise.suggestion.distanceOrTime,
            }}
            onLog={(values) => onLogSet(setNumber, values)}
          />
        ))}
      </ul>

      <Button variant="ghost" fullWidth onClick={() => setExtraSets((value) => value + 1)}>
        + Add another set
      </Button>
    </section>
  );
}

function setMode(exercise: SessionExercise): SetMode {
  switch (exercise.exercise.progressionType) {
    case 'bodyweight_plyo':
      return 'reps';
    case 'carry_loaded':
      return 'measure';
    default:
      return 'weight_reps';
  }
}

/**
 * youtube-nocookie, so watching a demo mid-session does not hand the player's
 * gym habits to an ad profile. Anything that is not YouTube is linked, not framed.
 */
export function youtubeEmbed(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` : null;
}

/** Only http(s) links leave the app — a scheme-less or javascript: url is dropped. */
function externalHref(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function youtubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const valid = (id: string | undefined | null): string | null =>
    id && /^[\w-]{11}$/.test(id) ? id : null;

  if (host === 'youtu.be') return valid(parsed.pathname.slice(1).split('/')[0]);
  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtube-nocookie.com') {
    return null;
  }
  if (parsed.pathname === '/watch') return valid(parsed.searchParams.get('v'));

  const [, segment, id] = parsed.pathname.split('/');
  if (segment === 'embed' || segment === 'shorts' || segment === 'live' || segment === 'v') {
    return valid(id);
  }
  return null;
}
