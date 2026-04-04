import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  activateDateTimeLocaleVersion,
  createDateTimeLocaleVersion,
  listActiveDateTimeLocales,
  listDateTimeLocaleVersions,
} from '../api';
import { ResourceVersionTable } from '../components/resources/ResourceVersionTable';
import { EmptyState } from '../components/shared/EmptyState';
import { JsonBlock } from '../components/shared/JsonBlock';
import { PageHeader } from '../components/shared/PageHeader';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { TemporalLocaleVersion } from '../types';

type LocaleFormState = {
  locale: string;
  datePhrasesText: string;
  timeJoinersText: string;
  activate: boolean;
};

function listToLines(values: string[]) {
  return values.join('\n');
}

function linesToList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildLocaleForm(base?: TemporalLocaleVersion): LocaleFormState {
  return {
    locale: base?.locale ?? 'es',
    datePhrasesText: base ? listToLines(base.resource.datePhrases) : '',
    timeJoinersText: base ? listToLines(base.resource.timeJoiners) : '',
    activate: base?.status === 'ACTIVE',
  };
}

export function DateTimeLocaleResourcesPage() {
  const [versions, setVersions] = useState<TemporalLocaleVersion[]>([]);
  const [activeVersions, setActiveVersions] = useState<TemporalLocaleVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [form, setForm] = useState<LocaleFormState>(buildLocaleForm());
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
        listDateTimeLocaleVersions(),
        listActiveDateTimeLocales(),
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
        setForm(buildLocaleForm(nextVersion));
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
      const created = await createDateTimeLocaleVersion({
        locale: form.locale,
        resource: {
          locale: form.locale.trim().toLowerCase(),
          datePhrases: linesToList(form.datePhrasesText),
          timeJoiners: linesToList(form.timeJoinersText),
        },
        activate: form.activate,
        createdBy: 'admin-ui',
      });
      setNotice(
        `Locale ${created.locale} v${created.version} stored${created.status === 'ACTIVE' ? ' and activated' : ''}.`,
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
      const activated = await activateDateTimeLocaleVersion(versionId);
      setNotice(`Locale ${activated.locale} activated as v${activated.version}.`);
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

    setForm(buildLocaleForm(selectedVersion));
    setNotice(
      `Loaded locale ${selectedVersion.locale} v${selectedVersion.version} into the editor.`,
    );
  };

  return (
    <>
      <PageHeader
        title="Date-time locale resources"
        section="Date-time locale resources"
        description="Operate multilingual date and time catalogs through backend-governed locale resources, not parser-local lexicons."
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
                    <i className="ti ti-language"></i>
                  </span>
                  <div>
                    <p>Active locale catalogs</p>
                    <h5>{loading ? '...' : activeVersions.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-success">Published in parsing</span>
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
                    <p>Total locale versions</p>
                    <h5>{loading ? '...' : versions.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-dark">Tenant-scoped catalogs</span>
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
                    <i className="ti ti-calendar-time"></i>
                  </span>
                  <div>
                    <p>Selected locale</p>
                    <h5>{selectedVersion?.locale ?? 'n/a'}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-info">
                    {selectedVersion
                      ? `${selectedVersion.resource.datePhrases.length} phrases`
                      : 'Awaiting selection'}
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
              <h5 className="mb-0">Locale version history</h5>
              <button className="btn btn-dark btn-sm" onClick={() => void refresh()}>
                <i className="ti ti-refresh me-1"></i>Refresh
              </button>
            </div>
            <div className="card-body p-0">
              {versions.length === 0 && !loading ? (
                <div className="p-4">
                  <EmptyState
                    title="No locale resources found"
                    body="Create the first date-time locale resource for this tenant."
                  />
                </div>
              ) : (
                <ResourceVersionTable
                  versions={versions}
                  selectedId={selectedVersion?.id}
                  getId={(version) => version.id}
                  getPrimaryLabel={(version) => version.locale}
                  getSecondaryLabel={(version) =>
                    `${version.resource.datePhrases.length} phrases · ${version.resource.timeJoiners.length} joiners`
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
              <h5 className="mb-0">Selected locale detail</h5>
              <button className="btn btn-light btn-sm" onClick={useSelectedAsBase}>
                <i className="ti ti-copy me-1"></i>Use as base
              </button>
            </div>
            <div className="card-body">
              {selectedVersion ? (
                <div className="row">
                  <div className="col-xl-5">
                    <div className="react-resource-summary">
                      <h6>{selectedVersion.locale}</h6>
                      <p className="text-muted mb-3">
                        Locale catalog v{selectedVersion.version} currently marked as{' '}
                        {selectedVersion.status.toLowerCase()}.
                      </p>
                      <div className="react-chip-list mb-3">
                        {selectedVersion.resource.datePhrases.map((phrase) => (
                          <span key={phrase} className="badge badge-soft-info">
                            {phrase}
                          </span>
                        ))}
                      </div>
                      <div className="react-meta-list">
                        <div>
                          <span className="react-meta-label">Joiners</span>
                          <strong>
                            {selectedVersion.resource.timeJoiners.join(', ') || 'None'}
                          </strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Created at</span>
                          <strong>
                            {new Date(selectedVersion.createdAt).toLocaleString()}
                          </strong>
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
                  title="Select a locale catalog"
                  body="Choose a version from the left panel to inspect or reuse it as the base for a new locale catalog."
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
              <h5 className="mb-0">Create date-time locale version</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Locale code</label>
                      <input
                        className="form-control"
                        value={form.locale}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            locale: event.target.value,
                          }))
                        }
                        placeholder="es"
                      />
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
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Date phrases</label>
                      <textarea
                        className="form-control react-medium-textarea"
                        value={form.datePhrasesText}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            datePhrasesText: event.target.value,
                          }))
                        }
                        placeholder={'mañana\npasado mañana'}
                      />
                      <small className="text-muted">
                        One phrase per line.
                      </small>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Time joiners</label>
                      <textarea
                        className="form-control react-medium-textarea"
                        value={form.timeJoinersText}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            timeJoinersText: event.target.value,
                          }))
                        }
                        placeholder={'a las\nsobre'}
                      />
                      <small className="text-muted">
                        One joiner per line.
                      </small>
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <p className="text-muted mb-0">
                    Locale resources stay backend-owned. The UI only submits governed
                    locale catalogs through validated admin surfaces.
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
