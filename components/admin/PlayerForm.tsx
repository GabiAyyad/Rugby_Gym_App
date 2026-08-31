'use client';

import { useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { Button, ErrorNote, Input, Select } from '@/components/shared';
import type { PositionGroup } from '@/types/database';
import type { CreatePlayerInput, Player } from '@/types/player';

/**
 * There is no Checkbox in components/shared, and the two role flags genuinely
 * are independent booleans rather than a choice — so this is a labelled row
 * around a native checkbox, sized to the 44px target like everything else.
 */
function ToggleRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-ink-700 bg-ink-900 px-3 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-pitch-500"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-50">{label}</span>
        <span className="block text-xs text-ink-400">{description}</span>
      </span>
    </label>
  );
}

export function PlayerForm({
  player,
  onSubmit,
  onCancel,
}: {
  player: Player | null;
  onSubmit: (input: CreatePlayerInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(player?.name ?? '');
  const [positionGroup, setPositionGroup] = useState<PositionGroup | ''>(
    player?.positionGroup ?? '',
  );
  const [isPlayer, setIsPlayer] = useState(player?.isPlayer ?? true);
  const [isAdmin, setIsAdmin] = useState(player?.isAdmin ?? false);
  const [adminPin, setAdminPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const keepsExistingPin = player?.hasAdminPin ?? false;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await onSubmit({
        name: name.trim(),
        positionGroup: positionGroup === '' ? null : positionGroup,
        isAdmin,
        isPlayer,
        adminPin: adminPin.trim() ? adminPin.trim() : null,
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
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={fieldErrors.name}
        placeholder="Sami Haddad"
        autoComplete="off"
        autoFocus
        required
      />

      <Select
        label="Position group"
        value={positionGroup}
        onChange={(event) => setPositionGroup(event.target.value as PositionGroup | '')}
        error={fieldErrors.positionGroup}
        hint={
          isPlayer
            ? 'Decides which of the two programs they train.'
            : 'Only needed for people who train.'
        }
      >
        <option value="">Not set</option>
        <option value="forward">Forward</option>
        <option value="back">Back</option>
      </Select>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-200">Roles</legend>
        <ToggleRow
          checked={isPlayer}
          onChange={setIsPlayer}
          label="Trains with the squad"
          description="Gets Today's Session, logging and history."
        />
        <ToggleRow
          checked={isAdmin}
          onChange={setIsAdmin}
          label="Admin"
          description="Can manage players, exercises and programs. Needs a PIN."
        />
        {fieldErrors.isPlayer && <p className="text-sm text-alert-400">{fieldErrors.isPlayer}</p>}
      </fieldset>

      {isAdmin && (
        <Input
          label={keepsExistingPin ? 'New admin PIN' : 'Admin PIN'}
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={adminPin}
          onChange={(event) => setAdminPin(event.target.value.replace(/\D/g, ''))}
          error={fieldErrors.adminPin}
          hint={
            keepsExistingPin
              ? 'Leave blank to keep their current PIN.'
              : '4-8 digits. They enter this every time they sign in.'
          }
        />
      )}

      <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {player ? 'Save changes' : 'Add player'}
        </Button>
      </div>
    </form>
  );
}
