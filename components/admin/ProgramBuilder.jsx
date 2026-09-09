'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { defaultBlockEnd, formatShortDate } from '@/lib/domain/week';
import { Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, ErrorNote, Input, PageHeader, Select } from '@/components/shared';
import { ProgramDayEditor } from '@/components/admin/ProgramDayEditor';

const OVERRIDE_HINTS = {
  auto: 'Auto — this block is live between its start and end dates, and hands over on its own.',
  active: 'Force active — served to the squad now, whatever the dates say.',
  inactive: 'Out of rotation — never served, even inside its dates. Useful for a draft.',
};

/** Converts the raw `isActiveOverride` (true/false/null) into the Select's string value. */
function toOverride(value) {
  if (value === true) return 'active';
  if (value === false) return 'inactive';
  return 'auto';
}

/** The reverse of toOverride — turns the Select's value back into true/false/null for the API. */
function fromOverride(value) {
  if (value === 'active') return true;
  if (value === 'inactive') return false;
  return null;
}

/** Converts a server Program (or null, for "creating") into the builder's editable draft-days shape. */
function toDrafts(program) {
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
 * The admin "create/edit training block" screen: details (name, squad, dates,
 * availability) at the top, then a tab per training day underneath. Used both
 * for /admin/programs/new (`program={null}`) and /admin/programs/[id] (editing
 * an existing block) — `creating` below just tracks which mode this is.
 *
 * Saving sends the whole block (details + all days + all exercises) as one
 * payload to a single PATCH/POST, so a coach can shuffle four days around and
 * commit everything at once rather than saving each day separately.
 *
 * @param {object} props
 * @param {object|null} props.program The block being edited, or null to create a new one.
 * @param {string} props.today Today's date ('YYYY-MM-DD'), used to default a new block's start date.
 */
export function ProgramBuilder({ program, today }) {
  const router = useRouter();
  const creating = program === null;

  const [name, setName] = useState(program?.name ?? '');
  const [positionGroup, setPositionGroup] = useState(program?.positionGroup ?? 'forward');
  const [startDate, setStartDate] = useState(program?.startDate ?? today);
  const [endDate, setEndDate] = useState(program?.endDate ?? defaultBlockEnd(program?.startDate ?? today));
  const [endEdited, setEndEdited] = useState(program !== null);
  const [override, setOverride] = useState(toOverride(program?.isActiveOverride ?? null));

  const [days, setDays] = useState(() => toDrafts(program));
  const [activeDay, setActiveDay] = useState(() => toDrafts(program)[0]?.dayNumber ?? 1);

  const [library, setLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveDay, setConfirmRemoveDay] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/admin/exercises')
      .then((result) => {
        if (!cancelled) setLibrary(result.exercises);
      })
      .catch((caught) => {
        if (cancelled) return;
        setLibraryError(caught instanceof ApiError ? caught.message : 'Could not load the exercise library. Check your connection and reopen this picker.');
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

  const totalExercises = useMemo(() => days.reduce((sum, day) => sum + day.exercises.length, 0), [days]);
  const current = days.find((day) => day.dayNumber === activeDay) ?? days[0];

  /** Updates the start date and, unless the coach has manually edited the end
   *  date, keeps the end date following the standard 4-week block length. */
  function changeStartDate(next) {
    setStartDate(next);
    // The end date follows a 4-week mesocycle until the coach sets it themselves.
    if (!endEdited && next) setEndDate(defaultBlockEnd(next));
  }

  /**
   * Validates the whole form (block details + every day's exercises) and
   * converts the draft (string-typed) state into the numeric payload the API
   * expects. Returns null and sets field/summary errors if anything is invalid.
   */
  function buildPayload() {
    const problems = {};
    if (!name.trim()) problems.name = 'Give the block a name.';
    if (!startDate) problems.startDate = 'Pick a start date.';
    if (!endDate) problems.endDate = 'Pick an end date.';
    if (startDate && endDate && endDate < startDate) {
      problems.endDate = 'The end date cannot be before the start date.';
    }

    const payloadDays = [];
    for (const day of days) {
      const exercises = [];
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

  /** After a successful save, replaces all the form's state with the server's
   *  response — picking up server-assigned exercise ids and any normalisation
   *  (trimmed strings, renumbered order) the server applied. */
  function reseed(next) {
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

  /** Validates and submits the form: POST to create, PATCH to update. */
  async function save() {
    const payload = buildPayload();
    if (!payload) return;

    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      if (program === null) {
        const created = await api.post('/api/admin/programs', payload);
        router.push(`/admin/programs/${created.id}`);
        router.refresh();
        return;
      }
      const updated = await api.patch(`/api/admin/programs/${program.id}`, payload);
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

  /** "Duplicate" button on an existing block: clones it server-side, then jumps to editing the copy. */
  async function duplicate() {
    if (!program) return;
    setBusy(true);
    setError(null);
    try {
      const copy = await api.post(`/api/admin/programs/${program.id}/duplicate`, {});
      router.push(`/admin/programs/${copy.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not duplicate this block.');
      setBusy(false);
    }
  }

  /** "Delete block" confirmed: deletes it server-side and returns to the programs list. */
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

  /** Adds the next unused day number (1-4) as a new blank day and switches the active tab to it. */
  function addDay() {
    const next = [1, 2, 3, 4].find((n) => !days.some((day) => day.dayNumber === n));
    if (!next) return; // already have all 4 days
    setDays([...days, { dayNumber: next, label: '', exercises: [] }].sort((a, b) => a.dayNumber - b.dayNumber));
    setActiveDay(next);
  }

  /** Removes a day from the draft (called after the "remove day" confirm dialog). */
  function removeDay(dayNumber) {
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
              <Badge tone={program.positionGroup === 'forward' ? 'info' : 'warn'}>{program.positionGroup === 'forward' ? 'Forwards' : 'Backs'}</Badge>
              {program.isActive && <Badge tone="good">Active now</Badge>}
              <span>
                {formatShortDate(program.startDate)} → {formatShortDate(program.endDate)}
              </span>
              <span className="text-ink-600">·</span>
              <span>
                {days.length} {days.length === 1 ? 'day' : 'days'}, {totalExercises} {totalExercises === 1 ? 'exercise' : 'exercises'}
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
          <p role="status" className="status-note">
            Saved.
          </p>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold tracking-wide text-ink-300 uppercase">Block details</h2>
          </CardHeader>
          <CardBody className="field-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <Input label="Block name" placeholder="September — Strength" value={name} onChange={(event) => setName(event.target.value)} error={fieldErrors.name} maxLength={80} />
            <Select label="Squad" value={positionGroup} onChange={(event) => setPositionGroup(event.target.value)} hint="Forwards and backs get separate blocks.">
              <option value="forward">Forwards</option>
              <option value="back">Backs</option>
            </Select>
            <Input label="Start date" type="date" value={startDate} onChange={(event) => changeStartDate(event.target.value)} error={fieldErrors.startDate} />
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
            <div className="notes-span" style={{ gridColumn: '1 / -1' }}>
              <Select label="Availability" value={override} onChange={(event) => setOverride(event.target.value)} hint={OVERRIDE_HINTS[override]}>
                <option value="auto">Auto (follow the dates)</option>
                <option value="active">Force active</option>
                <option value="inactive">Take out of rotation</option>
              </Select>
            </div>
          </CardBody>
        </Card>

        {!creating && (
          <Card>
            <CardHeader className="flex flex-wrap justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-ink-300 uppercase">Training days</h2>
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
                    <button key={day.dayNumber} type="button" role="tab" aria-selected={selected} onClick={() => setActiveDay(day.dayNumber)} className={selected ? 'tab-pill active' : 'tab-pill'}>
                      Day {day.dayNumber}
                      {day.label.trim() && <span className="ml-2" style={{ fontWeight: 400, opacity: 0.8 }}>· {day.label.trim()}</span>}
                      <span className="ml-2 text-xs tabular" style={{ opacity: 0.6 }}>
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
                  onChange={(next) => setDays(days.map((day) => (day.dayNumber === next.dayNumber ? next : day)))}
                  onRemoveDay={days.length > 1 ? () => setConfirmRemoveDay(current.dayNumber) : null}
                />
              )}
            </CardBody>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Button onClick={save} loading={busy} size="lg">
            {creating ? 'Create block' : 'Save block'}
          </Button>
          {!creating && (
            <>
              <Button variant="secondary" size="lg" onClick={duplicate} disabled={busy}>
                Duplicate
              </Button>
              <Button variant="danger" size="lg" onClick={() => setConfirmDelete(true)} disabled={busy}>
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
