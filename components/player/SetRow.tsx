'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Input, cn } from '@/components/shared';
import type { LoggedSet } from '@/types/session';

/**
 * One set. Typing on a phone with chalky hands mid-set is miserable, so every
 * number is pre-filled and adjustable with a thumb-sized stepper; the keyboard
 * is there for the awkward numbers, not for the normal path.
 */

export type SetMode = 'weight_reps' | 'reps' | 'measure';

export interface SetValues {
  repsDone: number | null;
  weightUsed: number | null;
  distanceOrTime: string | null;
}

const WEIGHT_STEP = 2.5;
const REP_STEP = 1;

export function SetRow({
  setNumber,
  mode,
  logged,
  pending,
  defaults,
  onLog,
}: {
  setNumber: number;
  mode: SetMode;
  logged: LoggedSet | null;
  /** True while the set is still only in the local queue. */
  pending: boolean;
  defaults: { weight: number | null; reps: number | null; measure: string | null };
  onLog: (values: SetValues) => void;
}) {
  const [weight, setWeight] = useState(() => numberToInput(logged?.weightUsed ?? defaults.weight));
  const [reps, setReps] = useState(() => numberToInput(logged?.repsDone ?? defaults.reps));
  const [measure, setMeasure] = useState(() => logged?.distanceOrTime ?? defaults.measure ?? '');
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

  function bump(current: string, step: number, min: number): string {
    const value = Number.parseFloat(current);
    const next = Math.max(min, Math.round(((Number.isFinite(value) ? value : 0) + step) * 100) / 100);
    edited.current = true;
    return String(next);
  }

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
      className={cn(
        'rounded-xl border p-3',
        isLogged ? 'border-pitch-500/40 bg-pitch-500/5' : 'border-ink-700 bg-ink-850',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-200">Set {setNumber}</span>
        {isLogged && (
          <span className={cn('text-xs font-medium', pending ? 'text-flare-400' : 'text-pitch-400')}>
            {pending ? 'Saved on this phone' : 'Saved'} · {summarise(logged)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
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
            className={mode === 'reps' ? 'col-span-2' : undefined}
            onChange={(next) => {
              edited.current = true;
              setReps(sanitiseInteger(next));
            }}
            onDown={() => setReps((current) => bump(current, -REP_STEP, 0))}
            onUp={() => setReps((current) => bump(current, REP_STEP, 0))}
          />
        )}
      </div>

      <Button
        size="lg"
        fullWidth
        variant={isLogged ? 'secondary' : 'primary'}
        className="mt-2"
        onClick={submit}
      >
        {isLogged ? 'Update set' : 'Log set'}
      </Button>
    </li>
  );
}

function Stepper({
  label,
  value,
  inputMode,
  className,
  onChange,
  onDown,
  onUp,
}: {
  label: string;
  value: string;
  inputMode: 'decimal' | 'numeric';
  className?: string;
  onChange: (value: string) => void;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium text-ink-400">{label}</span>
      <div className="flex items-stretch gap-1.5">
        <Button
          variant="secondary"
          onClick={onDown}
          aria-label={`Decrease ${label}`}
          className="size-11 shrink-0 px-0 text-xl"
        >
          −
        </Button>
        <div className="min-w-0 flex-1">
          <Input
            value={value}
            inputMode={inputMode}
            type="text"
            autoComplete="off"
            onChange={(event) => onChange(event.target.value)}
            className="tabular text-center text-lg font-semibold"
            aria-label={label}
          />
        </div>
        <Button
          variant="secondary"
          onClick={onUp}
          aria-label={`Increase ${label}`}
          className="size-11 shrink-0 px-0 text-xl"
        >
          +
        </Button>
      </div>
    </div>
  );
}

export function summarise(set: LoggedSet): string {
  const parts: string[] = [];
  if (set.weightUsed !== null) parts.push(`${trim(set.weightUsed)}kg`);
  if (set.repsDone !== null) parts.push(`${set.repsDone} reps`);
  if (set.distanceOrTime) parts.push(set.distanceOrTime);
  return parts.length ? parts.join(' × ') : 'logged';
}

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function numberToInput(value: number | null): string {
  return value === null || Number.isNaN(value) ? '' : trim(value);
}

function sanitiseDecimal(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [head, ...rest] = cleaned.split('.');
  return rest.length ? `${head}.${rest.join('').slice(0, 2)}` : head;
}

function sanitiseInteger(value: string): string {
  return value.replace(/\D/g, '').slice(0, 3);
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function parseInteger(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
