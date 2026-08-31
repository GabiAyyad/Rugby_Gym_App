'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, cn } from '@/components/shared';

/**
 * Rest between sets.
 *
 * Remaining time is always computed from a stored end timestamp rather than
 * accumulated from interval ticks, because phones throttle and suspend timers
 * the moment the screen locks — which is exactly when a player is resting.
 */

const TICK_MS = 200;
const EXTEND_MS = 30_000;

/**
 * Must be created inside the user gesture that starts the timer: an
 * AudioContext built later is suspended by autoplay policy and the beep is lost.
 */
export function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

function beep(context: AudioContext, at: number, frequency: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + 0.3);
}

/** Sound and buzz are both best-effort: no permission, no problem, no error. */
function alertPlayer(context: AudioContext | null): void {
  try {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      const now = context.currentTime;
      beep(context, now + 0.01, 880);
      beep(context, now + 0.4, 1175);
    }
  } catch {
    // Audio is unavailable on this device; the vibration below still fires.
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Vibration API missing or blocked — nothing to do.
  }
}

function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function RestTimer({
  seconds,
  audio,
  exerciseName,
  onDismiss,
}: {
  seconds: number;
  audio: AudioContext | null;
  exerciseName: string;
  onDismiss: () => void;
}) {
  const [totalMs, setTotalMs] = useState(() => Math.max(1, seconds) * 1000);
  const [endsAt, setEndsAt] = useState(() => Date.now() + Math.max(1, seconds) * 1000);
  const [pausedMs, setPausedMs] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(() => Math.max(1, seconds) * 1000);
  const fired = useRef(false);

  useEffect(() => {
    const tick = () => {
      setRemaining(pausedMs !== null ? pausedMs : Math.max(0, endsAt - Date.now()));
    };
    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [endsAt, pausedMs]);

  useEffect(() => {
    if (remaining > 0 || fired.current) return;
    fired.current = true;
    alertPlayer(audio);
  }, [remaining, audio]);

  const done = remaining <= 0;
  const progress = Math.min(100, Math.max(0, 100 - (remaining / totalMs) * 100));

  function extend() {
    fired.current = false;
    setTotalMs((current) => current + EXTEND_MS);
    if (pausedMs !== null) setPausedMs(pausedMs + EXTEND_MS);
    else setEndsAt((current) => Math.max(current, Date.now()) + EXTEND_MS);
  }

  function togglePause() {
    if (pausedMs !== null) {
      setEndsAt(Date.now() + pausedMs);
      setPausedMs(null);
    } else {
      setPausedMs(Math.max(0, endsAt - Date.now()));
    }
  }

  return (
    <div
      role="timer"
      aria-live="off"
      className={cn(
        'rounded-card border bg-ink-900 p-3 shadow-lg transition-colors',
        done ? 'border-pitch-500' : 'border-ink-700',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-ink-400">
            {done ? 'Rest over' : 'Resting'} · {exerciseName}
          </p>
          <p
            className={cn(
              'tabular text-3xl leading-tight font-bold',
              done ? 'text-pitch-400' : 'text-ink-50',
            )}
          >
            {done ? 'Go' : clock(remaining)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!done && (
            <>
              <Button
                variant="secondary"
                onClick={extend}
                className="px-3"
                aria-label="Add thirty seconds"
              >
                +30s
              </Button>
              <Button
                variant="secondary"
                onClick={togglePause}
                className="px-3"
                aria-label={pausedMs !== null ? 'Resume rest' : 'Pause rest'}
              >
                {pausedMs !== null ? 'Resume' : 'Pause'}
              </Button>
            </>
          )}
          <Button
            variant={done ? 'primary' : 'ghost'}
            onClick={onDismiss}
            className="px-4"
            aria-label={done ? 'Dismiss rest timer' : 'Skip rest'}
          >
            {done ? 'Done' : 'Skip'}
          </Button>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
        <div
          className={cn('h-full transition-[width] duration-200', done ? 'bg-pitch-500' : 'bg-sky-ish')}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
