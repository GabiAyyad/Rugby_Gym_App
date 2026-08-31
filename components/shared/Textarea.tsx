'use client';

import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const areaId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={areaId} className="text-sm font-medium text-ink-200">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={areaId}
        rows={3}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full rounded-xl border bg-ink-900 px-3 py-2 text-ink-50 placeholder:text-ink-600',
          'focus:outline-2 focus:outline-offset-0 focus:outline-pitch-400',
          error ? 'border-alert-500' : 'border-ink-700',
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="text-sm text-alert-400">{error}</p>
      ) : hint ? (
        <p className="text-sm text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
});
