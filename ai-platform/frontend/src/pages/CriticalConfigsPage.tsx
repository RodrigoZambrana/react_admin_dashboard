import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  activateCriticalConfigVersion,
  createCriticalConfigVersion,
  listActiveCriticalConfigs,
  listCriticalConfigVersions,
} from '../api';
import { ResourceVersionTable } from '../components/resources/ResourceVersionTable';
import { EmptyState } from '../components/shared/EmptyState';
import { JsonBlock } from '../components/shared/JsonBlock';
import { PageHeader } from '../components/shared/PageHeader';
import { StatusBadge } from '../components/shared/StatusBadge';
import type {
  AiRuntimeResource,
  AsyncIntakeRuntimeResource,
  CriticalConfigVersion,
  LearningRuntimeResource,
} from '../types';
import { formatDateTime, toPrettyJson } from '../utils';

type CriticalConfigFormState = {
  key: CriticalConfigVersion['key'];
  jsonText: string;
  activate: boolean;
};

function buildDefaultConfigValue(
  key: CriticalConfigVersion['key'],
): AiRuntimeResource | LearningRuntimeResource | AsyncIntakeRuntimeResource {
  if (key === 'ai_runtime') {
    return {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      timeoutMs: 7000,
      credentials: {
        strategy: 'env',
        envKey: 'AI_PROVIDER_API_KEY',
      },
      providerOptions: {},
    };
  }

  if (key === 'async_intake') {
    return {
      stabilization: {
        defaultDelayMs: 900,
        maxWindowMs: 2600,
        fragmentContinuationDelayMs: 1700,
        trailingThoughtDelayMs: 1500,
        shortMessageDelayMs: 1300,
        mediumIncompleteDelayMs: 1000,
        longCompletedDelayMs: 350,
        shortMessageLengthThreshold: 24,
        mediumMessageLengthThreshold: 120,
        longCompletedLengthThreshold: 50,
      },
      replyProjection: {
        minDelayMs: 900,
        maxDelayMs: 2600,
        charDelayMs: 18,
      },
      lexicons: {
        default: {
          leadingTokens: [],
          trailingTokens: [],
          slotPatterns: [],
        },
        es: {
          leadingTokens: ['de', 'con', 'para'],
          trailingTokens: ['de', 'con', 'para'],
          slotPatterns: [],
        },
        en: {
          leadingTokens: ['with', 'for'],
          trailingTokens: ['with', 'for'],
          slotPatterns: [],
        },
      },
    };
  }

  return {
    enabled: true,
    observedStages: ['execution', 'response'],
    minConfidence: 0.6,
    maxBodyLength: 240,
    maxSummaryLength: 180,
    persistEmbeddings: true,
  };
}

function getConfigSecondaryLabel(version: CriticalConfigVersion) {
  if (version.key === 'ai_runtime') {
    return `provider ${(version.value as AiRuntimeResource).provider}`;
  }

  if (version.key === 'async_intake') {
    const value = version.value as AsyncIntakeRuntimeResource;
    return `${Object.keys(value.lexicons ?? {}).length} locale lexicons`;
  }

  return `${(version.value as LearningRuntimeResource).observedStages.length} observed stages`;
}

function buildConfigForm(base?: CriticalConfigVersion): CriticalConfigFormState {
  const key = base?.key ?? 'learning';

  return {
    key,
    jsonText: toPrettyJson(base?.value ?? buildDefaultConfigValue(key)),
    activate: base?.status === 'ACTIVE',
  };
}

export function CriticalConfigsPage() {
  const [versions, setVersions] = useState<CriticalConfigVersion[]>([]);
  const [activeVersions, setActiveVersions] = useState<CriticalConfigVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [form, setForm] = useState<CriticalConfigFormState>(buildConfigForm());
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
        listCriticalConfigVersions(),
        listActiveCriticalConfigs(),
      ]);
      setVersions(versionData);
      setActiveVersions(activeData);
      const nextSelected = nextSelectedId ?? selectedId ?? versionData[0]?.id;
      setSelectedId(nextSelected);
      const nextVersion = versionData.find((version) => version.id === nextSelected);
      if (nextVersion) {
        setForm(buildConfigForm(nextVersion));
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
      const created = await createCriticalConfigVersion({
        key: form.key,
        value: JSON.parse(form.jsonText) as CriticalConfigVersion['value'],
        activate: form.activate,
        createdBy: 'admin-ui',
      });
      setNotice(
        `Critical config ${created.key} v${created.version} stored${created.status === 'ACTIVE' ? ' and activated' : ''}.`,
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
      const activated = await activateCriticalConfigVersion(versionId);
      setNotice(`Critical config ${activated.key} activated as v${activated.version}.`);
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

    setForm(buildConfigForm(selectedVersion));
    setNotice(`Loaded ${selectedVersion.key} v${selectedVersion.version} into the editor.`);
  };

  const handleKeyChange = (key: CriticalConfigVersion['key']) => {
    const matchingActive =
      activeVersions.find((version) => version.key === key) ??
      versions.find((version) => version.key === key);

    setForm({
      key,
      jsonText: toPrettyJson(
        matchingActive?.value ?? buildDefaultConfigValue(key),
      ),
      activate: matchingActive?.status === 'ACTIVE',
    });
  };

  return (
    <>
      <PageHeader
        title="Critical config operations"
        section="Critical configs"
        description="Manage provider runtime configuration and learning policies through governed tenant-scoped versioning."
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
                    <p>Active configs</p>
                    <h5>{loading ? '...' : activeVersions.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-success">Runtime-governed</span>
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
                  <span className="bg-dark">Provider and learning history</span>
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
                    <i className="ti ti-settings-code"></i>
                  </span>
                  <div>
                    <p>Current editor key</p>
                    <h5>{form.key}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-info">Swappable without UI logic forks</span>
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
              <h5 className="mb-0">Config version history</h5>
              <button className="btn btn-dark btn-sm" onClick={() => void refresh()}>
                <i className="ti ti-refresh me-1"></i>Refresh
              </button>
            </div>
            <div className="card-body p-0">
              {versions.length === 0 && !loading ? (
                <div className="p-4">
                  <EmptyState
                    title="No critical configs found"
                    body="Create the first governed config version for AI runtime or learning."
                  />
                </div>
              ) : (
                <ResourceVersionTable
                  versions={versions}
                  selectedId={selectedVersion?.id}
                  getId={(version) => version.id}
                  getPrimaryLabel={(version) => version.key}
                  getSecondaryLabel={getConfigSecondaryLabel}
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
              <h5 className="mb-0">Selected config detail</h5>
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
                        Config v{selectedVersion.version} currently marked as{' '}
                        {selectedVersion.status.toLowerCase()}.
                      </p>
                      <div className="react-meta-list">
                        <div>
                          <span className="react-meta-label">Created by</span>
                          <strong>{selectedVersion.createdBy ?? 'system'}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Created at</span>
                          <strong>{formatDateTime(selectedVersion.createdAt)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-xl-7">
                    <JsonBlock value={selectedVersion.value} />
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Select a config version"
                  body="Choose a version to inspect or reuse as the base for a new governed config."
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
              <h5 className="mb-0">Create governed config version</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Config key</label>
                      <select
                        className="form-select"
                        value={form.key}
                        onChange={(event) =>
                          handleKeyChange(event.target.value as CriticalConfigVersion['key'])
                        }
                      >
                        <option value="ai_runtime">ai_runtime</option>
                        <option value="learning">learning</option>
                        <option value="async_intake">async_intake</option>
                      </select>
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
                      <label className="form-label">Config JSON</label>
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
                    Backend schemas remain the source of truth. The UI only submits
                    governed JSON through validated resource boundaries.
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
