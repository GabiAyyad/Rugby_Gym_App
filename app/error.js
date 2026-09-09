'use client';

// Next.js error boundary: automatically wraps every page in this app
// (`app/`) and catches any uncaught render/render-time error, showing this
// screen instead of a blank crash. `reset` re-renders the page that threw.
import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }) {
  // Log to the console (and, in production, wherever console output is
  // captured) so the error isn't silently swallowed by the friendly screen.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-col items-center justify-center gap-3 text-center" style={{ minHeight: '100dvh', padding: '0 1.5rem' }}>
      <p className="text-3xl">⚠️</p>
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="text-sm text-ink-400" style={{ maxWidth: '24rem' }}>
        {error.message || 'The app hit an unexpected error.'}
      </p>
      <button type="button" onClick={reset} className="btn btn-primary mt-3">
        Try again
      </button>
    </main>
  );
}
