'use client';

// Modal.jsx — the app's popup dialog: a titled box with a close button, a
// scrollable body, and an optional footer row (usually Cancel/Confirm
// buttons). Used directly for forms (Add player, Add exercise, ...) and as
// the base for ConfirmDialog.jsx.
import { useEffect, useRef } from 'react';

/**
 * Native <dialog>, so focus trapping and Esc come from the platform rather than
 * from us re-implementing them.
 *
 * @param {object} props
 * @param {boolean} props.open Whether the dialog should be showing.
 * @param {() => void} props.onClose Called when the dialog should close — from
 *   the ✕ button, pressing Esc, or clicking outside (the "cancel" event).
 * @param {string} props.title Heading shown in the dialog's header bar.
 * @param {import('react').ReactNode} props.children The dialog's main content.
 * @param {import('react').ReactNode} [props.footer] Optional row of buttons
 *   shown below the content, separated by a top border.
 */
export function Modal({ open, onClose, title, children, footer }) {
  const ref = useRef(null);

  // <dialog> has its own open/close API (showModal/close) rather than a CSS
  // `display` toggle — this effect keeps the DOM element in sync with the
  // `open` prop whenever it changes.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Fired when the dialog is closed by any means (including dialog.close()
      // above) — keeps the caller's `open` state in sync if the dialog closes
      // itself, e.g. via Esc.
      onClose={onClose}
      // The native "cancel" event fires on Esc before "close" does; without
      // preventDefault the browser's default handling could skip our onClose.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="modal"
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="modal-close">
          ✕
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </dialog>
  );
}
