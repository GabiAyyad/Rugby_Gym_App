'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Native <dialog>, so focus trapping and Esc come from the platform rather than
 * from us re-implementing them.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-ink-700 bg-ink-900 p-0 text-ink-50 backdrop:bg-black/70"
    >
      <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-9 place-items-center rounded-lg text-ink-400 hover:bg-ink-800 hover:text-ink-50"
        >
          ✕
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-ink-800 px-4 py-3">{footer}</div>}
    </dialog>
  );
}
