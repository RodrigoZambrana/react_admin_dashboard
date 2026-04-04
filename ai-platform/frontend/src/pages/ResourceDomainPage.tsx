import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { ResourceVersionTable } from '../components/resources/ResourceVersionTable';
import { EmptyState } from '../components/shared/EmptyState';
import { JsonBlock } from '../components/shared/JsonBlock';
import { PageHeader } from '../components/shared/PageHeader';

type ResourceDomainPageProps<TVersion> = {
  title: string;
  section: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
  loadVersions: () => Promise<TVersion[]>;
  loadActive: () => Promise<TVersion[]>;
  getId: (version: TVersion) => string;
  getPrimaryLabel: (version: TVersion) => string;
  getSecondaryLabel?: (version: TVersion) => string | null;
  getVersion: (version: TVersion) => number;
  getStatus: (version: TVersion) => string;
  getCreatedAt: (version: TVersion) => string;
  getCreatedBy: (version: TVersion) => string | null | undefined;
  getPayload: (version: TVersion) => unknown;
  renderSummary: (version: TVersion) => ReactNode;
};

export function ResourceDomainPage<TVersion>({
  title,
  section,
  description,
  emptyTitle,
  emptyBody,
  loadVersions,
  loadActive,
  getId,
  getPrimaryLabel,
  getSecondaryLabel,
  getVersion,
  getStatus,
  getCreatedAt,
  getCreatedBy,
  getPayload,
  renderSummary,
}: ResourceDomainPageProps<TVersion>) {
  const [versions, setVersions] = useState<TVersion[]>([]);
  const [activeVersions, setActiveVersions] = useState<TVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const [versionData, activeData] = await Promise.all([loadVersions(), loadActive()]);
      setVersions(versionData);
      setActiveVersions(activeData);
      setSelectedId((current) =>
        current ?? (versionData[0] ? getId(versionData[0]) : undefined),
      );
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selectedVersion = useMemo(
    () => versions.find((version) => getId(version) === selectedId) ?? versions[0],
    [getId, selectedId, versions],
  );

  const latestCreatedAt = versions[0] ? new Date(getCreatedAt(versions[0])).toLocaleString() : 'n/a';

  return (
    <>
      <PageHeader title={title} section={section} description={description} />

      {error ? (
        <div className="alert alert-danger custom-react-alert" role="alert">
          {error}
        </div>
      ) : null}

      <div className="row">
        <div className="col-md-6 col-xl-4 d-flex">
          <div className="card total-users flex-fill">
            <div className="card-body">
              <div className="total-counts">
                <div className="d-flex align-items-center">
                  <span className="bg-success total-count-icons">
                    <i className="ti ti-bolt"></i>
                  </span>
                  <div>
                    <p>Active versions</p>
                    <h5>{loading ? '...' : activeVersions.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-success">Published now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-xl-4 d-flex">
          <div className="card total-users flex-fill">
            <div className="card-body">
              <div className="total-counts">
                <div className="d-flex align-items-center">
                  <span className="bg-dark total-count-icons">
                    <i className="ti ti-history"></i>
                  </span>
                  <div>
                    <p>Total versions</p>
                    <h5>{loading ? '...' : versions.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-dark">Version timeline</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-12 col-xl-4 d-flex">
          <div className="card total-users flex-fill">
            <div className="card-body">
              <div className="total-counts">
                <div className="d-flex align-items-center">
                  <span className="bg-info total-count-icons">
                    <i className="ti ti-clock-edit"></i>
                  </span>
                  <div>
                    <p>Latest version</p>
                    <h5>{versions[0] ? `v${getVersion(versions[0])}` : 'n/a'}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-info">{latestCreatedAt}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xxl-5 d-flex">
          <div className="card flex-fill">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">Version history</h5>
              <button className="btn btn-dark btn-sm" onClick={() => void refresh()}>
                <i className="ti ti-refresh me-1"></i>Refresh
              </button>
            </div>
            <div className="card-body p-0">
              {versions.length === 0 && !loading ? (
                <div className="p-4">
                  <EmptyState title={emptyTitle} body={emptyBody} />
                </div>
              ) : (
                <ResourceVersionTable
                  versions={versions}
                  selectedId={selectedVersion ? getId(selectedVersion) : undefined}
                  getId={getId}
                  getPrimaryLabel={getPrimaryLabel}
                  getSecondaryLabel={getSecondaryLabel}
                  getVersion={getVersion}
                  getStatus={getStatus}
                  getCreatedAt={getCreatedAt}
                  onSelect={(version) => setSelectedId(getId(version))}
                />
              )}
            </div>
          </div>
        </div>
        <div className="col-xxl-7 d-flex">
          <div className="card flex-fill">
            <div className="card-header">
              <h5 className="mb-0">Operator detail</h5>
            </div>
            <div className="card-body">
              {selectedVersion ? (
                <div className="row">
                  <div className="col-xl-6">
                    <div className="react-resource-summary">{renderSummary(selectedVersion)}</div>
                    <div className="react-meta-list mt-4">
                      <div>
                        <span className="react-meta-label">Created by</span>
                        <strong>{getCreatedBy(selectedVersion) ?? 'system'}</strong>
                      </div>
                      <div>
                        <span className="react-meta-label">Created at</span>
                        <strong>
                          {new Date(getCreatedAt(selectedVersion)).toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="col-xl-6">
                    <JsonBlock value={getPayload(selectedVersion)} />
                  </div>
                </div>
              ) : (
                <EmptyState title={emptyTitle} body={emptyBody} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
