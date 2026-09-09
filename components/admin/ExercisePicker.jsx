'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, EmptyState, ErrorNote, Input, LoadingState, Modal, progressionShortLabel, progressionTone } from '@/components/shared';

/**
 * Modal search-and-pick list used by ProgramDayEditor when a coach adds an
 * exercise to a training day. Opens on top of the ProgramBuilder screen.
 *
 * The progression type is shown next to every exercise because it is what
 * decides the weight the player gets suggested — picking "Back squat" as an
 * isolation lift is a programming bug you want to catch here, not in the gym.
 *
 * @param {object} props
 * @param {boolean} props.open Whether the modal is visible.
 * @param {object[]} props.exercises The full exercise library to search.
 * @param {boolean} props.loading Shows a loading state instead of the list while the library is being fetched.
 * @param {string|null} props.error Shown as an ErrorNote if the library failed to load.
 * @param {(exercise: object) => void} props.onSelect Called with the chosen exercise.
 * @param {() => void} props.onClose Called to close the modal without picking anything.
 */
export function ExercisePicker({ open, exercises, loading, error, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);

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
        <Input ref={searchRef} placeholder="Search the library…" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" aria-label="Search exercises" />

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
          <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0 }}>
            {matches.map((exercise) => (
              <li key={exercise.id}>
                <button type="button" onClick={() => onSelect(exercise)} className="picker-row">
                  <span className="min-w-0">
                    <span className="truncate font-medium text-ink-50" style={{ display: 'block' }}>
                      {exercise.name}
                    </span>
                    {exercise.movementPattern && (
                      <span className="truncate text-xs text-ink-400" style={{ display: 'block' }}>
                        {exercise.movementPattern}
                      </span>
                    )}
                  </span>
                  <Badge tone={progressionTone(exercise.progressionType)}>{progressionShortLabel(exercise.progressionType)}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
