import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  activateCriticalConfigVersion,
  createCriticalConfigVersion,
  getAiRuntimeDiagnostics,
  listActiveCriticalConfigs,
  listCriticalConfigVersions,
} from '../api';
import { ResourceVersionTable } from '../components/resources/ResourceVersionTable';
import { EmptyState } from '../components/shared/EmptyState';
import { JsonBlock } from '../components/shared/JsonBlock';
import { PageHeader } from '../components/shared/PageHeader';
import { StatusBadge } from '../components/shared/StatusBadge';
import type {
  AiRuntimeDiagnostics,
  AiRuntimeResource,
  AsyncIntakeRuntimeResource,
  CriticalConfigVersion,
  LearningRuntimeResource,
  TenantCapabilitiesResource,
} from '../types';
import { formatDateTime, toPrettyJson } from '../utils';

type CriticalConfigFormState = {
  key: CriticalConfigVersion['key'];
  jsonText: string;
  activate: boolean;
  aiRuntimeDraft: AiRuntimeResource;
};

function buildDefaultConfigValue(
  key: CriticalConfigVersion['key'],
):
  | AiRuntimeResource
  | LearningRuntimeResource
  | AsyncIntakeRuntimeResource
  | TenantCapabilitiesResource
  | Record<string, unknown> {
  if (key === 'ai_runtime') {
    return {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      timeoutMs: 7000,
      credentials: {
        strategy: 'env',
        envKey: 'OPENAI_API_KEY',
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

  if (key === 'tenant_capabilities') {
    return {
      capabilities: [
        {
          key: 'booking',
          enabled: true,
          description: 'Tenant-owned scheduling and appointment workflow.',
          intents: ['CREATE_BOOKING'],
          tools: ['create_booking'],
          config: {},
        },
        {
          key: 'quote',
          enabled: true,
          description: 'Tenant-owned quote and estimation workflow.',
          intents: ['CREATE_QUOTE'],
          tools: ['create_quote'],
          config: {},
        },
        {
          key: 'product_catalog_lookup',
          enabled: true,
          description: 'Tenant-owned product or catalog lookup workflow.',
          intents: ['GET_PRODUCT'],
          tools: ['get_product'],
          config: {},
        },
        {
          key: 'support_post_sale',
          enabled: true,
          description: 'Tenant-owned support and post-sale workflow boundary.',
          intents: ['GENERAL_CONVERSATION', 'CLARIFICATION'],
          tools: [],
          config: {},
        },
      ],
    };
  }

  if (key === 'channel_control') {
    return {
      meta: {},
      whatsappQr: {},
      email: {},
      webchat: {},
      routing: {},
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

  if (version.key === 'tenant_capabilities') {
    const value = version.value as TenantCapabilitiesResource;
    return `${value.capabilities.filter((capability) => capability.enabled).length} enabled capabilities`;
  }

  if (version.key === 'channel_control') {
    return 'channel control resource';
  }

  return `${((version.value as LearningRuntimeResource).observedStages ?? []).length} observed stages`;
}

function buildConfigForm(base?: CriticalConfigVersion): CriticalConfigFormState {
  const key = base?.key ?? 'ai_runtime';
  const baseValue = base?.value ?? buildDefaultConfigValue(key);

  return {
    key,
    jsonText: toPrettyJson(baseValue),
    activate: base?.status === 'ACTIVE',
    aiRuntimeDraft:
      key === 'ai_runtime'
        ? (baseValue as AiRuntimeResource)
        : (buildDefaultConfigValue('ai_runtime') as AiRuntimeResource),
  };
}

export function CriticalConfigsPage() {
  const [versions, setVersions] = useState<CriticalConfigVersion[]>([]);
  const [activeVersions, setActiveVersions] = useState<CriticalConfigVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [form, setForm] = useState<CriticalConfigFormState>(buildConfigForm());
  const [aiRuntimeDiagnostics, setAiRuntimeDiagnostics] =
    useState<AiRuntimeDiagnostics | null>(null);
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
      const [versionData, activeData, diagnostics] = await Promise.all([
        listCriticalConfigVersions(),
        listActiveCriticalConfigs(),
        getAiRuntimeDiagnostics(),
      ]);
      setVersions(versionData);
      setActiveVersions(activeData);
      setAiRuntimeDiagnostics(diagnostics);
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
      const value =
        form.key === 'ai_runtime'
          ? form.aiRuntimeDraft
          : (JSON.parse(form.jsonText) as CriticalConfigVersion['value']);
      const created = await createCriticalConfigVersion({
        key: form.key,
        value,
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
      aiRuntimeDraft:
        key === 'ai_runtime'
          ? ((matchingActive?.value ??
              buildDefaultConfigValue('ai_runtime')) as AiRuntimeResource)
          : form.aiRuntimeDraft,
    });
  };

  const updateAiRuntimeDraft = (patch: Partial<AiRuntimeResource>) => {
    setForm((current) => ({
      ...current,
      aiRuntimeDraft: {
        ...current.aiRuntimeDraft,
        ...patch,
      },
    }));
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
        <div className="col-md-12 col-xl-4 d-flex">
          <div className="card total-users flex-fill">
            <div className="card-body">
              <div className="total-counts">
                <div className="d-flex align-items-center">
                  <span className="bg-warning total-count-icons">
                    <i className="ti ti-plug-connected"></i>
                  </span>
                  <div>
                    <p>AI runtime status</p>
                    <h5>{loading ? '...' : aiRuntimeDiagnostics?.status ?? 'unknown'}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-warning">
                    {aiRuntimeDiagnostics?.exploratoryReady
                      ? `${aiRuntimeDiagnostics.provider} ready`
                      : aiRuntimeDiagnostics?.issues[0]?.message ??
                        'Diagnostics pending'}
                  </span>
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
                        {selectedVersion.key === 'ai_runtime' && aiRuntimeDiagnostics ? (
                          <div>
                            <span className="react-meta-label">Runtime diagnostics</span>
                            <strong>{aiRuntimeDiagnostics.status}</strong>
                          </div>
                        ) : null}
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
                        <option value="tenant_capabilities">tenant_capabilities</option>
                        <option value="channel_control">channel_control</option>
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
                  {form.key === 'ai_runtime' ? (
                    <>
                      <div className="col-md-4">
                        <div className="mb-3">
                          <label className="form-label">Provider</label>
                          <input
                            className="form-control"
                            value={form.aiRuntimeDraft.provider}
                            onChange={(event) =>
                              updateAiRuntimeDraft({ provider: event.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="mb-3">
                          <label className="form-label">Model</label>
                          <input
                            className="form-control"
                            value={form.aiRuntimeDraft.model}
                            onChange={(event) =>
                              updateAiRuntimeDraft({ model: event.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="mb-3">
                          <label className="form-label">Timeout (ms)</label>
                          <input
                            className="form-control"
                            type="number"
                            min={1}
                            value={form.aiRuntimeDraft.timeoutMs}
                            onChange={(event) =>
                              updateAiRuntimeDraft({
                                timeoutMs: Number(event.target.value || 0),
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="mb-3">
                          <label className="form-label">Credential strategy</label>
                          <select
                            className="form-select"
                            value={form.aiRuntimeDraft.credentials.strategy}
                            onChange={(event) =>
                              updateAiRuntimeDraft({
                                credentials: {
                                  strategy: event.target.value as 'none' | 'env',
                                  envKey:
                                    event.target.value === 'env'
                                      ? form.aiRuntimeDraft.credentials.envKey ??
                                        'OPENAI_API_KEY'
                                      : null,
                                },
                              })
                            }
                          >
                            <option value="env">env</option>
                            <option value="none">none</option>
                          </select>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="mb-3">
                          <label className="form-label">Credential env key</label>
                          <input
                            className="form-control"
                            value={form.aiRuntimeDraft.credentials.envKey ?? ''}
                            onChange={(event) =>
                              updateAiRuntimeDraft({
                                credentials: {
                                  ...form.aiRuntimeDraft.credentials,
                                  envKey: event.target.value || null,
                                },
                              })
                            }
                            disabled={form.aiRuntimeDraft.credentials.strategy === 'none'}
                          />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="mb-3">
                          <label className="form-label">Base URL</label>
                          <input
                            className="form-control"
                            value={
                              typeof form.aiRuntimeDraft.providerOptions.baseUrl ===
                              'string'
                                ? form.aiRuntimeDraft.providerOptions.baseUrl
                                : ''
                            }
                            onChange={(event) =>
                              updateAiRuntimeDraft({
                                providerOptions: {
                                  ...form.aiRuntimeDraft.providerOptions,
                                  baseUrl: event.target.value || undefined,
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="alert alert-info custom-react-alert mb-3">
                          Active runtime status: {aiRuntimeDiagnostics?.status ?? 'unknown'}.
                          {' '}Exploratory mode:{' '}
                          {aiRuntimeDiagnostics?.exploratoryReady ? 'ready' : 'not ready'}.
                          {' '}Configured env key:{' '}
                          {form.aiRuntimeDraft.credentials.envKey ?? 'OPENAI_API_KEY'}.
                        </div>
                      </div>
                    </>
                  ) : (
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
                  )}
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
