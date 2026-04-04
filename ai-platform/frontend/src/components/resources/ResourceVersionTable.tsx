import type { ReactNode } from 'react';

import { StatusBadge } from '../shared/StatusBadge';

type ResourceVersionTableProps<TVersion> = {
  versions: TVersion[];
  selectedId?: string;
  getId: (version: TVersion) => string;
  getPrimaryLabel: (version: TVersion) => string;
  getSecondaryLabel?: (version: TVersion) => string | null;
  getVersion: (version: TVersion) => number;
  getStatus: (version: TVersion) => string;
  getCreatedAt: (version: TVersion) => string;
  onSelect: (version: TVersion) => void;
  actionSlot?: (version: TVersion) => ReactNode;
};

export function ResourceVersionTable<TVersion>({
  versions,
  selectedId,
  getId,
  getPrimaryLabel,
  getSecondaryLabel,
  getVersion,
  getStatus,
  getCreatedAt,
  onSelect,
  actionSlot,
}: ResourceVersionTableProps<TVersion>) {
  return (
    <div className="table-responsive">
      <table className="table datanew react-resource-table mb-0">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Version</th>
            <th>Status</th>
            <th>Created</th>
            <th className="text-end">Action</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => {
            const id = getId(version);
            return (
              <tr
                key={id}
                className={selectedId === id ? 'react-row-selected' : undefined}
              >
                <td>
                  <button
                    type="button"
                    className="btn btn-link react-row-button p-0"
                    onClick={() => onSelect(version)}
                  >
                    <span className="d-block fw-semibold">
                      {getPrimaryLabel(version)}
                    </span>
                    {getSecondaryLabel?.(version) ? (
                      <span className="text-muted fs-12">
                        {getSecondaryLabel(version)}
                      </span>
                    ) : null}
                  </button>
                </td>
                <td>v{getVersion(version)}</td>
                <td>
                  <StatusBadge status={getStatus(version)} />
                </td>
                <td>{new Date(getCreatedAt(version)).toLocaleString()}</td>
                <td className="text-end">{actionSlot?.(version)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
