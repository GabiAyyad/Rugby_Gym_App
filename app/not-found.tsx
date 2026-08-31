import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-4xl">🏉</p>
      <h1 className="text-xl font-bold">Nothing here</h1>
      <p className="text-sm text-ink-400">That page does not exist.</p>
      <Link
        href="/"
        className="mt-3 rounded-xl bg-pitch-500 px-5 py-3 font-semibold text-ink-950 hover:bg-pitch-400"
      >
        Back to the app
      </Link>
    </main>
  );
}
