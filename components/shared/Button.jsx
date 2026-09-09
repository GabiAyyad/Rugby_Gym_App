'use client';

// Button.jsx — the app's one button component. Every clickable button in the
// app (primary actions, cancel links, icon buttons) should render through
// this rather than a bare <button>, so hover/disabled/loading states and
// sizing stay consistent. Styling comes from plain CSS classes in
// styles/components.css (see .btn / .btn-primary / etc.), not Tailwind.

import { forwardRef } from 'react';
import { cn } from './cn';

// Colour/style variants, mapped to the CSS classes that implement them.
const VARIANT_CLASS = {
  primary: 'btn-primary', // the main call-to-action colour (green)
  secondary: 'btn-secondary', // a lower-emphasis outlined button
  ghost: 'btn-ghost', // no background until hovered — for "Cancel"/"Back"
  danger: 'btn-danger', // red — destructive actions like "Delete"
};

// Height/padding variants.
const SIZE_CLASS = {
  sm: 'btn-sm',
  md: '', // the .btn class alone already sets the default (medium) size
  lg: 'btn-lg',
};

/**
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'} [props.variant] Colour style.
 * @param {'sm'|'md'|'lg'} [props.size] Height/padding.
 * @param {boolean} [props.loading] Shows a spinner and disables the button while true.
 * @param {boolean} [props.fullWidth] Stretches the button to fill its container.
 * @param {boolean} [props.disabled] Disables the button outright.
 * All other props (onClick, type, aria-label, ...) pass straight through to
 * the underlying <button>.
 */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      // A button that is loading counts as disabled too, so it can't be clicked twice.
      disabled={disabled || loading}
      className={cn('btn', VARIANT_CLASS[variant], SIZE_CLASS[size], fullWidth && 'btn-full', className)}
      {...props}
    >
      {/* Small spinning ring shown in place of/alongside the label while `loading` is true. */}
      {loading && <span aria-hidden className="spinner" style={{ width: '1rem', height: '1rem' }} />}
      {children}
    </button>
  );
});
