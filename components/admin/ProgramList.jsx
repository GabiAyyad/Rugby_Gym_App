'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { addDays, formatShortDate } from '@/lib/domain/week';
import { Badge, Button, Card, CardBody, ConfirmDialog, EmptyState, ErrorNote, Input, Modal, PageHeader } from '@/components/shared';

/** Live > upcoming > shelved > finished: what a coach needs to see first, first. */
const BUCKET_TITLES = { live: 'Live now', upcoming: 'Upcoming', shelved: 'Not in rotation', finished: 'Finished' };

const BUCKET_NOTES = {
  live: 'What the squad is being served today.',
  upcoming: 'Takes over automatically on its start date.',
  shelved: 'Inside its dates but not being served — either shelved by hand, or another block covers the same squad.',
  finished: 'Past blocks. Duplicate one to start next month from it.',
};

// Display order for the bucketed sections below (live blocks always shown first).
const ORDER = ['live', 'upcoming', 'shelved', 'finished'];

/**
 * Sorts a program into one of four buckets for display grouping. `isActive`
 * (computed server-side by resolveActiveProgram) takes priority; otherwise the
 * bucket is worked out purely from where `today` falls relative to the block's
 * date range.
 */
function bucketOf(program, today) {
  if (program.isActive) return 'live';
  if (program.startDate > today) return 'upcoming';
  if (program.endDate < today) return 'finished';
  return 'shelved'; // inside its dates, but something else is live instead (or it's manually shelved)
}

/**
 * The admin "Programs" screen: every training block for this team, grouped
 * into Live/Upcoming/Shelved/Finished sections, with duplicate/delete actions.
 *
 * Duplicate is deliberately a first-class action on every row: next month's
 * programming almost always starts as this month's, and retyping four days of
 * exercises is how a coach stops using an app.
 *
 * @param {object} props
 * @param {object[]} props.programs Every block for this team (all position groups).
 * @param {string} props.today Today's date ('YYYY-MM-DD'), resolved server-side
 *   so bucketing agrees with the `isActive` flags the server already computed.
 */
export function ProgramList({ programs, today }) {
  const router = useRouter();
  const [filter, setFilter] = useState('all'); // squad filter: 'all' | 'forward' | 'back'
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // State for the "Duplicate block" modal.
  const [duplicating, setDuplicating] = useState(null); // the program being duplicated, or null
  const [copyName, setCopyName] = useState('');
  const [copyStart, setCopyStart] = useState('');
  const [deleting, setDeleting] = useState(null); // program pending delete confirmation

  const visible = useMemo(() => programs.filter((program) => filter === 'all' || program.positionGroup === filter), [programs, filter]);

  // Groups the filtered programs into the four display buckets, e.g.
  // Map { 'live' => [...], 'upcoming' => [...] }.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const program of visible) {
      const bucket = bucketOf(program, today);
      map.set(bucket, [...(map.get(bucket) ?? []), program]);
    }
    return map;
  }, [visible, today]);

  /** Opens the duplicate modal, pre-filling sensible defaults (see duplicateProgram action). */
  function openDuplicate(program) {
    setError(null);
    setDuplicating(program);
    setCopyName(`${program.name} (copy)`);
    setCopyStart(addDays(program.endDate, 1));
  }

  /** Submits the duplicate modal, then navigates to the new copy's edit page. */
  async function confirmDuplicate() {
    if (!duplicating) return;
    setBusy(true);
    setError(null);
    try {
      const copy = await api.post(`/api/admin/programs/${duplicating.id}/duplicate`, {
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

  /** Runs after the delete confirmation dialog is accepted. */
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
          <Link href="/admin/programs/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            + New block
          </Link>
        }
      />

      <div className="flex flex-col gap-5">
        <ErrorNote message={error} />

        <div role="group" aria-label="Filter by squad" className="flex gap-2">
          {[
            ['all', 'All'],
            ['forward', 'Forwards'],
            ['back', 'Backs'],
          ].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={filter === value ? 'tab-pill active flex-1 sm-flex-none' : 'tab-pill flex-1 sm-flex-none'}>
              {label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={programs.length === 0 ? 'No training blocks yet' : 'Nothing for that squad'}
            description={programs.length === 0 ? 'Build a four-week block for the forwards or the backs, and it goes live on its start date.' : 'Switch the filter, or build a block for this squad.'}
            action={
              <Link href="/admin/programs/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                + New block
              </Link>
            }
          />
        ) : (
          ORDER.filter((bucket) => (grouped.get(bucket) ?? []).length > 0).map((bucket) => (
            <section key={bucket}>
              <h2 className="text-xs font-semibold tracking-wide text-ink-300 uppercase">{BUCKET_TITLES[bucket]}</h2>
              <p className="mt-1 mb-4 text-sm text-ink-400">{BUCKET_NOTES[bucket]}</p>
              <ul className="flex flex-col gap-3" style={{ listStyle: 'none', padding: 0 }}>
                {(grouped.get(bucket) ?? []).map((program) => (
                  <li key={program.id}>
                    <Card className={program.isActive ? 'live-ring' : undefined}>
                      <CardBody className="flex flex-col gap-3">
                        <div className="flex flex-wrap justify-between gap-2" style={{ alignItems: 'flex-start' }}>
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-ink-50">{program.name}</p>
                            <p className="mt-1 text-sm text-ink-400">
                              {formatShortDate(program.startDate)} → {formatShortDate(program.endDate)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1-5">
                            <Badge tone={program.positionGroup === 'forward' ? 'info' : 'warn'}>{program.positionGroup === 'forward' ? 'Forwards' : 'Backs'}</Badge>
                            {program.isActive && <Badge tone="good">Active</Badge>}
                            {program.isActiveOverride === true && <Badge tone="good">Forced</Badge>}
                            {program.isActiveOverride === false && <Badge tone="bad">Shelved</Badge>}
                          </div>
                        </div>

                        <p className="text-sm text-ink-300 tabular">
                          {program.dayCount} {program.dayCount === 1 ? 'day' : 'days'} · {program.exerciseCount} {program.exerciseCount === 1 ? 'exercise' : 'exercises'}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <Link href={`/admin/programs/${program.id}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
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
            Copies every day, exercise, set, rep target, rest and note from <span className="font-semibold text-ink-50">{duplicating?.name}</span> onto new dates. The copy keeps the same length
            and starts out following its dates.
          </p>
          <Input label="Name" value={copyName} onChange={(event) => setCopyName(event.target.value)} maxLength={80} />
          <Input label="Starts" type="date" value={copyStart} onChange={(event) => setCopyStart(event.target.value)} hint="Defaults to the day after the original block ends." />
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
