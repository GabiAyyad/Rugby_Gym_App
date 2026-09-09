'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Input, cn } from '@/components/shared';

/**
 * One set. Typing on a phone with chalky hands mid-set is miserable, so every
 * number is pre-filled and adjustable with a thumb-sized stepper; the keyboard
 * is there for the awkward numbers, not for the normal path.
 */

const WEIGHT_STEP = 2.5; // kg per tap of the +/- weight stepper
const REP_STEP = 1; // reps per tap of the +/- rep stepper

/**
 * One set within an exercise: a weight/rep (or reps-only, or distance/time)
 * input row with +/- steppers, plus a "Log set"/"Update set" button.
 *
 * @param {object} props
 * @param {number} props.setNumber Which set this is (1, 2, 3, ...) — shown as the row's label.
 * @param {'weight_reps'|'reps'|'measure'} props.mode Which fields to show: both weight
 *   and reps, reps only (bodyweight work), or a free-text distance/time (carries).
 * @param {object|null} props.logged The set as already saved (server or local queue), or
 *   null if this set hasn't been logged yet — controls the "Log"/"Update" wording and colour.
 * @param {boolean} props.pending True while this set is saved locally but not yet confirmed
 *   by the server — shown as "Saved on this phone" instead of "Saved".
 * @param {{weight: number|null, reps: number|null, measure: string|null}} props.defaults
 *   The progression engine's suggested starting values, used to pre-fill the inputs
 *   when there's nothing already logged for this set.
 * @param {(values: object) => void} props.onLog Called with {weightUsed, repsDone,
 *   distanceOrTime} when the player taps Log/Update.
 */
export function SetRow({ setNumber, mode, logged, pending, defaults, onLog }) {
  const [weight, setWeight] = useState(() => numberToInput(logged?.weightUsed ?? defaults.weight));
  const [reps, setReps] = useState(() => numberToInput(logged?.repsDone ?? defaults.reps));
  const [measure, setMeasure] = useState(() => logged?.distanceOrTime ?? defaults.measure ?? '');
  // Tracks whether the player has touched an input since the last time this
  // row's values were set from outside (see the effect below) — once true,
  // incoming updates (e.g. a sync landing) are ignored until submit() resets it.
  const edited = useRef(false);

  // Adopt values that arrive from outside (a sync landing, a queue replay) but
  // never overwrite something the player is in the middle of typing.
  const signature = `${logged?.weightUsed ?? ''}|${logged?.repsDone ?? ''}|${logged?.distanceOrTime ?? ''}|${defaults.weight ?? ''}|${defaults.reps ?? ''}|${defaults.measure ?? ''}`;
  useEffect(() => {
    if (edited.current) return;
    setWeight(numberToInput(logged?.weightUsed ?? defaults.weight));
    setReps(numberToInput(logged?.repsDone ?? defaults.reps));
    setMeasure(logged?.distanceOrTime ?? defaults.measure ?? '');
    // Values are derived from `signature`; listing them all would re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  /** +/- stepper logic: adds `step` to the current input value (clamped to `min`), rounded to 2dp. */
  function bump(current, step, min) {
    const value = Number.parseFloat(current);
    const next = Math.max(min, Math.round(((Number.isFinite(value) ? value : 0) + step) * 100) / 100);
    edited.current = true;
    return String(next);
  }

  /** "Log set"/"Update set" tapped: parses the three text inputs and reports the set upward. */
  function submit() {
    edited.current = false;
    onLog({
      weightUsed: mode === 'reps' ? null : parseNumber(weight),
      repsDone: mode === 'measure' ? null : parseInteger(reps),
      distanceOrTime: mode === 'measure' ? measure.trim() || null : null,
    });
  }

  const isLogged = logged !== null;

  return (
    <li
      className="rounded-xl p-3"
      style={{ border: `1px solid ${isLogged ? 'rgba(34,197,94,0.4)' : 'var(--ink-700)'}`, background: isLogged ? 'rgba(34,197,94,0.05)' : 'var(--ink-850)' }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-200">Set {setNumber}</span>
        {isLogged && (
          <span className="text-xs font-medium" style={{ color: pending ? 'var(--flare-400)' : 'var(--pitch-400)' }}>
            {pending ? 'Saved on this phone' : 'Saved'} · {summarise(logged)}
          </span>
        )}
      </div>

      <div className="grid-cols-2" style={{ display: 'grid', gap: '0.5rem' }}>
        {mode !== 'reps' && (
          <Stepper
            label="Weight (kg)"
            value={weight}
            inputMode="decimal"
            onChange={(next) => {
              edited.current = true;
              setWeight(sanitiseDecimal(next));
            }}
            onDown={() => setWeight((current) => bump(current, -WEIGHT_STEP, 0))}
            onUp={() => setWeight((current) => bump(current, WEIGHT_STEP, 0))}
          />
        )}

        {mode === 'measure' ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-400">Distance / time</span>
            <Input
              value={measure}
              inputMode="text"
              placeholder="40m"
              onChange={(event) => {
                edited.current = true;
                setMeasure(event.target.value.slice(0, 40));
              }}
              className="text-center text-lg font-semibold"
            />
          </div>
        ) : (
          <Stepper
            label="Reps"
            value={reps}
            inputMode="numeric"
            className={mode === 'reps' ? 'notes-span' : undefined}
            onChange={(next) => {
              edited.current = true;
              setReps(sanitiseInteger(next));
            }}
            onDown={() => setReps((current) => bump(current, -REP_STEP, 0))}
            onUp={() => setReps((current) => bump(current, REP_STEP, 0))}
          />
        )}
      </div>

      <Button size="lg" fullWidth variant={isLogged ? 'secondary' : 'primary'} className="mt-2" onClick={submit}>
        {isLogged ? 'Update set' : 'Log set'}
      </Button>
    </li>
  );
}

/** A labelled text input flanked by -/+ buttons — the weight/rep input widget used above. */
function Stepper({ label, value, inputMode, className, onChange, onDown, onUp }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium text-ink-400">{label}</span>
      <div className="flex gap-1-5" style={{ alignItems: 'stretch' }}>
        <Button variant="secondary" onClick={onDown} aria-label={`Decrease ${label}`} className="size-11 shrink-0 text-xl" style={{ padding: 0 }}>
          −
        </Button>
        <div className="min-w-0 flex-1">
          <Input value={value} inputMode={inputMode} type="text" autoComplete="off" onChange={(event) => onChange(event.target.value)} className="tabular text-center text-lg font-semibold" aria-label={label} />
        </div>
        <Button variant="secondary" onClick={onUp} aria-label={`Increase ${label}`} className="size-11 shrink-0 text-xl" style={{ padding: 0 }}>
          +
        </Button>
      </div>
    </div>
  );
}

/** Renders a logged set as "102.5kg × 5 reps" (or just whichever parts are present). Exported for reuse by ExerciseStep's "last time" summary. */
export function summarise(set) {
  const parts = [];
  if (set.weightUsed !== null) parts.push(`${trim(set.weightUsed)}kg`);
  if (set.repsDone !== null) parts.push(`${set.repsDone} reps`);
  if (set.distanceOrTime) parts.push(set.distanceOrTime);
  return parts.length ? parts.join(' × ') : 'logged';
}

/** Rounds a number to 2 decimal places and stringifies it (drops trailing zeros, e.g. 102.50 -> "102.5"). */
function trim(value) {
  return String(Math.round(value * 100) / 100);
}

/** Converts a nullable numeric value into the string an <input> expects (empty string for null/NaN). */
function numberToInput(value) {
  return value === null || Number.isNaN(value) ? '' : trim(value);
}

/** Keeps only digits and a single decimal point while typing a weight, and caps it to 2dp. */
function sanitiseDecimal(value) {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [head, ...rest] = cleaned.split('.');
  return rest.length ? `${head}.${rest.join('').slice(0, 2)}` : head;
}

/** Keeps only digits while typing a rep count, capped at 3 digits (matches the server's MAX_REPS check). */
function sanitiseInteger(value) {
  return value.replace(/\D/g, '').slice(0, 3);
}

/** Parses a weight input string to a rounded number, or null if it's blank/invalid. */
function parseNumber(value) {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

/** Parses a rep-count input string to an integer, or null if it's blank/invalid. */
function parseInteger(value) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
