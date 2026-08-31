import type { ReactNode } from 'react';
import { cn } from './cn';

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-800 text-ink-300 border-ink-700',
  good: 'bg-pitch-500/15 text-pitch-400 border-pitch-500/30',
  warn: 'bg-flare-500/15 text-flare-400 border-flare-500/30',
  bad: 'bg-alert-500/15 text-alert-400 border-alert-500/30',
  info: 'bg-sky-ish/15 text-sky-ish border-sky-ish/30',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
