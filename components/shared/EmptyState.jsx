// EmptyState.jsx — the "nothing here yet" placeholder shown instead of a list
// when there's no data (no players added, no exercises match a filter, no
// sessions logged). Renders an optional icon/emoji, a bold title, an optional
// explanatory line, and an optional call-to-action (usually a Button).
export function EmptyState({ title, description, action, icon }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
