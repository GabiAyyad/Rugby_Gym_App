// ErrorNote.jsx — a small red banner for showing a form/API error message.
// Renders nothing at all when there's no message, so callers can always
// mount it (e.g. `<ErrorNote message={error} />`) instead of conditionally
// rendering it themselves.
export function ErrorNote({ message }) {
  if (!message) return null;
  return (
    // role="alert" tells screen readers to announce this as soon as it appears.
    <p role="alert" className="error-note">
      {message}
    </p>
  );
}
