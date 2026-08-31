'use client';

import { useState } from 'react';
import type { Exercise } from '@/types/exercise';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  progressionShortLabel,
  progressionTone,
} from '@/components/shared';
import { ExercisePicker } from '@/components/admin/ExercisePicker';

/**
 * The builder's working copy of a block. Numbers are held as strings so a coach
 * can clear a field and retype it without the input fighting back; they are
 * parsed once, on save.
 */
export interface DraftExercise {
  /** Stable React key. Client-side only — the server renumbers `order` on save. */
  key: string;
  exercise: Exercise;
  targetSets: string;
  targetReps: string;
  restSeconds: string;
  notes: string;
}

export interface DraftDay {
  dayNumber: number;
  label: string;
  exercises: DraftExercise[];
}

export function newDraftExercise(exercise: Exercise): DraftExercise {
  return {
    key: `${exercise.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    exercise,
    targetSets: '3',
    targetReps: exercise.progressionType === 'heavy_compound' ? '5' : '8-10',
    restSeconds: exercise.progressionType === 'heavy_compound' ? '180' : '90',
    notes: '',
  };
}

export function ProgramDayEditor({
  day,
  library,
  libraryLoading,
  libraryError,
  onChange,
  onRemoveDay,
}: {
  day: DraftDay;
  library: Exercise[];
  libraryLoading: boolean;
  libraryError: string | null;
  onChange: (next: DraftDay) => void;
  /** Null when this is the only day left — a block must keep at least one. */
  onRemoveDay: (() => void) | null;
}) {
  const [picking, setPicking] = useState(false);

  function patchExercise(index: number, patch: Partial<DraftExercise>) {
    const exercises = day.exercises.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
    onChange({ ...day, exercises });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= day.exercises.length) return;
    const exercises = [...day.exercises];
    [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
    onChange({ ...day, exercises });
  }

  function remove(index: number) {
    onChange({ ...day, exercises: day.exercises.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Input
            label={`Day ${day.dayNumber} label`}
            placeholder="Lower Power, Upper Push…"
            value={day.label}
            onChange={(event) => onChange({ ...day, label: event.target.value })}
            maxLength={60}
          />
        </div>
        {onRemoveDay && (
          <Button variant="secondary" onClick={onRemoveDay}>
            Remove day {day.dayNumber}
          </Button>
        )}
      </div>

      {day.exercises.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-ink-400">
          Nothing on this day yet. A day can stay empty while you build the block out — it just
          shows as a rest day to the squad.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {day.exercises.map((entry, index) => (
            <li key={entry.key}>
              <Card>
                <CardBody className="flex flex-col gap-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-md bg-ink-800 text-xs font-semibold text-ink-300 tabular">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-50">{entry.exercise.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={progressionTone(entry.exercise.progressionType)}>
                          {progressionShortLabel(entry.exercise.progressionType)}
                        </Badge>
                        {entry.exercise.movementPattern && (
                          <span className="text-xs text-ink-400">{entry.exercise.movementPattern}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="secondary"
                        className="w-11"
                        aria-label={`Move ${entry.exercise.name} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-11"
                        aria-label={`Move ${entry.exercise.name} down`}
                        disabled={index === day.exercises.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-11"
                        aria-label={`Remove ${entry.exercise.name}`}
                        onClick={() => remove(index)}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Input
                      label="Sets"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      value={entry.targetSets}
                      onChange={(event) => patchExercise(index, { targetSets: event.target.value })}
                    />
                    <Input
                      label="Target"
                      placeholder="8-10"
                      value={entry.targetReps}
                      onChange={(event) => patchExercise(index, { targetReps: event.target.value })}
                      maxLength={40}
                    />
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
                    <div className="col-span-2 sm:col-span-1">
                      <Input
                        label="Notes"
                        placeholder="Optional cue"
                        value={entry.notes}
                        onChange={(event) => patchExercise(index, { notes: event.target.value })}
                        maxLength={500}
                      />
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
