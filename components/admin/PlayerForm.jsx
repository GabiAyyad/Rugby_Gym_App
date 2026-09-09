'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { Button, ErrorNote, Input, Select } from '@/components/shared';

/**
 * There is no Checkbox in components/shared, and the two role flags genuinely
 * are independent booleans rather than a choice — so this is a labelled row
 * around a native checkbox, sized to the 44px target like everything else.
 */
function ToggleRow({ checked, onChange, label, description }) {
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="min-w-0">
        <span className="text-sm font-medium text-ink-50" style={{ display: 'block' }}>
          {label}
        </span>
        <span className="text-xs text-ink-400" style={{ display: 'block' }}>
          {description}
        </span>
      </span>
    </label>
  );
}

/**
 * Add/edit form for one player. Same form serves both cases: pass `player`
 * (an existing Player object) to edit, or `null` to create a new one.
 *
 * @param {object} props
 * @param {object|null} props.player Existing player to edit, or null to create.
 * @param {(input: object) => Promise<void>} props.onSubmit Called with the
 *   {name, positionGroup, isAdmin, isPlayer, adminPin} payload on submit.
 *   Left to throw ApiError on failure — this component renders the message.
 * @param {() => void} props.onCancel Called when the user cancels.
 */
export function PlayerForm({ player, onSubmit, onCancel }) {
  const [name, setName] = useState(player?.name ?? '');
  const [positionGroup, setPositionGroup] = useState(player?.positionGroup ?? '');
  const [isPlayer, setIsPlayer] = useState(player?.isPlayer ?? true);
  const [isAdmin, setIsAdmin] = useState(player?.isAdmin ?? false);
  const [adminPin, setAdminPin] = useState('');
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  // Whether an admin's PIN already exists in the database — used only to decide
  // the wording of the PIN field's label/hint below (a blank PIN field on save
  // means "leave it alone", which only makes sense if one already exists).
  const keepsExistingPin = player?.hasAdminPin ?? false;

  // Builds the payload and hands it to the parent's onSubmit; catches ApiError
  // so field-level errors (e.g. "name already taken") render inline.
  async function handleSubmit(event) {
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
        onChange={(event) => setPositionGroup(event.target.value)}
        error={fieldErrors.positionGroup}
        hint={isPlayer ? 'Decides which of the two programs they train.' : 'Only needed for people who train.'}
      >
        <option value="">Not set</option>
        <option value="forward">Forward</option>
        <option value="back">Back</option>
      </Select>

      <fieldset className="flex flex-col gap-2" style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="mb-1 text-sm font-medium text-ink-200">Roles</legend>
        <ToggleRow
          checked={isPlayer}
          onChange={setIsPlayer}
          label="Trains with the squad"
          description="Gets Today's Session, logging and history."
        />
        <ToggleRow checked={isAdmin} onChange={setIsAdmin} label="Admin" description="Can manage players, exercises and programs. Needs a PIN." />
        {fieldErrors.isPlayer && <p className="field-error">{fieldErrors.isPlayer}</p>}
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
          hint={keepsExistingPin ? 'Leave blank to keep their current PIN.' : '4-8 digits. They enter this every time they sign in.'}
        />
      )}

      <div className="mt-1 flex gap-2" style={{ justifyContent: 'flex-end' }}>
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
