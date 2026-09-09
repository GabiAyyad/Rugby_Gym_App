// The service worker's fallback page (see public/sw.js): shown when a
// navigation to a page that hasn't been cached yet fails because there is no
// network. Static and dependency-free on purpose, so it always loads even
// with zero signal.
export default function OfflinePage() {
  return (
    <main className="flex flex-col items-center justify-center gap-3 text-center" style={{ minHeight: '100dvh', padding: '0 1.5rem' }}>
      <p className="text-3xl">📶</p>
      <h1 className="text-xl font-bold">No connection</h1>
      <p className="text-sm text-ink-400" style={{ maxWidth: '24rem' }}>
        This screen needs signal to load the first time. Anything you already logged is saved on this phone and will sync as soon as you are back online.
      </p>
    </main>
  );
}
