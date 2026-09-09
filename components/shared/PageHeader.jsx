// PageHeader.jsx — the standard heading block used at the top of nearly every
// screen: a bold title, an optional grey subtitle line underneath, and an
// optional right-aligned action (usually a Button, e.g. "Add player").
export function PageHeader({ title, subtitle, action }) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        <h1>{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
