'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise } from '@/types/exercise';
import {
  Badge,
  EmptyState,
  ErrorNote,
  Input,
  LoadingState,
  Modal,
  progressionShortLabel,
  progressionTone,
} from '@/components/shared';

/**
 * The progression type is shown next to every exercise because it is what
 * decides the weight the player gets suggested — picking "Back squat" as an
 * isolation lift is a programming bug you want to catch here, not in the gym.
 */

export function ExercisePicker({
  open,
  exercises,
  loading,
  error,
  onSelect,
  onClose,
}: {
  open: boolean;
  exercises: Exercise[];
  loading: boolean;
  error: string | null;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // The dialog opens on the next tick; focus once it is actually there. The
    // last search is kept but selected, so adding three squat variants in a row
    // keeps the filter, and typing anything replaces it.
    const id = window.setTimeout(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, 50);
    return () => window.clearTimeout(id);
  }, [open]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name));
    if (!needle) return sorted;
    return sorted.filter(
      (exercise) =>
        exercise.name.toLowerCase().includes(needle) ||
        (exercise.movementPattern ?? '').toLowerCase().includes(needle) ||
        progressionShortLabel(exercise.progressionType).toLowerCase().includes(needle),
    );
  }, [exercises, query]);

  return (
    <Modal open={open} onClose={onClose} title="Add an exercise">
      <div className="flex flex-col gap-3">
        <Input
          ref={searchRef}
          placeholder="Search the library…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          aria-label="Search exercises"
        />

        <ErrorNote message={error} />

        {loading ? (
          <LoadingState label="Loading the exercise library…" />
        ) : matches.length === 0 ? (
          <EmptyState
            title={exercises.length === 0 ? 'The exercise library is empty' : 'Nothing matches'}
            description={
              exercises.length === 0
                ? 'Add exercises on the Exercises screen first — programs are built from that shared library.'
                : 'Try a shorter search, or a movement pattern like "squat" or "hinge".'
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {matches.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  onClick={() => onSelect(exercise)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-left transition-colors hover:border-pitch-500 hover:bg-ink-850"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-50">{exercise.name}</span>
                    {exercise.movementPattern && (
                      <span className="block truncate text-xs text-ink-400">
                        {exercise.movementPattern}
                      </span>
                    )}
                  </span>
                  <Badge tone={progressionTone(exercise.progressionType)}>
                    {progressionShortLabel(exercise.progressionType)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
