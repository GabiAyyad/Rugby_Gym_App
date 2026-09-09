'use client';

import { useState } from 'react';
import { Badge, Button, cn } from '@/components/shared';
import { formatShortDate } from '@/lib/domain/week';
import { SetRow, summarise } from './SetRow';

/**
 * One exercise "page" within the session logging flow: name, target sets/reps,
 * the progression engine's suggestion, an optional demo video, and the list
 * of SetRow inputs to actually log it. Deliberately one exercise per screen —
 * scrolling a full workout on a phone between sets is how sets get logged
 * against the wrong lift.
 *
 * SessionRunner remounts this component (via its `key` prop) whenever the
 * player switches exercises, so `extraSets`/`showVideo` reset for free without
 * needing an effect to watch for the exercise changing.
 *
 * @param {object} props
 * @param {object} props.exercise A SessionExercise: {exercise, targetSets, targetReps,
 *   restSeconds, notes, suggestion, lastSession, ...} for the exercise being shown.
 * @param {object[]} props.sets Sets already logged for this exercise in the current session.
 * @param {Set<number>} props.pendingSetNumbers Set numbers still only in the local offline queue.
 * @param {(setNumber: number, values: object) => void} props.onLogSet Called when a SetRow submits.
 */
export function ExerciseStep({ exercise, sets, pendingSetNumbers, onLogSet }) {
  const [extraSets, setExtraSets] = useState(0); // extra blank rows added via "+ Add another set"
  const [showVideo, setShowVideo] = useState(false); // is the demo video expanded?

  const mode = setMode(exercise);
  const loggedByNumber = new Map(sets.map((set) => [set.setNumber, set]));
  const highestLogged = sets.reduce((max, set) => Math.max(max, set.setNumber), 0);
  // Show at least the prescribed number of sets, or however many the player
  // has actually logged if that's more (e.g. they added extra sets last visit),
  // plus any rows added this visit via "+ Add another set".
  const rowCount = Math.max(exercise.targetSets, highestLogged) + extraSets;
  const rows = Array.from({ length: rowCount }, (_, index) => index + 1);

  const embed = exercise.exercise.videoUrl ? youtubeEmbed(exercise.exercise.videoUrl) : null;
  const link = exercise.exercise.videoUrl ? externalHref(exercise.exercise.videoUrl) : null;
  const done = sets.length;

  return (
    <section className="flex flex-col gap-4">
      <header>
        <div className="flex justify-between gap-3" style={{ alignItems: 'flex-start' }}>
          <h2 className="text-xl leading-tight font-bold text-ink-50">{exercise.exercise.name}</h2>
          <Badge tone={done >= exercise.targetSets ? 'good' : 'neutral'}>
            {done}/{exercise.targetSets} sets
          </Badge>
        </div>
        <p className="mt-1 text-sm text-ink-300">
          <span className="font-semibold text-ink-50">
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
        <p className="rounded-xl text-sm text-ink-200" style={{ border: '1px solid var(--ink-700)', background: 'var(--ink-850)', padding: '0.5rem 0.75rem' }}>
          <span className="font-semibold text-ink-50">Coach: </span>
          {exercise.notes}
        </p>
      )}

      <div
        className="rounded-xl text-sm"
        style={
          exercise.suggestion.isProgression
            ? { border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: 'var(--pitch-400)', padding: '0.5rem 0.75rem' }
            : { border: '1px solid var(--ink-700)', background: 'var(--ink-900)', color: 'var(--ink-300)', padding: '0.5rem 0.75rem' }
        }
      >
        <p className="font-medium">{exercise.suggestion.reason}</p>
        {exercise.lastSession && (
          <p className="mt-1 text-xs text-ink-400">
            Last time ({formatShortDate(exercise.lastSession.date)}): {exercise.lastSession.sets.map(summarise).join(', ')}
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
                <div className="mt-2 aspect-video rounded-xl" style={{ overflow: 'hidden', border: '1px solid var(--ink-700)', background: '#000' }}>
                  <iframe
                    src={embed}
                    title={`${exercise.exercise.name} demonstration`}
                    loading="lazy"
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              )}
            </>
          ) : (
            <a href={link ?? '#'} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center text-sm font-medium text-ink-200" style={{ minHeight: '2.75rem', borderRadius: '0.75rem', border: '1px solid var(--ink-700)', background: 'var(--ink-850)', padding: '0 1rem', textDecoration: 'none' }}>
              Open demo video ↗
            </a>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0 }}>
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

/** Maps an exercise's progressionType to which fields SetRow should show for it. */
function setMode(exercise) {
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
export function youtubeEmbed(url) {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` : null;
}

/** Only http(s) links leave the app — a scheme-less or javascript: url is dropped. */
function externalHref(url) {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Extracts an 11-character YouTube video id from any of youtu.be/watch/embed/shorts/live URL shapes, or null if it isn't a recognisable YouTube link. */
function youtubeId(url) {
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  // A YouTube id is always exactly 11 URL-safe characters — reject anything else.
  const valid = (id) => (id && /^[\w-]{11}$/.test(id) ? id : null);

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
