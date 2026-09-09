'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorNote, Modal, PageHeader } from '@/components/shared';
import { PlayerForm } from './PlayerForm';

/**
 * The admin "Players" screen: lists the whole roster with add/edit/delete.
 *
 * Everything it touches is already scoped to the caller's team server-side,
 * so there is no team selector here by design — players never move between
 * Palestine and Cyprus.
 *
 * @param {object} props
 * @param {object[]} props.initialPlayers Roster fetched server-side, used as
 *   the initial state so the page renders with data on first paint.
 * @param {string} props.teamName Shown in the subtitle.
 * @param {string} props.currentPlayerId The signed-in admin's own id — used to
 *   disable "Delete" on their own row (you cannot remove yourself) and to
 *   show a "you" label next to their name.
 */
export function PlayersManager({ initialPlayers, teamName, currentPlayerId }) {
  // `players` is this component's own copy of the roster (kept in sync with
  // the server after every add/edit/delete via refresh()), separate from any
  // server-rendered data the page itself might have.
  const [players, setPlayers] = useState(initialPlayers);
  const [creating, setCreating] = useState(false); // "Add player" modal open?
  const [editing, setEditing] = useState(null); // player currently being edited, or null
  const [pendingDelete, setPendingDelete] = useState(null); // player awaiting delete confirmation
  const [error, setError] = useState(null);

  const trainingCount = players.filter((player) => player.isPlayer).length;
  const adminCount = players.filter((player) => player.isAdmin).length;

  /** Re-fetches the roster from the server after a change, so the list reflects reality. */
  async function refresh() {
    const { players: next } = await api.get('/api/admin/players');
    setPlayers(next);
  }

  /** Handles the "Add player" form submit: create, then refresh and close the modal. */
  async function submitNew(input) {
    setError(null);
    await api.post('/api/admin/players', input);
    await refresh();
    setCreating(false);
  }

  /** Handles the "Edit player" form submit for whichever player is currently `editing`. */
  async function submitEdit(input) {
    if (!editing) return;
    setError(null);
    await api.patch(`/api/admin/players/${editing.id}`, input);
    await refresh();
    setEditing(null);
  }

  /** Runs after the delete confirmation dialog is accepted. */
  async function confirmDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await api.delete(`/api/admin/players/${pendingDelete.id}`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove that player.');
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Players"
        subtitle={`${teamName} · ${trainingCount} training · ${adminCount} ${adminCount === 1 ? 'admin' : 'admins'}`}
        action={<Button onClick={() => setCreating(true)}>Add player</Button>}
      />

      <ErrorNote message={error} />

      {players.length === 0 ? (
        <EmptyState
          title="Nobody on the roster yet"
          description="Add your squad here. Players sign in by picking their name after entering the team code."
          icon={<span className="text-3xl">👥</span>}
          action={<Button onClick={() => setCreating(true)}>Add the first player</Button>}
        />
      ) : (
        // One row per player: name + badges (role/position/PIN-missing warning)
        // on the left, Edit/Delete buttons on the right.
        <ul className="mt-1 flex flex-col gap-2" style={{ listStyle: 'none', padding: 0 }}>
          {players.map((player) => (
            <li key={player.id}>
              <div className="list-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink-50">
                    {player.name}
                    {player.id === currentPlayerId && <span className="ml-2 text-xs text-ink-400">you</span>}
                  </p>
                  <div className="mt-1-5 flex flex-wrap gap-1-5">
                    {player.isAdmin && <Badge tone="good">Admin</Badge>}
                    {player.isPlayer && <Badge tone="neutral">Player</Badge>}
                    {player.positionGroup && (
                      <Badge tone={player.positionGroup === 'forward' ? 'info' : 'warn'}>
                        {player.positionGroup === 'forward' ? 'Forward' : 'Back'}
                      </Badge>
                    )}
                    {player.isAdmin && !player.hasAdminPin && <Badge tone="bad">No PIN</Badge>}
                  </div>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button variant="secondary" size="sm" className="size-11" onClick={() => setEditing(player)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-11"
                    style={{ color: 'var(--alert-400)' }}
                    onClick={() => setPendingDelete(player)}
                    disabled={player.id === currentPlayerId}
                    title={player.id === currentPlayerId ? 'You cannot delete your own account.' : undefined}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Add player">
        <PlayerForm player={null} onSubmit={submitNew} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing ? editing.name : 'Edit player'}>
        {editing && <PlayerForm key={editing.id} player={editing} onSubmit={submitEdit} onCancel={() => setEditing(null)} />}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove player"
        message={
          pendingDelete
            ? `Remove ${pendingDelete.name} from ${teamName}? This also deletes every session and set they have logged, and cannot be undone.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
