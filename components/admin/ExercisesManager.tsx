'use client';

import { useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Input,
  Modal,
  PROGRESSION_TYPES,
  PageHeader,
  Select,
  progressionLabel,
} from '@/components/shared';
import type { ProgressionType } from '@/types/database';
import type { CreateExerciseInput, Exercise, ListExercisesResult } from '@/types/exercise';
import { ExerciseForm } from './ExerciseForm';

const TYPE_TONE: Record<ProgressionType, 'good' | 'info' | 'warn' | 'neutral'> = {
  heavy_compound: 'good',
  light_compound_isolation: 'info',
  bodyweight_plyo: 'warn',
  carry_loaded: 'neutral',
};

/**
 * One global library for both squads. ~40 rows, so the whole list is fetched on
 * the server and search/filter happen here — no round trip per keystroke.
 */
export function ExercisesManager({ initialExercises }: { initialExercises: Exercise[] }) {
  const [exercises, setExercises] = useState(initialExercises);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ProgressionType | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Exercise | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return exercises.filter((exercise) => {
      if (typeFilter !== 'all' && exercise.progressionType !== typeFilter) return false;
      if (!needle) return true;
      return (
        exercise.name.toLowerCase().includes(needle) ||
        (exercise.movementPattern ?? '').toLowerCase().includes(needle)
      );
    });
  }, [exercises, query, typeFilter]);

  async function refresh() {
    const { exercises: next } = await api.get<ListExercisesResult>('/api/admin/exercises');
    setExercises(next);
  }

  async function submitNew(input: CreateExerciseInput) {
    setError(null);
    await api.post<Exercise>('/api/admin/exercises', input);
    await refresh();
    setCreating(false);
  }

  async function submitEdit(input: CreateExerciseInput) {
    if (!editing) return;
    setError(null);
    await api.patch<Exercise>(`/api/admin/exercises/${editing.id}`, input);
    await refresh();
    setEditing(null);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await api.delete(`/api/admin/exercises/${pendingDelete.id}`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not delete that exercise.');
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Exercises"
        subtitle={`Shared library for both squads · ${exercises.length} ${exercises.length === 1 ? 'exercise' : 'exercises'}`}
        action={<Button onClick={() => setCreating(true)}>Add exercise</Button>}
      />

      <ErrorNote message={error} />

      <div className="mt-1 mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="sm:flex-1">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or pattern"
            aria-label="Search exercises"
          />
        </div>
        <div className="sm:w-56">
          <Select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as ProgressionType | 'all')}
            aria-label="Filter by progression type"
          >
            <option value="all">All progression types</option>
            {PROGRESSION_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {exercises.length === 0 ? (
        <EmptyState
          title="No exercises yet"
          description="Build the library first — programs are assembled from these."
          icon={<span className="text-3xl">🏋️</span>}
          action={<Button onClick={() => setCreating(true)}>Add the first exercise</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          description="Try a different search or clear the progression filter."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setTypeFilter('all');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((exercise) => (
            <li key={exercise.id}>
              <div className="flex items-start gap-3 rounded-card border border-ink-800 bg-ink-900 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink-50">{exercise.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={TYPE_TONE[exercise.progressionType]}>
                      {progressionLabel(exercise.progressionType)}
                    </Badge>
                    {exercise.movementPattern && (
                      <Badge tone="neutral">{exercise.movementPattern}</Badge>
                    )}
                    {exercise.videoUrl && (
                      <a
                        href={exercise.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-sky-ish underline underline-offset-2 hover:text-ink-50"
                      >
                        Video
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-11 px-3"
                    onClick={() => setEditing(exercise)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 px-3 text-alert-400 hover:text-alert-400"
                    onClick={() => setPendingDelete(exercise)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Add exercise">
        <ExerciseForm exercise={null} onSubmit={submitNew} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? editing.name : 'Edit exercise'}
      >
        {editing && (
          <ExerciseForm
            key={editing.id}
            exercise={editing}
            onSubmit={submitEdit}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete exercise"
        message={
          pendingDelete
            ? `Delete "${pendingDelete.name}" from the library? If any program still uses it, the delete is blocked and nothing changes.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
