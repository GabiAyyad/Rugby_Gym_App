// cn.js — thin wrapper around the `clsx` package for building a className
// string out of a mix of strings, conditionals, and falsy values, e.g.
// `cn('btn', variant && 'btn-primary', className)`. Used by every shared
// component so conditional classes don't need manual template-string joining.
import clsx from 'clsx';

/** Joins any number of class-name-ish values, skipping any that are falsy. */
export function cn(...inputs) {
  return clsx(inputs);
}
