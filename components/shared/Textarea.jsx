'use client';

// Textarea.jsx — a multi-line text field with the same label/hint/error
// treatment as Input.jsx and Select.jsx. Defaults to 3 rows tall.
import { forwardRef, useId } from 'react';
import { cn } from './cn';

/**
 * @param {object} props
 * @param {string} [props.label] Label text shown above the field.
 * @param {string} [props.hint] Grey helper text shown below (hidden if `error` is set).
 * @param {string} [props.error] Red error text shown below instead of the hint.
 * All other props (value, onChange, rows, maxLength, ...) pass straight
 * through to the underlying <textarea>.
 */
export const Textarea = forwardRef(function Textarea({ label, hint, error, className, id, ...props }, ref) {
  const generatedId = useId();
  const areaId = id ?? generatedId;

  return (
    <div className="field">
      {label && (
        <label htmlFor={areaId} className="field-label">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={areaId}
        rows={3}
        aria-invalid={error ? true : undefined}
        className={cn('control', error && 'control-error', className)}
        {...props}
      />
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
});
