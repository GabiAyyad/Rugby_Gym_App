export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-sm text-alert-400"
    >
      {message}
    </p>
  );
}
