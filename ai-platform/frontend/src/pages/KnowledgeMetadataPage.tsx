import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  activateKnowledgeMetadataVersion,
  createKnowledgeMetadataVersion,
  listActiveKnowledgeMetadata,
  listKnowledgeMetadataVersions,
} from '../api';
import { ResourceVersionTable } from '../components/resources/ResourceVersionTable';
import { EmptyState } from '../components/shared/EmptyState';
import { JsonBlock } from '../components/shared/JsonBlock';
import { PageHeader } from '../components/shared/PageHeader';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { KnowledgeMetadataResource, KnowledgeMetadataVersion } from '../types';
import { formatDateTime, toPrettyJson } from '../utils';

type KnowledgeMetadataFormState = {
  key: KnowledgeMetadataVersion['key'];
  jsonText: string;
  activate: boolean;
};

function buildDefaultKnowledgeMetadata(): KnowledgeMetadataResource {
  return {
    enabledStages: ['execution', 'response'],
    metadataAllowList: ['sku', 'category', 'requestedDateIso'],
    stagePolicies: {
      execution: {
        enabled: true,
        minConfidence: 0.7,
        defaultTags: ['approved'],
      },
    },
  };
}

function buildKnowledgeForm(
  base?: KnowledgeMetadataVersion,
): KnowledgeMetadataFormState {
  return {
    key: base?.key ?? 'default',
    jsonText: toPrettyJson(base?.resource ?? buildDefaultKnowledgeMetadata()),
    activate: base?.status === 'ACTIVE',
  };
}

export function KnowledgeMetadataPage() {
  const [versions, setVersions] = useState<KnowledgeMetadataVersion[]>([]);
  const [activeVersions, setActiveVersions] = useState<KnowledgeMetadataVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [form, setForm] = useState<KnowledgeMetadataFormState>(buildKnowledgeForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedId) ?? versions[0],
    [selectedId, versions],
  );

  const refresh = async (nextSelectedId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const [versionData, activeData] = await Promise.all([
        listKnowledgeMetadataVersions(),
        listActiveKnowledgeMetadata(),
      ]);
      setVersions(versionData);
      setActiveVersions(activeData);
      const nextSelected = nextSelectedId ?? selectedId ?? versionData[0]?.id;
      setSelectedId(nextSelected);
      const nextVersion = versionData.find((version) => version.id === nextSelected);
      if (nextVersion) {
        setForm(buildKnowledgeForm(nextVersion));
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const created = await createKnowledgeMetadataVersion({
        key: form.key,
        resource: JSON.parse(form.jsonText) as KnowledgeMetadataResource,
        activate: form.activate,
        createdBy: 'admin-ui',
      });
      setNotice(
        `Knowledge metadata ${created.key} v${created.version} stored${created.status === 'ACTIVE' ? ' and activated' : ''}.`,
      );
      await refresh(created.id);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (versionId: string) => {
    try {
      setActivatingId(versionId);
      setError(null);
      setNotice(null);
      const activated = await activateKnowledgeMetadataVersion(versionId);
      setNotice(
        `Knowledge metadata ${activated.key} activated as v${activated.version}.`,
      );
      await refresh(activated.id);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setActivatingId(undefined);
    }
  };

  const useSelectedAsBase = () => {
    if (!selectedVersion) {
      return;
    }

    setForm(buildKnowledgeForm(selectedVersion));
    setNotice(
      `Loaded knowledge metadata ${selectedVersion.key} v${selectedVersion.version} into the editor.`,
    );
  };

  return (
    <>
      <PageHeader
        title="Knowledge metadata"
        section="Knowledge metadata"
        description="Operate governed metadata policies that shape learning extraction and later knowledge-center tooling."
      />

      {error ? (
        <div className="alert alert-danger custom-react-alert" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="alert alert-success custom-react-alert" role="alert">
          {notice}
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
                    <p>Active policies</p>
                    <h5>{loading ? '...' : activeVersions.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-success">Learning-ready</span>
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
                  <span className="bg-dark">Policy timeline</span>
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
                    <i className="ti ti-tags"></i>
                  </span>
                  <div>
                    <p>Selected stages</p>
                    <h5>
                      {selectedVersion
                        ? selectedVersion.resource.enabledStages.length
                        : 'n/a'}
                    </h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-info">Trace extraction coverage</span>
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
              <h5 className="mb-0">Metadata version history</h5>
              <button className="btn btn-dark btn-sm" onClick={() => void refresh()}>
                <i className="ti ti-refresh me-1"></i>Refresh
              </button>
            </div>
            <div className="card-body p-0">
              {versions.length === 0 && !loading ? (
                <div className="p-4">
                  <EmptyState
                    title="No knowledge metadata found"
                    body="Create the first governed metadata policy for this tenant."
                  />
                </div>
              ) : (
                <ResourceVersionTable
                  versions={versions}
                  selectedId={selectedVersion?.id}
                  getId={(version) => version.id}
                  getPrimaryLabel={(version) => version.key}
                  getSecondaryLabel={(version) =>
                    `${version.resource.enabledStages.length} enabled stages`
                  }
                  getVersion={(version) => version.version}
                  getStatus={(version) => version.status}
                  getCreatedAt={(version) => version.createdAt}
                  onSelect={(version) => setSelectedId(version.id)}
                  actionSlot={(version) =>
                    version.status === 'ACTIVE' ? (
                      <StatusBadge status="ACTIVE" />
                    ) : (
                      <button
                        type="button"
                        className="btn btn-light btn-sm"
                        disabled={activatingId === version.id}
                        onClick={() => void handleActivate(version.id)}
                      >
                        Activate
                      </button>
                    )
                  }
                />
              )}
            </div>
          </div>
        </div>
        <div className="col-xxl-7 d-flex">
          <div className="card flex-fill">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">Selected metadata detail</h5>
              <button className="btn btn-light btn-sm" onClick={useSelectedAsBase}>
                <i className="ti ti-copy me-1"></i>Use as base
              </button>
            </div>
            <div className="card-body">
              {selectedVersion ? (
                <div className="row">
                  <div className="col-xl-5">
                    <div className="react-resource-summary">
                      <h6>{selectedVersion.key}</h6>
                      <p className="text-muted mb-3">
                        Metadata policy v{selectedVersion.version} currently marked as{' '}
                        {selectedVersion.status.toLowerCase()}.
                      </p>
                      <div className="react-chip-list mb-3">
                        {selectedVersion.resource.enabledStages.map((stage) => (
                          <span key={stage} className="badge badge-soft-dark">
                            {stage}
                          </span>
                        ))}
                      </div>
                      <div className="react-meta-list">
                        <div>
                          <span className="react-meta-label">Created at</span>
                          <strong>{formatDateTime(selectedVersion.createdAt)}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Created by</span>
                          <strong>{selectedVersion.createdBy ?? 'system'}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-xl-7">
                    <JsonBlock value={selectedVersion.resource} />
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Select a metadata policy"
                  body="Choose a version to inspect or reuse as the base for a new policy."
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12 d-flex">
          <div className="card flex-fill">
            <div className="card-header">
              <h5 className="mb-0">Create governed metadata policy</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Metadata key</label>
                      <input className="form-control" value={form.key} readOnly />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Activation strategy</label>
                      <div className="react-form-toggle">
                        <label className="checkboxs mb-0">
                          <input
                            type="checkbox"
                            checked={form.activate}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                activate: event.target.checked,
                              }))
                            }
                          />
                          <span className="checkmarks me-2"></span>
                          Publish immediately
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Operator note</label>
                      <input className="form-control" value="admin-ui" readOnly />
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="mb-3">
                      <label className="form-label">Policy JSON</label>
                      <textarea
                        className="form-control react-large-textarea"
                        value={form.jsonText}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            jsonText: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <p className="text-muted mb-0">
                    Metadata policies stay governed and tenant-safe; the frontend only
                    edits versioned JSON over backend boundaries.
                  </p>
                  <button className="btn btn-dark" type="submit" disabled={saving}>
                    <i className="ti ti-device-floppy me-1"></i>
                    {saving ? 'Saving...' : 'Create version'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
