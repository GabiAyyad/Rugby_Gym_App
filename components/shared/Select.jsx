'use client';

// Select.jsx — a <select> dropdown with the same label/hint/error treatment
// as Input.jsx, so form fields look consistent whether they're text or a
// dropdown. Pass the <option> elements as children, same as a plain <select>.
import { forwardRef, useId } from 'react';
import { cn } from './cn';

/**
 * @param {object} props
 * @param {string} [props.label] Label text shown above the field.
 * @param {string} [props.hint] Grey helper text shown below (hidden if `error` is set).
 * @param {string} [props.error] Red error text shown below instead of the hint.
 * @param {import('react').ReactNode} props.children The <option> elements.
 * All other props (value, onChange, disabled, ...) pass straight through to
 * the underlying <select>.
 */
export const Select = forwardRef(function Select({ label, hint, error, className, id, children, ...props }, ref) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="field">
      {label && (
        <label htmlFor={selectId} className="field-label">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cn('control', error && 'control-error', className)}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
});
