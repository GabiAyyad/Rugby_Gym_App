// Next.js's special 404 page — rendered automatically for any URL that
// matches no route (a typo, an old bookmark, a deleted program's link, etc.).
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex flex-col items-center justify-center gap-3 text-center" style={{ minHeight: '100dvh', padding: '0 1.5rem' }}>
      <p className="text-3xl">🏉</p>
      <h1 className="text-xl font-bold">Nothing here</h1>
      <p className="text-sm text-ink-400">That page does not exist.</p>
      <Link href="/" className="btn btn-primary mt-3" style={{ textDecoration: 'none' }}>
        Back to the app
      </Link>
    </main>
  );
}
