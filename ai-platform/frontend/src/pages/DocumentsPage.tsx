import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  activateDocument,
  archiveDocument,
  createTextDocument,
  getDocument,
  getDocumentKnowledgeView,
  ingestDocument,
  listDocuments,
  uploadDocument,
} from '../api';
import { EmptyState } from '../components/shared/EmptyState';
import { JsonBlock } from '../components/shared/JsonBlock';
import { PageHeader } from '../components/shared/PageHeader';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { DocumentKnowledgeView, DocumentRecord } from '../types';
import { formatDateTime } from '../utils';

const documentStatuses = ['ALL', 'ACTIVE', 'DRAFT', 'ARCHIVED'] as const;
const ingestionStatuses = ['ALL', 'READY', 'PENDING', 'PROCESSING', 'FAILED'] as const;

type TextDocumentForm = {
  title: string;
  content: string;
  language: string;
  activate: boolean;
};

const initialTextForm: TextDocumentForm = {
  title: '',
  content: '',
  language: 'es',
  activate: true,
};

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [activeKnowledgeView, setActiveKnowledgeView] =
    useState<DocumentKnowledgeView | null>(null);
  const [selectedKnowledgeView, setSelectedKnowledgeView] =
    useState<DocumentKnowledgeView | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<(typeof documentStatuses)[number]>('ALL');
  const [ingestionFilter, setIngestionFilter] =
    useState<(typeof ingestionStatuses)[number]>('ALL');
  const [textForm, setTextForm] = useState<TextDocumentForm>(initialTextForm);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadLanguage, setUploadLanguage] = useState('es');
  const [uploadActivate, setUploadActivate] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionDocumentId, setActionDocumentId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [statusFilter, ingestionFilter]);

  const summary = useMemo(() => {
    const activeReady = documents.filter(
      (document) =>
        document.status === 'ACTIVE' && document.ingestionStatus === 'READY',
    ).length;
    const failed = documents.filter(
      (document) => document.ingestionStatus === 'FAILED',
    ).length;

    return {
      activeReady,
      failed,
    };
  }, [documents]);

  const refresh = async (nextSelectedId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const inventoryPromise = listDocuments({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        ingestionStatus:
          ingestionFilter === 'ALL' ? undefined : ingestionFilter,
        limit: 60,
      });
      const activeKnowledgePromise = getDocumentKnowledgeView();
      const inventory = await inventoryPromise;
      setDocuments(inventory);
      const selected =
        nextSelectedId ??
        (inventory.some((document) => document.id === selectedId)
          ? selectedId
          : inventory[0]?.id);
      setSelectedId(selected);

      const [activeKnowledge, selectedDetail, selectedKnowledge] = await Promise.all([
        activeKnowledgePromise,
        selected ? getDocument(selected) : Promise.resolve(null),
        selected
          ? getDocumentKnowledgeView({
              documentId: selected,
            })
          : Promise.resolve(null),
      ]);
      setActiveKnowledgeView(activeKnowledge);

      if (selected) {
        setSelectedDocument(selectedDetail);
        setSelectedKnowledgeView(selectedKnowledge);
      } else {
        setSelectedDocument(null);
        setSelectedKnowledgeView(null);
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (documentId: string) => {
    try {
      setSelectedId(documentId);
      const [document, knowledgeView] = await Promise.all([
        getDocument(documentId),
        getDocumentKnowledgeView({
          documentId,
        }),
      ]);
      setSelectedDocument(document);
      setSelectedKnowledgeView(knowledgeView);
      setError(null);
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  const handleCreateTextDocument = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const created = await createTextDocument({
        title: textForm.title,
        content: textForm.content,
        language: textForm.language,
        activate: textForm.activate,
        createdBy: 'admin-ui',
      });
      setNotice(
        `Document "${created.title}" saved with ${created.ingestionStatus.toLowerCase()} ingestion status.`,
      );
      setTextForm(initialTextForm);
      await refresh(created.id);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDocument = async (event: FormEvent) => {
    event.preventDefault();

    if (!uploadFile) {
      setError('Select a document file to upload.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const created = await uploadDocument({
        file: uploadFile,
        title: uploadTitle || undefined,
        language: uploadLanguage,
        activate: uploadActivate,
        createdBy: 'admin-ui',
      });
      setNotice(
        `Uploaded document "${created.title}" processed as ${created.ingestionStatus.toLowerCase()}.`,
      );
      setUploadTitle('');
      setUploadLanguage('es');
      setUploadActivate(true);
      setUploadFile(null);
      await refresh(created.id);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleLifecycleAction = async (
    documentId: string,
    action: 'ingest' | 'activate' | 'archive',
  ) => {
    try {
      setActionDocumentId(documentId);
      setError(null);
      setNotice(null);

      const updated =
        action === 'ingest'
          ? await ingestDocument(documentId, {
              activate: true,
              createdBy: 'admin-ui',
            })
          : action === 'activate'
            ? await activateDocument(documentId)
            : await archiveDocument(documentId);

      setNotice(
        `Document "${updated.title}" is now ${updated.status.toLowerCase()} with ingestion ${updated.ingestionStatus.toLowerCase()}.`,
      );
      await refresh(updated.id);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setActionDocumentId(undefined);
    }
  };

  return (
    <>
      <PageHeader
        title="Document operations"
        section="Document-origin knowledge corpus"
        description="Manage uploaded documents, inspect ingestion status, and keep document-origin knowledge clearly separate from runtime-learned chat knowledge."
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
        <div className="col-md-6 col-xl-3 d-flex">
          <div className="card total-users flex-fill">
            <div className="card-body">
              <div className="total-counts">
                <div className="d-flex align-items-center">
                  <span className="bg-success total-count-icons">
                    <i className="ti ti-file-search"></i>
                  </span>
                  <div>
                    <p>Documents</p>
                    <h5>{loading ? '...' : documents.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-success">Document-origin corpus</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-xl-3 d-flex">
          <div className="card total-users flex-fill">
            <div className="card-body">
              <div className="total-counts">
                <div className="d-flex align-items-center">
                  <span className="bg-info total-count-icons">
                    <i className="ti ti-clipboard-check"></i>
                  </span>
                  <div>
                    <p>Active and ready</p>
                    <h5>{loading ? '...' : summary.activeReady}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-info">Retrieval-eligible</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-xl-3 d-flex">
          <div className="card total-users flex-fill">
            <div className="card-body">
              <div className="total-counts">
                <div className="d-flex align-items-center">
                  <span className="bg-danger total-count-icons">
                    <i className="ti ti-alert-circle"></i>
                  </span>
                  <div>
                    <p>Failed ingestion</p>
                    <h5>{loading ? '...' : summary.failed}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-danger">Operator attention</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-xl-3 d-flex">
          <div className="card total-users flex-fill">
            <div className="card-body">
              <div className="total-counts">
                <div className="d-flex align-items-center">
                  <span className="bg-dark total-count-icons">
                    <i className="ti ti-arrows-split-2"></i>
                  </span>
                  <div>
                    <p>Knowledge separation</p>
                    <h5>Live</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-dark">Docs != learned chat patterns</span>
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
              <h5 className="mb-0">Document inventory</h5>
              <div className="d-flex align-items-center gap-2">
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as (typeof documentStatuses)[number],
                    )
                  }
                >
                  {documentStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status === 'ALL' ? 'All lifecycle states' : status}
                    </option>
                  ))}
                </select>
                <select
                  className="form-select"
                  value={ingestionFilter}
                  onChange={(event) =>
                    setIngestionFilter(
                      event.target.value as (typeof ingestionStatuses)[number],
                    )
                  }
                >
                  {ingestionStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status === 'ALL' ? 'All ingestion states' : status}
                    </option>
                  ))}
                </select>
                <button className="btn btn-dark btn-sm" onClick={() => void refresh()}>
                  <i className="ti ti-refresh me-1"></i>Refresh
                </button>
              </div>
            </div>
            <div className="card-body p-0">
              {documents.length === 0 && !loading ? (
                <div className="p-4">
                  <EmptyState
                    title="No documents found"
                    body="Create or upload a document to make it available for document-origin retrieval."
                  />
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table datanew react-resource-table mb-0">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Lifecycle</th>
                        <th>Ingestion</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((document) => (
                        <tr
                          key={document.id}
                          className={
                            selectedId === document.id ? 'react-row-selected' : undefined
                          }
                        >
                          <td>
                            <button
                              type="button"
                              className="btn btn-link react-row-button p-0"
                              onClick={() => void handleSelect(document.id)}
                            >
                              <span className="d-block fw-semibold">{document.title}</span>
                              <span className="text-muted fs-12">
                                {document.summary?.slice(0, 72) || document.sourceName || 'No summary yet'}
                              </span>
                            </button>
                          </td>
                          <td>
                            <StatusBadge status={document.status} />
                          </td>
                          <td>
                            <span className="badge badge-soft-secondary">
                              {document.ingestionStatus}
                            </span>
                          </td>
                          <td>{formatDateTime(document.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-xxl-7 d-flex">
          <div className="card flex-fill">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">Document detail</h5>
              <div className="d-flex gap-2">
                {selectedDocument ? (
                  <>
                    <button
                      className="btn btn-light btn-sm"
                      disabled={actionDocumentId === selectedDocument.id}
                      onClick={() =>
                        void handleLifecycleAction(selectedDocument.id, 'ingest')
                      }
                    >
                      Re-ingest
                    </button>
                    {selectedDocument.status !== 'ACTIVE' &&
                    selectedDocument.ingestionStatus === 'READY' ? (
                      <button
                        className="btn btn-dark btn-sm"
                        disabled={actionDocumentId === selectedDocument.id}
                        onClick={() =>
                          void handleLifecycleAction(selectedDocument.id, 'activate')
                        }
                      >
                        Activate
                      </button>
                    ) : null}
                    {selectedDocument.status !== 'ARCHIVED' ? (
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        disabled={actionDocumentId === selectedDocument.id}
                        onClick={() =>
                          void handleLifecycleAction(selectedDocument.id, 'archive')
                        }
                      >
                        Archive
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
            <div className="card-body">
              {selectedDocument ? (
                <div className="row">
                  <div className="col-xl-5">
                    <div className="react-resource-summary">
                      <h6>{selectedDocument.title}</h6>
                      <p className="text-muted mb-3">
                        {selectedDocument.summary || 'This document has not produced a summary yet.'}
                      </p>
                      <div className="react-meta-list">
                        <div>
                          <span className="react-meta-label">Origin</span>
                          <strong>{selectedDocument.originKind}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Lifecycle</span>
                          <strong>{selectedDocument.status}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Ingestion</span>
                          <strong>{selectedDocument.ingestionStatus}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Chunks</span>
                          <strong>{selectedDocument.chunkCount}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Source name</span>
                          <strong>{selectedDocument.sourceName ?? 'Inline text'}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Last ingested</span>
                          <strong>
                            {selectedDocument.lastIngestedAt
                              ? formatDateTime(selectedDocument.lastIngestedAt)
                              : 'n/a'}
                          </strong>
                        </div>
                      </div>
                      {selectedDocument.lastError ? (
                        <div className="alert alert-danger custom-react-alert mt-3" role="alert">
                          {selectedDocument.lastError}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="col-xl-7">
                    <div className="react-rich-preview react-large-preview mb-3">
                      {selectedDocument.sourceText}
                    </div>
                    {selectedDocument.chunks.length > 0 ? (
                      <div className="react-meta-list">
                        {selectedDocument.chunks.slice(0, 3).map((chunk) => (
                          <div key={chunk.id}>
                            <span className="react-meta-label">
                              Chunk {chunk.sequence + 1}
                            </span>
                            <strong>{chunk.content.slice(0, 180)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {selectedDocument.metadata ? (
                      <div className="mt-3">
                        <JsonBlock value={selectedDocument.metadata} />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Select a document"
                  body="Choose a document to inspect its source content, ingestion outcome, and retrieval-ready chunks."
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xxl-5 d-flex">
          <div className="card flex-fill">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">What the system knows right now</h5>
              <span className="badge badge-soft-secondary">
                {activeKnowledgeView?.counts.documentCount ?? 0} active docs
              </span>
            </div>
            <div className="card-body">
              {activeKnowledgeView ? (
                <>
                  {activeKnowledgeView.overviewLines.length > 0 ? (
                    <div className="react-meta-list mb-3">
                      {activeKnowledgeView.overviewLines.map((line) => (
                        <div key={line}>
                          <span className="react-meta-label">Grounded summary</span>
                          <strong>{line}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No extracted knowledge yet"
                      body="Active ready documents have not produced claim-level knowledge yet."
                    />
                  )}
                  {activeKnowledgeView.support.supportedAxes.length > 0 ? (
                    <div className="mb-3">
                      <span className="react-meta-label d-block mb-2">
                        Supported axes
                      </span>
                      <div className="d-flex flex-wrap gap-2">
                        {activeKnowledgeView.support.supportedAxes.map((axis) => (
                          <span key={axis} className="badge badge-soft-info">
                            {formatAxisLabel(axis)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {activeKnowledgeView.support.unspecifiedAxes.length > 0 ? (
                    <div>
                      <span className="react-meta-label d-block mb-2">
                        Still unspecified
                      </span>
                      <div className="d-flex flex-wrap gap-2">
                        {activeKnowledgeView.support.unspecifiedAxes.map((axis) => (
                          <span key={axis} className="badge badge-soft-warning">
                            {formatAxisLabel(axis)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  title="Loading knowledge view"
                  body="The active document corpus knowledge summary will appear here."
                />
              )}
            </div>
          </div>
        </div>

        <div className="col-xxl-7 d-flex">
          <div className="card flex-fill">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">Extracted knowledge for selected document</h5>
              {selectedKnowledgeView ? (
                <span className="badge badge-soft-secondary">
                  {selectedKnowledgeView.counts.claimCount} claims
                </span>
              ) : null}
            </div>
            <div className="card-body">
              {selectedKnowledgeView ? (
                <>
                  {selectedKnowledgeView.overviewLines.length > 0 ? (
                    <div className="react-meta-list mb-3">
                      {selectedKnowledgeView.overviewLines.map((line) => (
                        <div key={line}>
                          <span className="react-meta-label">Grounded summary</span>
                          <strong>{line}</strong>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedKnowledgeView.claims.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table datanew react-resource-table mb-0">
                        <thead>
                          <tr>
                            <th>Axis</th>
                            <th>Support</th>
                            <th>Values</th>
                            <th>Provenance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedKnowledgeView.claims.slice(0, 8).map((claim) => (
                            <tr key={`${claim.axis}:${claim.values.join('|')}`}>
                              <td>
                                <span className="fw-semibold">
                                  {formatAxisLabel(claim.axis)}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`badge ${resolveSupportBadge(
                                    claim.supportClass,
                                  )}`}
                                >
                                  {formatSupportLabel(claim.supportClass)}
                                </span>
                              </td>
                              <td>
                                <div className="d-flex flex-wrap gap-2">
                                  {claim.values.map((value) => (
                                    <span key={value} className="badge badge-soft-info">
                                      {value}
                                    </span>
                                  ))}
                                  {claim.unspecifiedAxes.map((axis) => (
                                    <span
                                      key={axis}
                                      className="badge badge-soft-warning"
                                    >
                                      {formatAxisLabel(axis)}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="fs-12 text-muted">
                                {claim.provenance[0]
                                  ? formatProvenance(claim.provenance[0])
                                  : 'n/a'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      title="No structured claims yet"
                      body="Re-ingest the selected document if you expect extracted knowledge here."
                    />
                  )}
                </>
              ) : (
                <EmptyState
                  title="Select a document"
                  body="Choose a document to inspect claim-level extracted knowledge and provenance."
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xxl-6 d-flex">
          <div className="card flex-fill">
            <div className="card-header">
              <h5 className="mb-0">Create from text</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleCreateTextDocument}>
                <div className="mb-3">
                  <label className="form-label">Title</label>
                  <input
                    className="form-control"
                    value={textForm.title}
                    onChange={(event) =>
                      setTextForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Language</label>
                  <input
                    className="form-control"
                    value={textForm.language}
                    onChange={(event) =>
                      setTextForm((current) => ({
                        ...current,
                        language: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Document content</label>
                  <textarea
                    className="form-control"
                    rows={10}
                    value={textForm.content}
                    onChange={(event) =>
                      setTextForm((current) => ({
                        ...current,
                        content: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    id="document-activate"
                    className="form-check-input"
                    type="checkbox"
                    checked={textForm.activate}
                    onChange={(event) =>
                      setTextForm((current) => ({
                        ...current,
                        activate: event.target.checked,
                      }))
                    }
                  />
                  <label htmlFor="document-activate" className="form-check-label">
                    Activate when ingestion succeeds
                  </label>
                </div>
                <button className="btn btn-dark" type="submit" disabled={saving}>
                  <i className="ti ti-device-floppy me-1"></i>Save document
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-xxl-6 d-flex">
          <div className="card flex-fill">
            <div className="card-header">
              <h5 className="mb-0">Upload file</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleUploadDocument}>
                <div className="mb-3">
                  <label className="form-label">Optional title override</label>
                  <input
                    className="form-control"
                    value={uploadTitle}
                    onChange={(event) => setUploadTitle(event.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Language</label>
                  <input
                    className="form-control"
                    value={uploadLanguage}
                    onChange={(event) => setUploadLanguage(event.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Document file</label>
                  <input
                    className="form-control"
                    type="file"
                    accept=".txt,.md,.markdown,.json,.html,.htm,text/plain,text/markdown,application/json,text/html"
                    onChange={(event) =>
                      setUploadFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <small className="text-muted d-block mt-2">
                    Upload plain text, markdown, JSON, or HTML for document-origin ingestion.
                  </small>
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    id="document-upload-activate"
                    className="form-check-input"
                    type="checkbox"
                    checked={uploadActivate}
                    onChange={(event) => setUploadActivate(event.target.checked)}
                  />
                  <label
                    htmlFor="document-upload-activate"
                    className="form-check-label"
                  >
                    Activate when ingestion succeeds
                  </label>
                </div>
                <button className="btn btn-dark" type="submit" disabled={saving}>
                  <i className="ti ti-upload me-1"></i>Upload document
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function formatAxisLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function formatSupportLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function resolveSupportBadge(value: string) {
  if (value === 'partial_fact') {
    return 'badge-soft-warning';
  }

  if (value === 'bounded_inference') {
    return 'badge-soft-secondary';
  }

  return 'badge-soft-success';
}

function formatProvenance(input: {
  documentTitle: string;
  section?: string;
  page?: number;
  sheet?: string;
  chunkSequence: number;
}) {
  const location = [input.section, input.sheet, input.page ? `p.${input.page}` : null]
    .filter(Boolean)
    .join(' / ');

  return [input.documentTitle, location || `chunk ${input.chunkSequence + 1}`]
    .filter(Boolean)
    .join(' - ');
}
