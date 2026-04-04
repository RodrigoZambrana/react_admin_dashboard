import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  activateResponseFallbackVersion,
  createResponseFallbackVersion,
  listActiveResponseFallbacks,
  listResponseFallbackVersions,
} from '../api';
import { ResourceVersionTable } from '../components/resources/ResourceVersionTable';
import { EmptyState } from '../components/shared/EmptyState';
import { JsonBlock } from '../components/shared/JsonBlock';
import { PageHeader } from '../components/shared/PageHeader';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { ResponseFallbackCatalog, ResponseFallbackVersion } from '../types';
import { formatDateTime, toPrettyJson } from '../utils';

type ResponseFallbackFormState = {
  locale: string;
  jsonText: string;
  activate: boolean;
};

function buildDefaultFallbackCatalog(locale = 'es'): ResponseFallbackCatalog {
  return {
    locale,
    templates: {
      basic_response: 'Entiendo. Como puedo ayudarte?',
      clarification_requested_date: 'Necesito una fecha para continuar.',
      clarification_user_goal: 'Que necesitas resolver?',
      clarification_generic: 'Puedes darme un poco mas de contexto?',
      execution_success_booking: 'La reserva fue creada para {{scheduledFor}}.',
      execution_success_quote: 'La cotizacion fue creada con total {{amount}} {{currency}}.',
      execution_success_product: 'Encontre {{productName}} para tu consulta.',
      execution_success_generic: 'La solicitud aprobada fue procesada.',
      execution_failure_unknown_tool: 'No pude ejecutar la accion solicitada.',
      execution_failure_validation: 'Faltan datos aprobados para completar la solicitud.',
      execution_failure_generic: 'No pude completar la solicitud aprobada.',
    },
    actionLabels: {
      create_booking: 'reserva',
      create_quote: 'cotizacion',
      get_product: 'producto',
      default: 'solicitud',
    },
    defaults: {
      scheduledFor: 'la fecha solicitada',
      currency: 'USD',
      amount: '0.00',
      productName: 'producto solicitado',
    },
  };
}

function buildFallbackForm(base?: ResponseFallbackVersion): ResponseFallbackFormState {
  return {
    locale: base?.locale ?? 'es',
    jsonText: toPrettyJson(
      base?.resource ?? buildDefaultFallbackCatalog(base?.locale ?? 'es'),
    ),
    activate: base?.status === 'ACTIVE',
  };
}

export function ResponseFallbackCatalogsPage() {
  const [versions, setVersions] = useState<ResponseFallbackVersion[]>([]);
  const [activeVersions, setActiveVersions] = useState<ResponseFallbackVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [form, setForm] = useState<ResponseFallbackFormState>(buildFallbackForm());
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
        listResponseFallbackVersions(),
        listActiveResponseFallbacks(),
      ]);
      setVersions(versionData);
      setActiveVersions(activeData);
      const nextSelected = nextSelectedId ?? selectedId ?? versionData[0]?.id;
      setSelectedId(nextSelected);
      const nextVersion = versionData.find((version) => version.id === nextSelected);
      if (nextVersion) {
        setForm(buildFallbackForm(nextVersion));
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
      const resource = JSON.parse(form.jsonText) as ResponseFallbackCatalog;
      const created = await createResponseFallbackVersion({
        locale: form.locale,
        resource,
        activate: form.activate,
        createdBy: 'admin-ui',
      });
      setNotice(
        `Fallback catalog ${created.locale} v${created.version} stored${created.status === 'ACTIVE' ? ' and activated' : ''}.`,
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
      const activated = await activateResponseFallbackVersion(versionId);
      setNotice(`Fallback catalog ${activated.locale} activated as v${activated.version}.`);
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

    setForm(buildFallbackForm(selectedVersion));
    setNotice(
      `Loaded fallback catalog ${selectedVersion.locale} v${selectedVersion.version} into the editor.`,
    );
  };

  return (
    <>
      <PageHeader
        title="Response fallback catalogs"
        section="Response fallback catalogs"
        description="Operate deterministic fallback copy through governed locale catalogs instead of inline backend wording."
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
                    <i className="ti ti-language-hiragana"></i>
                  </span>
                  <div>
                    <p>Active catalogs</p>
                    <h5>{loading ? '...' : activeVersions.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-success">Deterministic safety net</span>
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
                  <span className="bg-dark">Locale-aware fallback history</span>
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
                    <i className="ti ti-template"></i>
                  </span>
                  <div>
                    <p>Selected templates</p>
                    <h5>
                      {selectedVersion
                        ? Object.keys(selectedVersion.resource.templates).length
                        : 'n/a'}
                    </h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-info">Grounded fallback coverage</span>
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
              <h5 className="mb-0">Fallback version history</h5>
              <button className="btn btn-dark btn-sm" onClick={() => void refresh()}>
                <i className="ti ti-refresh me-1"></i>Refresh
              </button>
            </div>
            <div className="card-body p-0">
              {versions.length === 0 && !loading ? (
                <div className="p-4">
                  <EmptyState
                    title="No fallback catalogs found"
                    body="Create the first governed fallback catalog for this tenant."
                  />
                </div>
              ) : (
                <ResourceVersionTable
                  versions={versions}
                  selectedId={selectedVersion?.id}
                  getId={(version) => version.id}
                  getPrimaryLabel={(version) => version.locale}
                  getSecondaryLabel={(version) =>
                    `${Object.keys(version.resource.templates).length} templates`
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
              <h5 className="mb-0">Selected fallback detail</h5>
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
                        Fallback catalog v{selectedVersion.version} currently marked as{' '}
                        {selectedVersion.status.toLowerCase()}.
                      </p>
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
                  title="Select a fallback catalog"
                  body="Choose a version to inspect or reuse as the base for a new fallback catalog."
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
              <h5 className="mb-0">Create governed fallback catalog</h5>
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
                  <div className="col-12">
                    <div className="mb-3">
                      <label className="form-label">Catalog JSON</label>
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
                    Deterministic fallback copy is now governed like any other runtime
                    resource family.
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
