type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="react-empty-state">
      <span className="react-empty-state-icon">
        <i className="ti ti-inbox"></i>
      </span>
      <h6>{title}</h6>
      <p>{body}</p>
    </div>
  );
}
