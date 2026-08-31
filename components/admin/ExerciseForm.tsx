'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { Button, ErrorNote, Input, PROGRESSION_TYPES, Select } from '@/components/shared';
import type { ProgressionType } from '@/types/database';
import type { CreateExerciseInput, Exercise } from '@/types/exercise';

export function ExerciseForm({
  exercise,
  onSubmit,
  onCancel,
}: {
  exercise: Exercise | null;
  onSubmit: (input: CreateExerciseInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [videoUrl, setVideoUrl] = useState(exercise?.videoUrl ?? '');
  const [movementPattern, setMovementPattern] = useState(exercise?.movementPattern ?? '');
  const [progressionType, setProgressionType] = useState<ProgressionType>(
    exercise?.progressionType ?? 'heavy_compound',
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const selected = PROGRESSION_TYPES.find((option) => option.value === progressionType);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await onSubmit({
        name: name.trim(),
        videoUrl: videoUrl.trim() || null,
        movementPattern: movementPattern.trim() || null,
        progressionType,
      });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError('Could not save. Check your connection and try again.');
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ErrorNote message={error} />

      <Input
        label="Exercise name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={fieldErrors.name}
        placeholder="Back squat"
        autoFocus
        required
      />

      <div className="flex flex-col gap-1.5">
        <Select
          label="Progression type"
          value={progressionType}
          onChange={(event) => setProgressionType(event.target.value as ProgressionType)}
          error={fieldErrors.progressionType}
        >
          {PROGRESSION_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {selected && (
          <p className="rounded-xl border border-ink-800 bg-ink-850 px-3 py-2 text-xs leading-relaxed text-ink-300">
            {selected.hint}
          </p>
        )}
      </div>

      <Input
        label="Video link"
        type="url"
        inputMode="url"
        value={videoUrl}
        onChange={(event) => setVideoUrl(event.target.value)}
        error={fieldErrors.videoUrl}
        hint="Optional. Shown to the player while they log this exercise."
        placeholder="https://youtu.be/..."
      />

      <Input
        label="Movement pattern"
        value={movementPattern}
        onChange={(event) => setMovementPattern(event.target.value)}
        error={fieldErrors.movementPattern}
        hint="Optional. Squat, hinge, push, pull, carry, sprint..."
        placeholder="Hinge"
      />

      <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {exercise ? 'Save changes' : 'Add exercise'}
        </Button>
      </div>
    </form>
  );
}
