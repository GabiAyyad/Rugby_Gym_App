export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-4xl">📶</p>
      <h1 className="text-xl font-bold">No connection</h1>
      <p className="max-w-sm text-sm text-ink-400">
        This screen needs signal to load the first time. Anything you already logged is saved on
        this phone and will sync as soon as you are back online.
      </p>
    </main>
  );
}
