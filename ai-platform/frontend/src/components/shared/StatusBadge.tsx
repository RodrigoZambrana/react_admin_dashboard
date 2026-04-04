import type { ManagedResourceStatus } from '../../types';

type StatusBadgeProps = {
  status: ManagedResourceStatus | string;
};

const classByStatus: Record<string, string> = {
  ACTIVE: 'badge-soft-success',
  DRAFT: 'badge-soft-warning',
  ARCHIVED: 'badge-soft-secondary',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`badge ${classByStatus[status] ?? 'badge-soft-info'}`}>
      {status}
    </span>
  );
}
