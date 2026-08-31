'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Modal,
  PageHeader,
} from '@/components/shared';
import type { CreatePlayerInput, ListPlayersResult, Player } from '@/types/player';
import { PlayerForm } from './PlayerForm';

/**
 * The roster for one squad. Everything it touches is already scoped to the
 * caller's team server-side, so there is no team selector here by design —
 * players never move between Palestine and Cyprus.
 */
export function PlayersManager({
  initialPlayers,
  teamName,
  currentPlayerId,
}: {
  initialPlayers: Player[];
  teamName: string;
  currentPlayerId: string;
}) {
  const [players, setPlayers] = useState(initialPlayers);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trainingCount = players.filter((player) => player.isPlayer).length;
  const adminCount = players.filter((player) => player.isAdmin).length;

  async function refresh() {
    const { players: next } = await api.get<ListPlayersResult>('/api/admin/players');
    setPlayers(next);
  }

  async function submitNew(input: CreatePlayerInput) {
    setError(null);
    await api.post<Player>('/api/admin/players', input);
    await refresh();
    setCreating(false);
  }

  async function submitEdit(input: CreatePlayerInput) {
    if (!editing) return;
    setError(null);
    await api.patch<Player>(`/api/admin/players/${editing.id}`, input);
    await refresh();
    setEditing(null);
  }

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
        <ul className="mt-1 flex flex-col gap-2">
          {players.map((player) => (
            <li key={player.id}>
              <div className="flex items-start gap-3 rounded-card border border-ink-800 bg-ink-900 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink-50">
                    {player.name}
                    {player.id === currentPlayerId && (
                      <span className="ml-2 text-xs font-normal text-ink-400">you</span>
                    )}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-11 px-3"
                    onClick={() => setEditing(player)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 px-3 text-alert-400 hover:text-alert-400"
                    onClick={() => setPendingDelete(player)}
                    disabled={player.id === currentPlayerId}
                    title={
                      player.id === currentPlayerId ? 'You cannot delete your own account.' : undefined
                    }
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

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? editing.name : 'Edit player'}
      >
        {editing && (
          <PlayerForm
            key={editing.id}
            player={editing}
            onSubmit={submitEdit}
            onCancel={() => setEditing(null)}
          />
        )}
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
