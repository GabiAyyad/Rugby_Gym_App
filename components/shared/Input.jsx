'use client';

// Input.jsx — a text input with an optional label, hint text, and error
// message, wired up with the right aria attributes so screen readers
// announce the error/hint. Every text/number/date/etc. <input> in the app
// should use this instead of a bare <input>.
import { forwardRef, useId } from 'react';
import { cn } from './cn';

/**
 * @param {object} props
 * @param {string} [props.label] Label text shown above the field.
 * @param {string} [props.hint] Grey helper text shown below the field (hidden if `error` is set).
 * @param {string} [props.error] Red error text shown below the field instead of the hint.
 * @param {string} [props.id] Explicit id — auto-generated with useId() if omitted, so the
 *   <label> always points at the right input even when several Inputs render on one page.
 * All other props (value, onChange, type, placeholder, ...) pass straight through to
 * the underlying <input>.
 */
export const Input = forwardRef(function Input({ label, hint, error, className, id, ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  // Points aria-describedby at whichever helper text is actually showing
  // (error takes priority over hint), so assistive tech reads it out.
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="field">
      {label && (
        <label htmlFor={inputId} className="field-label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn('control', error && 'control-error', className)}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
