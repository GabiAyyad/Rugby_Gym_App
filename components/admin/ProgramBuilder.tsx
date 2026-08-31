'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { defaultBlockEnd, formatShortDate } from '@/lib/domain/week';
import type { ISODate } from '@/types/common';
import type { PositionGroup } from '@/types/database';
import type { Exercise, ListExercisesResult } from '@/types/exercise';
import type {
  CreateProgramInput,
  Program,
  ProgramDayInput,
  ProgramExerciseInput,
} from '@/types/program';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  ErrorNote,
  Input,
  PageHeader,
  Select,
} from '@/components/shared';
import { ProgramDayEditor, type DraftDay } from '@/components/admin/ProgramDayEditor';

type Override = 'auto' | 'active' | 'inactive';

const OVERRIDE_HINTS: Record<Override, string> = {
  auto: 'Auto — this block is live between its start and end dates, and hands over on its own.',
  active: 'Force active — served to the squad now, whatever the dates say.',
  inactive: 'Out of rotation — never served, even inside its dates. Useful for a draft.',
};

function toOverride(value: boolean | null): Override {
  if (value === true) return 'active';
  if (value === false) return 'inactive';
  return 'auto';
}

function fromOverride(value: Override): boolean | null {
  if (value === 'active') return true;
  if (value === 'inactive') return false;
  return null;
}

function toDrafts(program: Program | null): DraftDay[] {
  if (!program) {
    // A fresh block starts as the standard 4-session mesocycle; days can be dropped later.
    return [1, 2, 3, 4].map((dayNumber) => ({ dayNumber, label: '', exercises: [] }));
  }
  if (program.days.length === 0) return [{ dayNumber: 1, label: '', exercises: [] }];
  return program.days.map((day) => ({
    dayNumber: day.dayNumber,
    label: day.label ?? '',
    exercises: day.exercises.map((entry) => ({
      key: entry.id,
      exercise: entry.exercise,
      targetSets: String(entry.targetSets),
      targetReps: entry.targetReps,
      restSeconds: String(entry.restSeconds),
      notes: entry.notes ?? '',
    })),
  }));
}

/**
 * The whole block on one screen: details at the top, then a tab per training
 * day. Saving sends the block as a single payload, so a coach can shuffle four
 * days around and commit once.
 */
export function ProgramBuilder({ program, today }: { program: Program | null; today: ISODate }) {
  const router = useRouter();
  const creating = program === null;

  const [name, setName] = useState(program?.name ?? '');
  const [positionGroup, setPositionGroup] = useState<PositionGroup>(
    program?.positionGroup ?? 'forward',
  );
  const [startDate, setStartDate] = useState<ISODate>(program?.startDate ?? today);
  const [endDate, setEndDate] = useState<ISODate>(
    program?.endDate ?? defaultBlockEnd(program?.startDate ?? today),
  );
  const [endEdited, setEndEdited] = useState(program !== null);
  const [override, setOverride] = useState<Override>(toOverride(program?.isActiveOverride ?? null));

  const [days, setDays] = useState<DraftDay[]>(() => toDrafts(program));
  const [activeDay, setActiveDay] = useState<number>(() => toDrafts(program)[0]?.dayNumber ?? 1);

  const [library, setLibrary] = useState<Exercise[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveDay, setConfirmRemoveDay] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ListExercisesResult>('/api/admin/exercises')
      .then((result) => {
        if (!cancelled) setLibrary(result.exercises);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLibraryError(
          caught instanceof ApiError
            ? caught.message
            : 'Could not load the exercise library. Check your connection and reopen this picker.',
        );
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(id);
  }, [saved]);

  const totalExercises = useMemo(
    () => days.reduce((sum, day) => sum + day.exercises.length, 0),
    [days],
  );
  const current = days.find((day) => day.dayNumber === activeDay) ?? days[0];

  function changeStartDate(next: ISODate) {
    setStartDate(next);
    // The end date follows a 4-week mesocycle until the coach sets it themselves.
    if (!endEdited && next) setEndDate(defaultBlockEnd(next));
  }

  function buildPayload(): CreateProgramInput | null {
    const problems: Record<string, string> = {};
    if (!name.trim()) problems.name = 'Give the block a name.';
    if (!startDate) problems.startDate = 'Pick a start date.';
    if (!endDate) problems.endDate = 'Pick an end date.';
    if (startDate && endDate && endDate < startDate) {
      problems.endDate = 'The end date cannot be before the start date.';
    }

    const payloadDays: ProgramDayInput[] = [];
    for (const day of days) {
      const exercises: ProgramExerciseInput[] = [];
      for (const [index, entry] of day.exercises.entries()) {
        const sets = Number.parseInt(entry.targetSets, 10);
        const rest = Number.parseInt(entry.restSeconds, 10);
        if (!Number.isFinite(sets) || sets < 1) {
          problems.days = `Day ${day.dayNumber}, ${entry.exercise.name}: sets must be at least 1.`;
        }
        if (!Number.isFinite(rest) || rest < 0) {
          problems.days = `Day ${day.dayNumber}, ${entry.exercise.name}: rest must be 0 or more.`;
        }
        if (!entry.targetReps.trim()) {
          problems.days = `Day ${day.dayNumber}, ${entry.exercise.name}: set a target ("8-10", "5", "40m").`;
        }
        exercises.push({
          exerciseId: entry.exercise.id,
          order: index + 1,
          targetSets: Number.isFinite(sets) ? sets : 1,
          targetReps: entry.targetReps.trim(),
          restSeconds: Number.isFinite(rest) ? rest : 0,
          notes: entry.notes.trim() ? entry.notes.trim() : null,
        });
      }
      payloadDays.push({
        dayNumber: day.dayNumber,
        label: day.label.trim() ? day.label.trim() : null,
        exercises,
      });
    }

    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      setError(problems.days ?? 'Check the highlighted fields.');
      return null;
    }

    setFieldErrors({});
    return {
      positionGroup,
      name: name.trim(),
      startDate,
      endDate,
      isActiveOverride: fromOverride(override),
      days: payloadDays,
    };
  }

  function reseed(next: Program) {
    setName(next.name);
    setPositionGroup(next.positionGroup);
    setStartDate(next.startDate);
    setEndDate(next.endDate);
    setEndEdited(true);
    setOverride(toOverride(next.isActiveOverride));
    const drafts = toDrafts(next);
    setDays(drafts);
    if (!drafts.some((day) => day.dayNumber === activeDay)) {
      setActiveDay(drafts[0]?.dayNumber ?? 1);
    }
  }

  async function save() {
    const payload = buildPayload();
    if (!payload) return;

    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      if (program === null) {
        const created = await api.post<Program>('/api/admin/programs', payload);
        router.push(`/admin/programs/${created.id}`);
        router.refresh();
        return;
      }
      const updated = await api.patch<Program>(`/api/admin/programs/${program.id}`, payload);
      reseed(updated);
      setSaved(true);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError('Could not reach the server. Your changes are still on screen — try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    if (!program) return;
    setBusy(true);
    setError(null);
    try {
      const copy = await api.post<Program>(`/api/admin/programs/${program.id}/duplicate`, {});
      router.push(`/admin/programs/${copy.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not duplicate this block.');
      setBusy(false);
    }
  }

  async function remove() {
    if (!program) return;
    try {
      await api.delete(`/api/admin/programs/${program.id}`);
      router.push('/admin/programs');
      router.refresh();
    } catch (caught) {
      setConfirmDelete(false);
      setError(caught instanceof ApiError ? caught.message : 'Could not delete this block.');
    }
  }

  function addDay() {
    const next = [1, 2, 3, 4].find((n) => !days.some((day) => day.dayNumber === n));
    if (!next) return;
    setDays(
      [...days, { dayNumber: next, label: '', exercises: [] }].sort(
        (a, b) => a.dayNumber - b.dayNumber,
      ),
    );
    setActiveDay(next);
  }

  function removeDay(dayNumber: number) {
    const remaining = days.filter((day) => day.dayNumber !== dayNumber);
    setDays(remaining);
    if (activeDay === dayNumber) setActiveDay(remaining[0]?.dayNumber ?? 1);
    setConfirmRemoveDay(null);
  }

  return (
    <div>
      <PageHeader
        title={program ? program.name : 'New training block'}
        subtitle={
          program === null ? (
            'Name it, pick the squad it is for, and set the dates. You build the days next.'
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={program.positionGroup === 'forward' ? 'info' : 'warn'}>
                {program.positionGroup === 'forward' ? 'Forwards' : 'Backs'}
              </Badge>
              {program.isActive && <Badge tone="good">Active now</Badge>}
              <span>
                {formatShortDate(program.startDate)} → {formatShortDate(program.endDate)}
              </span>
              <span className="text-ink-600">·</span>
              <span>
                {days.length} {days.length === 1 ? 'day' : 'days'}, {totalExercises}{' '}
                {totalExercises === 1 ? 'exercise' : 'exercises'}
              </span>
            </span>
          )
        }
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push('/admin/programs')}>
              Back
            </Button>
            <Button onClick={save} loading={busy}>
              {creating ? 'Create block' : 'Save block'}
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-5">
        <ErrorNote message={error} />
        {saved && !error && (
          <p role="status" className="rounded-xl border border-pitch-500/40 bg-pitch-500/10 px-3 py-2 text-sm text-pitch-400">
            Saved.
          </p>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold tracking-wide text-ink-300 uppercase">Block details</h2>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Block name"
              placeholder="September — Strength"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={fieldErrors.name}
              maxLength={80}
            />
            <Select
              label="Squad"
              value={positionGroup}
              onChange={(event) => setPositionGroup(event.target.value as PositionGroup)}
              hint="Forwards and backs get separate blocks."
            >
              <option value="forward">Forwards</option>
              <option value="back">Backs</option>
            </Select>
            <Input
              label="Start date"
              type="date"
              value={startDate}
              onChange={(event) => changeStartDate(event.target.value)}
              error={fieldErrors.startDate}
            />
            <Input
              label="End date"
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndEdited(true);
                setEndDate(event.target.value);
              }}
              error={fieldErrors.endDate}
              hint={endEdited ? undefined : 'Defaults to a 4-week block. Editable.'}
            />
            <div className="sm:col-span-2">
              <Select
                label="Availability"
                value={override}
                onChange={(event) => setOverride(event.target.value as Override)}
                hint={OVERRIDE_HINTS[override]}
              >
                <option value="auto">Auto (follow the dates)</option>
                <option value="active">Force active</option>
                <option value="inactive">Take out of rotation</option>
              </Select>
            </div>
          </CardBody>
        </Card>

        {!creating && (
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-ink-300 uppercase">
                Training days
              </h2>
              {days.length < 4 && (
                <Button variant="secondary" onClick={addDay}>
                  + Add day
                </Button>
              )}
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <div role="tablist" aria-label="Training days" className="flex flex-wrap gap-2">
                {days.map((day) => {
                  const selected = day.dayNumber === current?.dayNumber;
                  return (
                    <button
                      key={day.dayNumber}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveDay(day.dayNumber)}
                      className={
                        selected
                          ? 'h-11 rounded-xl border border-pitch-500 bg-pitch-500/15 px-4 text-sm font-semibold text-pitch-400'
                          : 'h-11 rounded-xl border border-ink-700 bg-ink-900 px-4 text-sm text-ink-300 hover:border-ink-600 hover:text-ink-50'
                      }
                    >
                      Day {day.dayNumber}
                      {day.label.trim() && (
                        <span className="ml-1.5 font-normal opacity-80">· {day.label.trim()}</span>
                      )}
                      <span className="ml-1.5 text-xs opacity-60 tabular">
                        ({day.exercises.length})
                      </span>
                    </button>
                  );
                })}
              </div>

              {current && (
                <ProgramDayEditor
                  key={current.dayNumber}
                  day={current}
                  library={library}
                  libraryLoading={libraryLoading}
                  libraryError={libraryError}
                  onChange={(next) =>
                    setDays(days.map((day) => (day.dayNumber === next.dayNumber ? next : day)))
                  }
                  onRemoveDay={
                    days.length > 1 ? () => setConfirmRemoveDay(current.dayNumber) : null
                  }
                />
              )}
            </CardBody>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={save} loading={busy} size="lg">
            {creating ? 'Create block' : 'Save block'}
          </Button>
          {!creating && (
            <>
              <Button variant="secondary" size="lg" onClick={duplicate} disabled={busy}>
                Duplicate
              </Button>
              <Button
                variant="danger"
                size="lg"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Delete block
              </Button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${program?.name ?? 'this block'}"?`}
        message="This removes the block, all of its days and exercises, and every session and set the squad has logged against those days. Training history for this block cannot be recovered."
        confirmLabel="Delete block"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmRemoveDay !== null}
        title={`Remove day ${confirmRemoveDay ?? ''}?`}
        message="The day and its exercises go when you save, along with any sessions the squad has already logged against it."
        confirmLabel="Remove day"
        onConfirm={() => {
          if (confirmRemoveDay !== null) removeDay(confirmRemoveDay);
        }}
        onCancel={() => setConfirmRemoveDay(null)}
      />
    </div>
  );
}
