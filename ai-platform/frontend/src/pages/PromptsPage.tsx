import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  activatePromptVersion,
  createPromptVersion,
  listActivePrompts,
  listPromptVersions,
} from '../api';
import { ResourceVersionTable } from '../components/resources/ResourceVersionTable';
import { EmptyState } from '../components/shared/EmptyState';
import { PageHeader } from '../components/shared/PageHeader';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { PromptVersion } from '../types';

const promptKeys = ['interpretation', 'response'] as const;
const promptContractPreview: Record<(typeof promptKeys)[number], string[]> = {
  interpretation: [
    'JSON-only output',
    'Required keys: intent, entities, language, confidence',
    'Allowed intents remain backend-owned',
    'No tool execution or business decisions',
  ],
  response: [
    'Approved backend context remains the source of truth',
    'Return JSON with message/outcome/execution assertions',
    'No invented facts, actions, or continuity state',
    'Guardrails still decide whether AI wording is accepted',
  ],
};

type PromptFormState = {
  key: (typeof promptKeys)[number];
  template: string;
  activate: boolean;
};

function buildPromptForm(base?: PromptVersion): PromptFormState {
  return {
    key: (base?.key as PromptFormState['key']) ?? 'response',
    template: base?.template ?? '',
    activate: base?.status === 'ACTIVE',
  };
}

export function PromptsPage() {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [activeVersions, setActiveVersions] = useState<PromptVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [form, setForm] = useState<PromptFormState>(buildPromptForm());
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
        listPromptVersions(),
        listActivePrompts(),
      ]);
      setVersions(versionData);
      setActiveVersions(activeData);
      const nextSelected =
        nextSelectedId ??
        selectedId ??
        versionData[0]?.id;
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

  const useSelectedAsBase = () => {
    if (!selectedVersion) {
      return;
    }

    setForm(buildPromptForm(selectedVersion));
    setNotice(`Loaded ${selectedVersion.key} v${selectedVersion.version} into the editor.`);
  };

  return (
    <>
      <PageHeader
        title="Prompt operations"
        section="Prompts"
        description="Edit governed editorial policy wording while backend-owned protocol contracts remain fixed in code."
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
                    <p>Active prompts</p>
                    <h5>{loading ? '...' : activeVersions.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-success">Live AI wording</span>
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
                    <i className="ti ti-forms"></i>
                  </span>
                  <div>
                    <p>Prompt keys</p>
                    <h5>{promptKeys.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-info">Interpretation and response</span>
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
            <div className="card-header">
              <h5 className="mb-0">Create governed prompt version</h5>
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
                            key: event.target.value as PromptFormState['key'],
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
                      <input
                        className="form-control"
                        value="admin-ui"
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="alert alert-info custom-react-alert mb-3">
                      Editing the governed policy layer for <strong>{form.key}</strong>.
                      Structural output shape, enums, and protocol assertions remain
                      backend-owned and are not editable here.
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
                      <label className="form-label">Backend-owned protocol preview</label>
                      <div className="react-rich-preview react-large-preview">
                        <ul className="mb-0">
                          {promptContractPreview[form.key].map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <p className="text-muted mb-0">
                    Policy editing stays thin-client only. Structural protocol
                    contracts, validation, versioning, and activation remain
                    backend-governed.
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
