'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { Button, ErrorNote, Input, PROGRESSION_TYPES, Select } from '@/components/shared';

/**
 * Add/edit form for one exercise library entry. Same shape as PlayerForm:
 * pass `exercise` to edit an existing one, or `null` to create a new one.
 *
 * @param {object} props
 * @param {object|null} props.exercise Existing exercise to edit, or null to create.
 * @param {(input: object) => Promise<void>} props.onSubmit Called with
 *   {name, videoUrl, movementPattern, progressionType} on submit.
 * @param {() => void} props.onCancel Called when the user cancels.
 */
export function ExerciseForm({ exercise, onSubmit, onCancel }) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [videoUrl, setVideoUrl] = useState(exercise?.videoUrl ?? '');
  const [movementPattern, setMovementPattern] = useState(exercise?.movementPattern ?? '');
  const [progressionType, setProgressionType] = useState(exercise?.progressionType ?? 'heavy_compound');
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  // The full PROGRESSION_TYPES entry for whatever is currently selected, so its
  // explanatory `hint` text can be shown under the dropdown.
  const selected = PROGRESSION_TYPES.find((option) => option.value === progressionType);

  async function handleSubmit(event) {
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

      <Input label="Exercise name" value={name} onChange={(event) => setName(event.target.value)} error={fieldErrors.name} placeholder="Back squat" autoFocus required />

      <div className="flex flex-col gap-1-5">
        <Select label="Progression type" value={progressionType} onChange={(event) => setProgressionType(event.target.value)} error={fieldErrors.progressionType}>
          {PROGRESSION_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {selected && (
          <p className="rounded-xl text-xs text-ink-300" style={{ border: '1px solid var(--ink-800)', background: 'var(--ink-850)', padding: '0.5rem 0.75rem', lineHeight: 1.5 }}>
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

      <div className="mt-1 flex gap-2" style={{ justifyContent: 'flex-end' }}>
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
