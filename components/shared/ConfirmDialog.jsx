'use client';

// ConfirmDialog.jsx — a "are you sure?" popup built on top of Modal, used
// before every destructive action in the app (deleting a player, exercise,
// program, or day). Renders a message plus Cancel/confirm buttons, and shows
// a spinner on the confirm button while `onConfirm` is running so the user
// can't double-submit a delete.
import { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

/**
 * @param {object} props
 * @param {boolean} props.open Whether the dialog is visible.
 * @param {string} props.title Dialog heading.
 * @param {string} props.message Explanation of what the confirm button will do.
 * @param {string} [props.confirmLabel] Text on the confirm button (defaults to "Delete").
 * @param {() => Promise<void>|void} props.onConfirm Called when the user confirms;
 *   while it's pending, both buttons are disabled/loading so it can't fire twice.
 * @param {() => void} props.onCancel Called to close the dialog without confirming.
 */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  // True while onConfirm's promise is in flight — locks the dialog so the
  // user can't close it or double-click the confirm button mid-delete.
  const [working, setWorking] = useState(false);

  return (
    <Modal
      open={open}
      onClose={working ? () => undefined : onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={working}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={working}
            onClick={async () => {
              setWorking(true);
              try {
                await onConfirm();
              } finally {
                // Always clear the loading state, even if onConfirm threw —
                // otherwise a failed delete would leave the button stuck spinning.
                setWorking(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-300">{message}</p>
    </Modal>
  );
}
