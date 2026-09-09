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

const TICK_MS = 200; // how often the displayed countdown re-reads the clock
const EXTEND_MS = 30_000; // how much time "+30s" adds

/**
 * Must be created inside the user gesture that starts the timer: an
 * AudioContext built later is suspended by autoplay policy and the beep is lost.
 */
export function createAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/** Schedules one short sine-wave beep on an AudioContext, starting at time `at` (seconds) and fading in/out to avoid a click. */
function beep(context, at, frequency) {
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
function alertPlayer(context) {
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

/** Formats milliseconds as "M:SS" for the big countdown display. */
function clock(ms) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The countdown card shown between sets. Mounted with a fresh `key` each time
 * a set is logged (see SessionRunner), so its whole state resets per rest period.
 *
 * @param {object} props
 * @param {number} props.seconds How long to count down from, taken from the exercise's rest_seconds.
 * @param {AudioContext|null} props.audio The AudioContext created at tap-time
 *   in SessionRunner (must be created inside a user gesture — see createAudioContext above).
 * @param {string} props.exerciseName Shown in the "Resting · <name>" label.
 * @param {() => void} props.onDismiss Called when the player taps Skip/Done.
 */
export function RestTimer({ seconds, audio, exerciseName, onDismiss }) {
  const [totalMs, setTotalMs] = useState(() => Math.max(1, seconds) * 1000); // grows when "+30s" is tapped, for the progress bar's denominator
  const [endsAt, setEndsAt] = useState(() => Date.now() + Math.max(1, seconds) * 1000); // wall-clock time the rest ends
  const [pausedMs, setPausedMs] = useState(null); // remaining ms frozen at pause time, or null if running
  const [remaining, setRemaining] = useState(() => Math.max(1, seconds) * 1000);
  const fired = useRef(false); // has the alert already played for this countdown?

  // Recomputes `remaining` from the stored `endsAt` timestamp on every tick,
  // rather than counting down by subtracting TICK_MS each time — a
  // setInterval can be throttled or entirely suspended while the phone screen
  // is locked, so accumulating ticks would drift; reading the clock never does.
  useEffect(() => {
    const tick = () => {
      setRemaining(pausedMs !== null ? pausedMs : Math.max(0, endsAt - Date.now()));
    };
    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [endsAt, pausedMs]);

  // Fires the beep/vibration exactly once, the moment `remaining` reaches 0.
  useEffect(() => {
    if (remaining > 0 || fired.current) return;
    fired.current = true;
    alertPlayer(audio);
  }, [remaining, audio]);

  const done = remaining <= 0;
  const progress = Math.min(100, Math.max(0, 100 - (remaining / totalMs) * 100));

  /** "+30s" tapped: pushes the end time back (or the paused remainder forward) and re-arms the alert. */
  function extend() {
    fired.current = false;
    setTotalMs((current) => current + EXTEND_MS);
    if (pausedMs !== null) setPausedMs(pausedMs + EXTEND_MS);
    else setEndsAt((current) => Math.max(current, Date.now()) + EXTEND_MS);
  }

  /** Pause/Resume tapped: freezes the remaining time into `pausedMs`, or converts it back into a fresh `endsAt`. */
  function togglePause() {
    if (pausedMs !== null) {
      setEndsAt(Date.now() + pausedMs);
      setPausedMs(null);
    } else {
      setPausedMs(Math.max(0, endsAt - Date.now()));
    }
  }

  return (
    <div role="timer" aria-live="off" className="rounded-card p-3" style={{ border: `1px solid ${done ? 'var(--pitch-500)' : 'var(--ink-700)'}`, background: 'var(--ink-900)', boxShadow: '0 10px 24px rgba(0,0,0,0.35)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-ink-400">
            {done ? 'Rest over' : 'Resting'} · {exerciseName}
          </p>
          <p className="tabular text-3xl leading-tight font-bold" style={{ color: done ? 'var(--pitch-400)' : 'var(--ink-50)' }}>
            {done ? 'Go' : clock(remaining)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!done && (
            <>
              <Button variant="secondary" onClick={extend} className="px-3" aria-label="Add thirty seconds">
                +30s
              </Button>
              <Button variant="secondary" onClick={togglePause} className="px-3" aria-label={pausedMs !== null ? 'Resume rest' : 'Pause rest'}>
                {pausedMs !== null ? 'Resume' : 'Pause'}
              </Button>
            </>
          )}
          <Button variant={done ? 'primary' : 'ghost'} onClick={onDismiss} className="px-4" aria-label={done ? 'Dismiss rest timer' : 'Skip rest'}>
            {done ? 'Done' : 'Skip'}
          </Button>
        </div>
      </div>

      <div className="mt-2 progress-track" style={{ height: '0.375rem' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: done ? 'var(--pitch-500)' : 'var(--sky-ish)', transition: 'width 0.2s' }} />
      </div>
    </div>
  );
}
