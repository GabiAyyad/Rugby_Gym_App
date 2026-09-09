// Card.jsx — the app's boxed-content container: a rounded, bordered panel
// used for list rows, dashboard tiles, and grouped form sections. `Card` is
// the outer box; `CardHeader`/`CardBody` are optional, plain wrappers that
// add the standard padding/border-between-sections look when you need more
// than one section inside a card (see styles/components.css for the classes).
import { cn } from './cn';

/** The outer card box — a rounded panel with a border and dark background. */
export function Card({ className, children }) {
  return <div className={cn('card', className)}>{children}</div>;
}

/** A header strip inside a Card, separated from the body by a bottom border. */
export function CardHeader({ className, children }) {
  return <div className={cn('card-header', className)}>{children}</div>;
}

/** The padded main content area of a Card. */
export function CardBody({ className, children }) {
  return <div className={cn('card-body', className)}>{children}</div>;
}
