export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-ink-400" role="status">
      <span
        aria-hidden
        className="size-5 animate-spin rounded-full border-2 border-ink-600 border-t-pitch-400"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-ink-800 ${className}`} />;
}
