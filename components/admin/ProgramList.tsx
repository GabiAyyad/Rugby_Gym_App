'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { addDays, formatShortDate } from '@/lib/domain/week';
import type { ISODate } from '@/types/common';
import type { PositionGroup } from '@/types/database';
import type { Program, ProgramSummary } from '@/types/program';
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Input,
  Modal,
  PageHeader,
} from '@/components/shared';

type Filter = 'all' | PositionGroup;

/** Live > upcoming > shelved > finished: what a coach needs to see first, first. */
type Bucket = 'live' | 'upcoming' | 'shelved' | 'finished';

const BUCKET_TITLES: Record<Bucket, string> = {
  live: 'Live now',
  upcoming: 'Upcoming',
  shelved: 'Not in rotation',
  finished: 'Finished',
};

const BUCKET_NOTES: Record<Bucket, string> = {
  live: 'What the squad is being served today.',
  upcoming: 'Takes over automatically on its start date.',
  shelved: 'Inside its dates but not being served — either shelved by hand, or another block covers the same squad.',
  finished: 'Past blocks. Duplicate one to start next month from it.',
};

const ORDER: Bucket[] = ['live', 'upcoming', 'shelved', 'finished'];

function bucketOf(program: ProgramSummary, today: ISODate): Bucket {
  if (program.isActive) return 'live';
  if (program.startDate > today) return 'upcoming';
  if (program.endDate < today) return 'finished';
  return 'shelved';
}

/**
 * The blocks a coach has built for their squad. Duplicate is deliberately a
 * first-class action on every row: next month's programming almost always
 * starts as this month's, and retyping four days of exercises is how a coach
 * stops using an app.
 */
export function ProgramList({
  programs,
  today,
}: {
  programs: ProgramSummary[];
  today: ISODate;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [duplicating, setDuplicating] = useState<ProgramSummary | null>(null);
  const [copyName, setCopyName] = useState('');
  const [copyStart, setCopyStart] = useState<ISODate>('');
  const [deleting, setDeleting] = useState<ProgramSummary | null>(null);

  const visible = useMemo(
    () => programs.filter((program) => filter === 'all' || program.positionGroup === filter),
    [programs, filter],
  );

  const grouped = useMemo(() => {
    const map = new Map<Bucket, ProgramSummary[]>();
    for (const program of visible) {
      const bucket = bucketOf(program, today);
      map.set(bucket, [...(map.get(bucket) ?? []), program]);
    }
    return map;
  }, [visible, today]);

  function openDuplicate(program: ProgramSummary) {
    setError(null);
    setDuplicating(program);
    setCopyName(`${program.name} (copy)`);
    setCopyStart(addDays(program.endDate, 1));
  }

  async function confirmDuplicate() {
    if (!duplicating) return;
    setBusy(true);
    setError(null);
    try {
      const copy = await api.post<Program>(`/api/admin/programs/${duplicating.id}/duplicate`, {
        name: copyName.trim() || null,
        startDate: copyStart || null,
      });
      setDuplicating(null);
      router.push(`/admin/programs/${copy.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not duplicate that block.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api.delete(`/api/admin/programs/${deleting.id}`);
      setDeleting(null);
      router.refresh();
    } catch (caught) {
      setDeleting(null);
      setError(caught instanceof ApiError ? caught.message : 'Could not delete that block.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Training blocks"
        subtitle="Four-week blocks, one per squad. The live block switches over on its own."
        action={
          <Link
            href="/admin/programs/new"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-pitch-500 px-4 text-[0.95rem] font-semibold text-ink-950 transition-colors hover:bg-pitch-400"
          >
            + New block
          </Link>
        }
      />

      <div className="flex flex-col gap-5">
        <ErrorNote message={error} />

        <div role="group" aria-label="Filter by squad" className="flex gap-2">
          {(
            [
              ['all', 'All'],
              ['forward', 'Forwards'],
              ['back', 'Backs'],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={
                filter === value
                  ? 'h-11 flex-1 rounded-xl border border-pitch-500 bg-pitch-500/15 px-4 text-sm font-semibold text-pitch-400 sm:flex-none'
                  : 'h-11 flex-1 rounded-xl border border-ink-700 bg-ink-900 px-4 text-sm text-ink-300 hover:border-ink-600 hover:text-ink-50 sm:flex-none'
              }
            >
              {label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={programs.length === 0 ? 'No training blocks yet' : 'Nothing for that squad'}
            description={
              programs.length === 0
                ? 'Build a four-week block for the forwards or the backs, and it goes live on its start date.'
                : 'Switch the filter, or build a block for this squad.'
            }
            action={
              <Link
                href="/admin/programs/new"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-pitch-500 px-4 text-[0.95rem] font-semibold text-ink-950 transition-colors hover:bg-pitch-400"
              >
                + New block
              </Link>
            }
          />
        ) : (
          ORDER.filter((bucket) => (grouped.get(bucket) ?? []).length > 0).map((bucket) => (
            <section key={bucket}>
              <h2 className="text-xs font-semibold tracking-wide text-ink-300 uppercase">
                {BUCKET_TITLES[bucket]}
              </h2>
              <p className="mt-0.5 mb-3 text-sm text-ink-400">{BUCKET_NOTES[bucket]}</p>
              <ul className="flex flex-col gap-3">
                {(grouped.get(bucket) ?? []).map((program) => (
                  <li key={program.id}>
                    <Card className={program.isActive ? 'ring-1 ring-pitch-500/40' : undefined}>
                      <CardBody className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-ink-50">
                              {program.name}
                            </p>
                            <p className="mt-0.5 text-sm text-ink-400">
                              {formatShortDate(program.startDate)} →{' '}
                              {formatShortDate(program.endDate)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={program.positionGroup === 'forward' ? 'info' : 'warn'}>
                              {program.positionGroup === 'forward' ? 'Forwards' : 'Backs'}
                            </Badge>
                            {program.isActive && <Badge tone="good">Active</Badge>}
                            {program.isActiveOverride === true && <Badge tone="good">Forced</Badge>}
                            {program.isActiveOverride === false && (
                              <Badge tone="bad">Shelved</Badge>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-ink-300 tabular">
                          {program.dayCount} {program.dayCount === 1 ? 'day' : 'days'} ·{' '}
                          {program.exerciseCount}{' '}
                          {program.exerciseCount === 1 ? 'exercise' : 'exercises'}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/programs/${program.id}`}
                            className="inline-flex h-11 items-center justify-center rounded-xl border border-ink-700 bg-ink-800 px-4 text-[0.95rem] text-ink-50 transition-colors hover:bg-ink-700"
                          >
                            Edit days
                          </Link>
                          <Button onClick={() => openDuplicate(program)}>Duplicate</Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setError(null);
                              setDeleting(program);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <Modal
        open={duplicating !== null}
        onClose={() => setDuplicating(null)}
        title="Duplicate block"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDuplicating(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirmDuplicate} loading={busy}>
              Create copy
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-300">
            Copies every day, exercise, set, rep target, rest and note from{' '}
            <span className="font-semibold text-ink-50">{duplicating?.name}</span> onto new dates.
            The copy keeps the same length and starts out following its dates.
          </p>
          <Input
            label="Name"
            value={copyName}
            onChange={(event) => setCopyName(event.target.value)}
            maxLength={80}
          />
          <Input
            label="Starts"
            type="date"
            value={copyStart}
            onChange={(event) => setCopyStart(event.target.value)}
            hint="Defaults to the day after the original block ends."
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete "${deleting?.name ?? ''}"?`}
        message="This removes the block, all of its days and exercises, and every session and set the squad has logged against those days. That training history cannot be recovered."
        confirmLabel="Delete block"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
