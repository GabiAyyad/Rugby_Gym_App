'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-4xl">⚠️</p>
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-ink-400">
        {error.message || 'The app hit an unexpected error.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-xl bg-pitch-500 px-5 py-3 font-semibold text-ink-950 hover:bg-pitch-400"
      >
        Try again
      </button>
    </main>
  );
}
