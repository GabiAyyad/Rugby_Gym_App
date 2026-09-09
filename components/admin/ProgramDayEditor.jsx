'use client';

import { useState } from 'react';
import { Badge, Button, Card, CardBody, Input, progressionShortLabel, progressionTone } from '@/components/shared';
import { ExercisePicker } from '@/components/admin/ExercisePicker';

/**
 * Builds a fresh "draft" row for one exercise just added to a day. Numbers are
 * held as strings (not numbers) so a coach can clear a field and retype it
 * without the input fighting back; they are parsed once, on save (see
 * ProgramBuilder.buildPayload). Sets sensible starting defaults based on the
 * exercise's progression type (heavy compounds default to low reps/long rest,
 * everything else to a moderate rep range and shorter rest).
 */
export function newDraftExercise(exercise) {
  return {
    key: `${exercise.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    exercise,
    targetSets: '3',
    targetReps: exercise.progressionType === 'heavy_compound' ? '5' : '8-10',
    restSeconds: exercise.progressionType === 'heavy_compound' ? '180' : '90',
    notes: '',
  };
}

/**
 * Editor for one training day inside the program builder: the day's label,
 * its ordered list of exercises (each with sets/reps/rest/notes), and the
 * "+ Add exercise" button that opens the ExercisePicker modal.
 *
 * This component holds no state of its own beyond "is the picker open" — the
 * day's data lives in the parent (ProgramBuilder) and every change is pushed
 * up via `onChange`, so the parent's single `days` array stays the source of truth.
 *
 * @param {object} props
 * @param {object} props.day The day being edited: {dayNumber, label, exercises}.
 * @param {object[]} props.library The full exercise library, passed through to ExercisePicker.
 * @param {boolean} props.libraryLoading Passed through to ExercisePicker.
 * @param {string|null} props.libraryError Passed through to ExercisePicker.
 * @param {(next: object) => void} props.onChange Called with the updated day object on any edit.
 * @param {(() => void)|null} props.onRemoveDay Called if the coach removes this day; null
 *   when this is the last remaining day (a block must keep at least one).
 */
export function ProgramDayEditor({ day, library, libraryLoading, libraryError, onChange, onRemoveDay }) {
  const [picking, setPicking] = useState(false); // is the exercise picker modal open?

  /** Merges `patch` into the exercise at `index` and reports the updated day upward. */
  function patchExercise(index, patch) {
    const exercises = day.exercises.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
    onChange({ ...day, exercises });
  }

  /** Swaps the exercise at `index` with the one `delta` positions away (±1 for up/down). */
  function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= day.exercises.length) return;
    const exercises = [...day.exercises];
    [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
    onChange({ ...day, exercises });
  }

  /** Removes the exercise at `index` from this day. */
  function remove(index) {
    onChange({ ...day, exercises: day.exercises.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3" style={{ alignItems: 'flex-end' }}>
        <div className="min-w-56 flex-1">
          <Input label={`Day ${day.dayNumber} label`} placeholder="Lower Power, Upper Push…" value={day.label} onChange={(event) => onChange({ ...day, label: event.target.value })} maxLength={60} />
        </div>
        {onRemoveDay && (
          <Button variant="secondary" onClick={onRemoveDay}>
            Remove day {day.dayNumber}
          </Button>
        )}
      </div>

      {day.exercises.length === 0 ? (
        <p className="rounded-card text-sm text-ink-400 text-center" style={{ border: '1px dashed var(--ink-700)', padding: '2rem 1rem' }}>
          Nothing on this day yet. A day can stay empty while you build the block out — it just shows as a rest day to the squad.
        </p>
      ) : (
        <ol className="flex flex-col gap-3" style={{ listStyle: 'none', padding: 0 }}>
          {day.exercises.map((entry, index) => (
            <li key={entry.key}>
              <Card>
                <CardBody className="flex flex-col gap-3">
                  <div className="flex gap-2" style={{ alignItems: 'flex-start' }}>
                    <span
                      className="mt-1 shrink-0 tabular text-xs font-semibold text-ink-300"
                      style={{ display: 'grid', placeItems: 'center', width: '1.5rem', height: '1.5rem', borderRadius: '0.375rem', background: 'var(--ink-800)' }}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-50">{entry.exercise.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1-5">
                        <Badge tone={progressionTone(entry.exercise.progressionType)}>{progressionShortLabel(entry.exercise.progressionType)}</Badge>
                        {entry.exercise.movementPattern && <span className="text-xs text-ink-400">{entry.exercise.movementPattern}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="secondary" className="w-11" aria-label={`Move ${entry.exercise.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                        ↑
                      </Button>
                      <Button variant="secondary" className="w-11" aria-label={`Move ${entry.exercise.name} down`} disabled={index === day.exercises.length - 1} onClick={() => move(index, 1)}>
                        ↓
                      </Button>
                      <Button variant="secondary" className="w-11" aria-label={`Remove ${entry.exercise.name}`} onClick={() => remove(index)}>
                        ✕
                      </Button>
                    </div>
                  </div>

                  <div className="field-grid">
                    <Input label="Sets" type="number" inputMode="numeric" min={1} max={20} value={entry.targetSets} onChange={(event) => patchExercise(index, { targetSets: event.target.value })} />
                    <Input label="Target" placeholder="8-10" value={entry.targetReps} onChange={(event) => patchExercise(index, { targetReps: event.target.value })} maxLength={40} />
                    <Input
                      label="Rest (s)"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={3600}
                      step={15}
                      value={entry.restSeconds}
                      onChange={(event) => patchExercise(index, { restSeconds: event.target.value })}
                    />
                    <div className="notes-span">
                      <Input label="Notes" placeholder="Optional cue" value={entry.notes} onChange={(event) => patchExercise(index, { notes: event.target.value })} maxLength={500} />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <Button variant="secondary" fullWidth onClick={() => setPicking(true)}>
        + Add exercise to day {day.dayNumber}
      </Button>

      <ExercisePicker
        open={picking}
        exercises={library}
        loading={libraryLoading}
        error={libraryError}
        onClose={() => setPicking(false)}
        onSelect={(exercise) => {
          onChange({ ...day, exercises: [...day.exercises, newDraftExercise(exercise)] });
          setPicking(false);
        }}
      />
    </div>
  );
}
