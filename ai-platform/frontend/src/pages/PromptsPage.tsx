import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  activatePromptVersion,
  archivePromptVersion,
  createPromptVersion,
  getRuntimeResourceContext,
  listActivePrompts,
  listEffectivePrompts,
  listPromptVersions,
} from '../api';
import { ResourceVersionTable } from '../components/resources/ResourceVersionTable';
import { EmptyState } from '../components/shared/EmptyState';
import { PageHeader } from '../components/shared/PageHeader';
import { StatusBadge } from '../components/shared/StatusBadge';
import type {
  PromptEffectiveView,
  PromptVersion,
  RuntimeResourceContextView,
} from '../types';

const promptKeys = ['interpretation', 'response'] as const;

type PromptKey = (typeof promptKeys)[number];

type PromptFormState = {
  key: PromptKey;
  template: string;
  activate: boolean;
};

function buildPromptForm(base?: PromptVersion): PromptFormState {
  return {
    key: (base?.key as PromptKey) ?? 'response',
    template: base?.template ?? '',
    activate: base?.status === 'ACTIVE',
  };
}

function getPromptSourceLabel(view: PromptEffectiveView) {
  switch (view.source) {
    case 'managed':
      return `Managed v${view.promptVersion ?? '?'}`;
    case 'recommended_default':
      return 'Recommended default';
    case 'caller_override':
      return 'Caller override';
    default:
      return 'Managed policy';
  }
}

function getPromptAlignment(view: PromptEffectiveView) {
  if (view.source === 'recommended_default') {
    return {
      tone: 'bg-info',
      label: 'Using recommended default',
    };
  }

  if (view.differsFromRecommended) {
    return {
      tone: 'bg-warning',
      label: 'Managed policy differs from recommended baseline',
    };
  }

  return {
    tone: 'bg-success',
    label: 'Managed policy aligned with recommended baseline',
  };
}

function getRuntimeContextLabel(context: RuntimeResourceContextView | null) {
  if (!context) {
    return 'Tenant context unavailable';
  }

  return context.source === 'default_tenant'
    ? 'Backend default tenant'
    : 'Explicit tenant override';
}

export function PromptsPage() {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [activeVersions, setActiveVersions] = useState<PromptVersion[]>([]);
  const [effectiveViews, setEffectiveViews] = useState<PromptEffectiveView[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [form, setForm] = useState<PromptFormState>(buildPromptForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string>();
  const [archivingId, setArchivingId] = useState<string>();
  const [runtimeContext, setRuntimeContext] =
    useState<RuntimeResourceContextView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedId) ?? versions[0],
    [selectedId, versions],
  );
  const selectedKey = (selectedVersion?.key as PromptKey | undefined) ?? form.key;
  const selectedEffectiveView =
    effectiveViews.find((view) => view.key === selectedKey) ?? null;
  const editorEffectiveView =
    effectiveViews.find((view) => view.key === form.key) ?? null;

  const refresh = async (nextSelectedId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const [versionData, activeData, effectiveData, runtimeContextData] =
        await Promise.all([
        listPromptVersions(),
        listActivePrompts(),
        listEffectivePrompts(),
        getRuntimeResourceContext().catch(() => null),
      ]);
      setVersions(versionData);
      setActiveVersions(activeData);
      setEffectiveViews(effectiveData);
      setRuntimeContext(runtimeContextData);
      const nextSelected = nextSelectedId ?? selectedId ?? versionData[0]?.id;
      setSelectedId(nextSelected);
      const nextVersion = versionData.find((version) => version.id === nextSelected);
      if (nextVersion) {
        setForm(buildPromptForm(nextVersion));
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
      const created = await createPromptVersion({
        key: form.key,
        template: form.template,
        activate: form.activate,
        createdBy: 'admin-ui',
      });
      setNotice(
        `Prompt ${created.key} v${created.version} stored${created.status === 'ACTIVE' ? ' and activated' : ''}.`,
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
      const activated = await activatePromptVersion(versionId);
      setNotice(`Prompt ${activated.key} activated as v${activated.version}.`);
      await refresh(activated.id);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setActivatingId(undefined);
    }
  };

  const handleArchive = async (versionId: string) => {
    try {
      setArchivingId(versionId);
      setError(null);
      setNotice(null);
      const archived = await archivePromptVersion(versionId);
      setNotice(`Prompt ${archived.key} v${archived.version} archived.`);
      await refresh(archived.id);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setArchivingId(undefined);
    }
  };

  const useSelectedAsBase = () => {
    if (!selectedVersion) {
      return;
    }

    setForm(buildPromptForm(selectedVersion));
    setNotice(`Loaded ${selectedVersion.key} v${selectedVersion.version} into the editor.`);
  };

  const loadRecommendedPolicy = () => {
    if (!editorEffectiveView) {
      return;
    }

    setForm((current) => ({
      ...current,
      key: editorEffectiveView.key,
      template: editorEffectiveView.recommendedPolicy,
    }));
    setNotice(`Loaded the current recommended ${editorEffectiveView.key} policy into the editor.`);
  };

  return (
    <>
      <PageHeader
        title="Prompt operations"
        section="Prompts"
        description="Manage governed prompt policy versions while fixed safety and backend-owned contracts remain visible and non-editable."
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
      <div className="alert alert-info custom-react-alert" role="alert">
        Prompt operations are currently scoped to{' '}
        <strong>{runtimeContext?.tenantId ?? 'the resolved runtime tenant'}</strong>.
        {' '}
        {getRuntimeContextLabel(runtimeContext)}
        {runtimeContext?.defaultTenantId
          ? ` (${runtimeContext.defaultTenantId} is the backend default).`
          : '.'}
      </div>

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
                    <p>Active managed prompts</p>
                    <h5>{loading ? '...' : activeVersions.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-success">Live governed policy</span>
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
                    <p>Total prompt versions</p>
                    <h5>{loading ? '...' : versions.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-dark">Governed version history</span>
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
                    <i className="ti ti-layers-intersect"></i>
                  </span>
                  <div>
                    <p>Effective runtime views</p>
                    <h5>{loading ? '...' : effectiveViews.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-info">Policy + safety + contract</span>
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
              <h5 className="mb-0">Prompt version history</h5>
              <button className="btn btn-dark btn-sm" onClick={() => void refresh()}>
                <i className="ti ti-refresh me-1"></i>Refresh
              </button>
            </div>
            <div className="card-body p-0">
              {versions.length === 0 && !loading ? (
                <div className="p-4">
                  <EmptyState
                    title="No prompt versions found"
                    body="Create the first governed prompt version for this tenant."
                  />
                </div>
              ) : (
                <ResourceVersionTable
                  versions={versions}
                  selectedId={selectedVersion?.id}
                  getId={(version) => version.id}
                  getPrimaryLabel={(version) => version.key}
                  getSecondaryLabel={(version) =>
                    version.template.slice(0, 72).trim()
                      ? `${version.template.slice(0, 72)}...`
                      : 'Empty template'
                  }
                  getVersion={(version) => version.version}
                  getStatus={(version) => version.status}
                  getCreatedAt={(version) => version.createdAt}
                  onSelect={(version) => setSelectedId(version.id)}
                  actionSlot={(version) =>
                    version.status === 'ACTIVE' ? (
                      <StatusBadge status="ACTIVE" />
                    ) : version.status === 'ARCHIVED' ? (
                      <StatusBadge status="ARCHIVED" />
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
              <h5 className="mb-0">Selected prompt</h5>
              <div className="d-flex gap-2">
                <button className="btn btn-light btn-sm" onClick={useSelectedAsBase}>
                  <i className="ti ti-copy me-1"></i>Use as base
                </button>
                {selectedVersion && selectedVersion.status !== 'ARCHIVED' ? (
                  <button
                    className="btn btn-outline-dark btn-sm"
                    disabled={archivingId === selectedVersion.id}
                    onClick={() => void handleArchive(selectedVersion.id)}
                  >
                    <i className="ti ti-archive me-1"></i>
                    {archivingId === selectedVersion.id ? 'Archiving...' : 'Archive'}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="card-body">
              {selectedVersion ? (
                <div className="row g-3">
                  <div className="col-xl-5">
                    <div className="react-resource-summary">
                      <h6>{selectedVersion.key}</h6>
                      <p className="text-muted mb-3">
                        Prompt policy v{selectedVersion.version} currently marked as{' '}
                        {selectedVersion.status.toLowerCase()}.
                      </p>
                      <div className="react-meta-list">
                        <div>
                          <span className="react-meta-label">Created by</span>
                          <strong>{selectedVersion.createdBy ?? 'system'}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Created at</span>
                          <strong>
                            {new Date(selectedVersion.createdAt).toLocaleString()}
                          </strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Lifecycle</span>
                          <strong>{selectedVersion.status}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-xl-7">
                    <div className="react-rich-preview react-large-preview">
                      {selectedVersion.template}
                    </div>
                  </div>
                  {selectedEffectiveView ? (
                    <div className="col-12">
                      <div className="alert alert-info custom-react-alert mb-0">
                        Runtime source for <strong>{selectedEffectiveView.key}</strong>:
                        {' '}
                        {getPromptSourceLabel(selectedEffectiveView)}.
                        {' '}
                        {selectedEffectiveView.differsFromRecommended
                          ? 'The live managed wording differs from the current recommended baseline.'
                          : 'The live wording matches the current recommended baseline.'}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="Select a prompt version"
                  body="Choose a version from the left panel to inspect or reuse it as the base for a new version."
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12 d-flex">
          <div className="card flex-fill">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">Effective runtime view</h5>
              {selectedEffectiveView ? (
                <span className={`badge ${getPromptAlignment(selectedEffectiveView).tone}`}>
                  {getPromptAlignment(selectedEffectiveView).label}
                </span>
              ) : null}
            </div>
            <div className="card-body">
              {selectedEffectiveView ? (
                <div className="row g-3">
                  <div className="col-xl-4">
                    <div className="react-resource-summary h-100">
                      <h6>{selectedEffectiveView.key}</h6>
                      <p className="text-muted mb-3">
                        What the provider effectively receives for this prompt key.
                      </p>
                      <div className="react-meta-list">
                        <div>
                          <span className="react-meta-label">Runtime source</span>
                          <strong>{getPromptSourceLabel(selectedEffectiveView)}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Locale preview</span>
                          <strong>{selectedEffectiveView.localeHint ?? 'unknown'}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Managed author</span>
                          <strong>
                            {selectedEffectiveView.managedPromptCreatedBy ?? 'recommended default'}
                          </strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Managed created at</span>
                          <strong>
                            {selectedEffectiveView.managedPromptCreatedAt
                              ? new Date(selectedEffectiveView.managedPromptCreatedAt).toLocaleString()
                              : 'n/a'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-xl-4">
                    <label className="form-label">Effective governed policy</label>
                    <div className="react-rich-preview react-large-preview">
                      {selectedEffectiveView.effectivePolicy}
                    </div>
                  </div>
                  <div className="col-xl-4">
                    <label className="form-label">Current recommended baseline</label>
                    <div className="react-rich-preview react-large-preview">
                      {selectedEffectiveView.recommendedPolicy}
                    </div>
                  </div>
                  <div className="col-xl-6">
                    <label className="form-label">Fixed safety layer</label>
                    <div className="react-rich-preview react-large-preview">
                      <ul className="mb-0">
                        {selectedEffectiveView.safetyLines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="col-xl-6">
                    <label className="form-label">Backend-owned contract layer</label>
                    <div className="react-rich-preview react-large-preview">
                      <ul className="mb-0">
                        {selectedEffectiveView.contractLines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Assembled system prompt preview</label>
                    <div className="react-rich-preview react-large-preview">
                      {selectedEffectiveView.assembledSystemPrompt}
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No effective prompt view available"
                  body="Refresh the page to load the current policy, safety, and contract layers."
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12 d-flex">
          <div className="card flex-fill">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">Create governed prompt version</h5>
              <button className="btn btn-light btn-sm" type="button" onClick={loadRecommendedPolicy}>
                <i className="ti ti-arrow-back-up me-1"></i>Load recommended baseline
              </button>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Prompt key</label>
                      <select
                        className="form-select"
                        value={form.key}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            key: event.target.value as PromptKey,
                          }))
                        }
                      >
                        {promptKeys.map((key) => (
                          <option key={key} value={key}>
                            {key}
                          </option>
                        ))}
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
                    <div className="alert alert-info custom-react-alert mb-3">
                      Editing only the governed policy layer for <strong>{form.key}</strong>.
                      Fixed safety rules, structural JSON/output contracts, and runtime
                      source selection remain backend-owned and visible above.
                    </div>
                  </div>
                  <div className="col-xl-7">
                    <div className="mb-3">
                      <label className="form-label">Editable policy wording</label>
                      <textarea
                        className="form-control react-large-textarea"
                        value={form.template}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            template: event.target.value,
                          }))
                        }
                        placeholder="Write the governed editorial policy wording here"
                      />
                    </div>
                  </div>
                  <div className="col-xl-5">
                    <div className="mb-3">
                      <label className="form-label">Runtime layer summary</label>
                      <div className="react-rich-preview react-large-preview">
                        {editorEffectiveView ? (
                          <ul className="mb-0">
                            <li>Runtime source: {getPromptSourceLabel(editorEffectiveView)}</li>
                            <li>
                              Alignment:
                              {' '}
                              {getPromptAlignment(editorEffectiveView).label}
                            </li>
                            <li>Fixed safety lines: {editorEffectiveView.safetyLines.length}</li>
                            <li>Fixed contract lines: {editorEffectiveView.contractLines.length}</li>
                          </ul>
                        ) : (
                          'Load an effective prompt view to inspect runtime alignment.'
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <p className="text-muted mb-0">
                    Policy editing stays operator-usable, while fixed safety and backend
                    contracts remain visible so stale managed wording is easy to detect and replace.
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
