import { useEffect, useMemo, useState } from 'react';

import { getKnowledge, listActiveKnowledgeMetadata, listKnowledge } from '../api';
import { EmptyState } from '../components/shared/EmptyState';
import { JsonBlock } from '../components/shared/JsonBlock';
import { PageHeader } from '../components/shared/PageHeader';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { KnowledgeEntry, KnowledgeMetadataVersion } from '../types';
import { formatDateTime } from '../utils';

const knowledgeCategories = [
  'ALL',
  'GENERAL',
  'FAQ',
  'PRODUCT',
  'BOOKING',
  'QUOTE',
  'POLICY',
] as const;

export function KnowledgeCenterPage() {
  const [category, setCategory] = useState<(typeof knowledgeCategories)[number]>('ALL');
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [activePolicies, setActivePolicies] = useState<KnowledgeMetadataVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh(category);
  }, [category]);

  const refresh = async (nextCategory = category) => {
    try {
      setLoading(true);
      setError(null);
      const [knowledgeEntries, policies] = await Promise.all([
        listKnowledge(40, nextCategory === 'ALL' ? undefined : nextCategory),
        listActiveKnowledgeMetadata(),
      ]);
      setEntries(knowledgeEntries);
      setActivePolicies(policies);
      const nextSelectedId = knowledgeEntries.some((entry) => entry.id === selectedId)
        ? selectedId
        : knowledgeEntries[0]?.id;
      setSelectedId(nextSelectedId);
      if (nextSelectedId) {
        const detail = await getKnowledge(nextSelectedId);
        setSelectedEntry(detail);
      } else {
        setSelectedEntry(null);
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (knowledgeId: string) => {
    try {
      setError(null);
      setSelectedId(knowledgeId);
      setSelectedEntry(await getKnowledge(knowledgeId));
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  const summary = useMemo(() => {
    const categories = new Set(entries.map((entry) => entry.category));
    const avgConfidence =
      entries.length === 0
        ? 0
        : entries.reduce((sum, entry) => sum + entry.confidence, 0) / entries.length;

    return {
      categories: categories.size,
      avgConfidence,
    };
  }, [entries]);

  return (
    <>
      <PageHeader
        title="Knowledge Center"
        section="Governed Knowledge Workflows"
        description="Inspect learned knowledge, review active knowledge metadata policy, and trace how governed learning is shaping reusable tenant context."
      />

      {error ? (
        <div className="alert alert-danger custom-react-alert" role="alert">
          {error}
        </div>
      ) : null}

      <div className="row">
        <div className="col-md-6 col-xl-3 d-flex">
          <div className="card total-users flex-fill">
            <div className="card-body">
              <div className="total-counts">
                <div className="d-flex align-items-center">
                  <span className="bg-success total-count-icons">
                    <i className="ti ti-brain"></i>
                  </span>
                  <div>
                    <p>Knowledge entries</p>
                    <h5>{loading ? '...' : entries.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-success">Governed learning output</span>
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
                    <i className="ti ti-category"></i>
                  </span>
                  <div>
                    <p>Categories in view</p>
                    <h5>{loading ? '...' : summary.categories}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-dark">Filter-aware</span>
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
                    <i className="ti ti-chart-dots-2"></i>
                  </span>
                  <div>
                    <p>Avg confidence</p>
                    <h5>{loading ? '...' : summary.avgConfidence.toFixed(2)}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-info">Current knowledge slice</span>
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
                  <span className="bg-purple total-count-icons">
                    <i className="ti ti-database-star"></i>
                  </span>
                  <div>
                    <p>Active metadata policies</p>
                    <h5>{loading ? '...' : activePolicies.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-purple">Wave 6 ABM-backed</span>
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
              <h5 className="mb-0">Knowledge inventory</h5>
              <div className="d-flex align-items-center gap-2">
                <select
                  className="form-select"
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value as (typeof knowledgeCategories)[number],
                    )
                  }
                >
                  {knowledgeCategories.map((item) => (
                    <option key={item} value={item}>
                      {item === 'ALL' ? 'All categories' : item}
                    </option>
                  ))}
                </select>
                <button className="btn btn-dark btn-sm" onClick={() => void refresh()}>
                  <i className="ti ti-refresh me-1"></i>Refresh
                </button>
              </div>
            </div>
            <div className="card-body p-0">
              {entries.length === 0 && !loading ? (
                <div className="p-4">
                  <EmptyState
                    title="No knowledge entries found"
                    body="Learning has not produced entries for the selected category yet."
                  />
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table datanew react-resource-table mb-0">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Confidence</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className={selectedId === entry.id ? 'react-row-selected' : undefined}
                        >
                          <td>
                            <button
                              type="button"
                              className="btn btn-link react-row-button p-0"
                              onClick={() => void handleSelect(entry.id)}
                            >
                              <span className="d-block fw-semibold">{entry.title}</span>
                              <span className="text-muted fs-12">
                                {entry.summary.slice(0, 68)}
                              </span>
                            </button>
                          </td>
                          <td>{entry.category}</td>
                          <td>{entry.confidence.toFixed(2)}</td>
                          <td>{formatDateTime(entry.createdAt)}</td>
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
              <h5 className="mb-0">Knowledge detail</h5>
              <a href="#knowledge-metadata" className="btn btn-light btn-sm">
                <i className="ti ti-settings me-1"></i>Open metadata operations
              </a>
            </div>
            <div className="card-body">
              {selectedEntry ? (
                <div className="row">
                  <div className="col-xl-5">
                    <div className="react-resource-summary">
                      <h6>{selectedEntry.title}</h6>
                      <p className="text-muted mb-3">{selectedEntry.summary}</p>
                      <div className="react-chip-list mb-3">
                        {selectedEntry.tags.map((tag) => (
                          <span key={tag} className="badge badge-soft-info">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="react-meta-list">
                        <div>
                          <span className="react-meta-label">Category</span>
                          <strong>{selectedEntry.category}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Confidence</span>
                          <strong>{selectedEntry.confidence.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Source log</span>
                          <strong>{selectedEntry.sourceLogId ?? 'n/a'}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Created at</span>
                          <strong>{formatDateTime(selectedEntry.createdAt)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-xl-7">
                    <div className="react-rich-preview react-large-preview">
                      {selectedEntry.body}
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Select a knowledge entry"
                  body="Choose an entry to inspect its body, source log linkage, and metadata."
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
              <h5 className="mb-0">Active knowledge metadata policy</h5>
            </div>
            <div className="card-body">
              {activePolicies.length === 0 ? (
                <EmptyState
                  title="No active metadata policy"
                  body="Publish a knowledge metadata resource to govern learning extraction."
                />
              ) : (
                <div className="row">
                  <div className="col-xl-4">
                    <div className="react-resource-summary">
                      <h6>{activePolicies[0].key}</h6>
                      <p className="text-muted mb-3">
                        Active metadata policy v{activePolicies[0].version} currently
                        shapes governed learning.
                      </p>
                      <StatusBadge status={activePolicies[0].status} />
                    </div>
                  </div>
                  <div className="col-xl-8">
                    <JsonBlock value={activePolicies[0].resource} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
