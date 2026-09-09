// LoadingState.jsx — two small "please wait" building blocks:
//  - LoadingState: a spinner + text row for a whole screen/section that's
//    still fetching data (e.g. "Opening your session…").
//  - Skeleton: a plain pulsing grey box, for blocking out where content will
//    appear once it loads (a placeholder shape rather than a spinner).

/** Centered spinner + label, used as a full replacement for a screen's content while loading. */
export function LoadingState({ label = 'Loading…' }) {
  return (
    // role="status" announces the loading text to screen readers.
    <div className="loading-state" role="status">
      <span aria-hidden className="spinner" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** A pulsing placeholder box — pass a className to size it to whatever content it stands in for. */
export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}
