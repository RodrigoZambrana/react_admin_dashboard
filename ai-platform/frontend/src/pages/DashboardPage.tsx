import { useEffect, useMemo, useState } from 'react';

import {
  listActiveCriticalConfigs,
  listActiveDateTimeLocales,
  listActiveKnowledgeMetadata,
  listActivePrompts,
  listActiveResponseFallbacks,
  listConversations,
  listLogs,
} from '../api';
import { PageHeader } from '../components/shared/PageHeader';
import type {
  ChatLog,
  ConversationSummary,
  CriticalConfigVersion,
  KnowledgeMetadataVersion,
  PromptVersion,
  ResponseFallbackVersion,
  TemporalLocaleVersion,
} from '../types';

type DashboardState = {
  conversations: ConversationSummary[];
  logs: ChatLog[];
  prompts: PromptVersion[];
  locales: TemporalLocaleVersion[];
  configs: CriticalConfigVersion[];
  fallbacks: ResponseFallbackVersion[];
  knowledge: KnowledgeMetadataVersion[];
};

export function DashboardPage() {
  const [state, setState] = useState<DashboardState>({
    conversations: [],
    logs: [],
    prompts: [],
    locales: [],
    configs: [],
    fallbacks: [],
    knowledge: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const [
        conversations,
        logs,
        prompts,
        locales,
        configs,
        fallbacks,
        knowledge,
      ] = await Promise.all([
        listConversations(8),
        listLogs(20),
        listActivePrompts(),
        listActiveDateTimeLocales(),
        listActiveCriticalConfigs(),
        listActiveResponseFallbacks(),
        listActiveKnowledgeMetadata(),
      ]);

      setState({
        conversations,
        logs,
        prompts,
        locales,
        configs,
        fallbacks,
        knowledge,
      });
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const totalMessages = useMemo(
    () =>
      state.conversations.reduce(
        (total, conversation) => total + (conversation.messages?.length ?? 0),
        0,
      ),
    [state.conversations],
  );

  const summaryCards = [
    {
      label: 'Active managed families',
      value:
        state.prompts.length +
        state.locales.length +
        state.configs.length +
        state.fallbacks.length +
        state.knowledge.length,
      icon: 'ti ti-layers-linked',
      tone: 'bg-success',
      hint: 'Published runtime resources',
    },
    {
      label: 'Recent conversations',
      value: state.conversations.length,
      icon: 'ti ti-message-circle',
      tone: 'bg-dark',
      hint: `${totalMessages} visible messages`,
    },
    {
      label: 'Recent stage logs',
      value: state.logs.length,
      icon: 'ti ti-route-2',
      tone: 'bg-purple',
      hint: 'Live pipeline observability',
    },
    {
      label: 'Operator domains',
      value: 7,
      icon: 'ti ti-layout-grid',
      tone: 'bg-info',
      hint: 'Resources, knowledge, and test center',
    },
  ];

  return (
    <>
      <PageHeader
        title="Admin Operations"
        section="Managed Resource Operations"
        description="Run the operator shell over governed backend contracts without bypassing lifecycle or tenant rules."
      />

      {error ? (
        <div className="alert alert-danger custom-react-alert" role="alert">
          {error}
        </div>
      ) : null}

      <div className="row">
        {summaryCards.map((card) => (
          <div key={card.label} className="col-md-6 col-xl-3 d-flex">
            <div className="card total-users flex-fill">
              <div className="card-body">
                <div className="total-counts">
                  <div className="d-flex align-items-center">
                    <span className={`${card.tone} total-count-icons`}>
                      <i className={card.icon}></i>
                    </span>
                    <div>
                      <p>{card.label}</p>
                      <h5>{loading ? '...' : card.value}</h5>
                    </div>
                  </div>
                  <div className="percentage">
                    <span className={card.tone}>{card.hint}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row">
        <div className="col-xxl-7 d-flex">
          <div className="card flex-fill">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">Runtime-managed resource readiness</h5>
              <button className="btn btn-dark btn-sm" onClick={() => void refresh()}>
                <i className="ti ti-refresh me-1"></i>Refresh
              </button>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6 d-flex">
                  <div className="react-ops-domain-card w-100">
                    <span className="react-ops-domain-icon">
                      <i className="ti ti-file-text-ai"></i>
                    </span>
                    <h6>Prompts</h6>
                    <p>{state.prompts.length} active prompt resources</p>
                  </div>
                </div>
                <div className="col-md-6 d-flex">
                  <div className="react-ops-domain-card w-100">
                    <span className="react-ops-domain-icon">
                      <i className="ti ti-calendar-time"></i>
                    </span>
                    <h6>Date-time locale resources</h6>
                    <p>{state.locales.length} active locale catalogs</p>
                  </div>
                </div>
                <div className="col-md-6 d-flex">
                  <div className="react-ops-domain-card w-100">
                    <span className="react-ops-domain-icon">
                      <i className="ti ti-adjustments-horizontal"></i>
                    </span>
                    <h6>Critical configs</h6>
                    <p>{state.configs.length} active runtime config entries</p>
                  </div>
                </div>
                <div className="col-md-6 d-flex">
                  <div className="react-ops-domain-card w-100">
                    <span className="react-ops-domain-icon">
                      <i className="ti ti-message-language"></i>
                    </span>
                    <h6>Fallback catalogs</h6>
                    <p>{state.fallbacks.length} active deterministic fallback packs</p>
                  </div>
                </div>
                <div className="col-md-12 d-flex">
                  <div className="react-ops-domain-card w-100 mb-0">
                    <span className="react-ops-domain-icon">
                      <i className="ti ti-database-star"></i>
                    </span>
                    <h6>Knowledge metadata</h6>
                    <p>
                      {state.knowledge.length} active policies shaping learning and
                      governed extraction metadata.
                    </p>
                  </div>
                </div>
                <div className="col-md-6 d-flex">
                  <div className="react-ops-domain-card w-100 mb-0">
                    <span className="react-ops-domain-icon">
                      <i className="ti ti-flask-2"></i>
                    </span>
                    <h6>Chat Test Center</h6>
                    <p>Replay multi-turn scenarios and inspect grounded traces.</p>
                  </div>
                </div>
                <div className="col-md-6 d-flex">
                  <div className="react-ops-domain-card w-100 mb-0">
                    <span className="react-ops-domain-icon">
                      <i className="ti ti-brain"></i>
                    </span>
                    <h6>Knowledge Center</h6>
                    <p>Browse governed learning output and investigate source context.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xxl-5 d-flex">
          <div className="card flex-fill">
            <div className="card-header">
              <h5 className="mb-0">Roadmap continuity note</h5>
            </div>
            <div className="card-body">
              <div className="react-roadmap-note">
                <p>
                  Waves 6 and 7 now productize operator workflows over governed runtime
                  resources, knowledge stewardship, and replay-driven investigation. The
                  future public chat still depends on async turn intake and reply-state
                  handling.
                </p>
                <ul className="mb-0">
                  <li>Wave 7 knowledge and chat test center operations are now live.</li>
                  <li>
                    Async turn-intake, cancellation, and typing remain mandatory before
                    or within Wave 8.
                  </li>
                  <li>
                    Wave 8 user chat must replicate the DreamsChat public template over
                    those async capabilities, not over a synchronous shell.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xxl-7 d-flex">
          <div className="card flex-fill">
            <div className="card-header">
              <h5 className="mb-0">Recent live traces</h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table datanew mb-0">
                  <thead>
                    <tr>
                      <th>Trace</th>
                      <th>Stage</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.logs.map((log) => (
                      <tr key={log.id}>
                        <td className="text-dark fw-semibold">
                          {log.traceId.slice(0, 12)}
                        </td>
                        <td>{log.stage}</td>
                        <td>{log.status}</td>
                        <td>{new Date(log.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xxl-5 d-flex">
          <div className="card flex-fill">
            <div className="card-header">
              <h5 className="mb-0">Recent conversations</h5>
            </div>
            <div className="card-body">
              <div className="react-conversation-stack">
                {state.conversations.map((conversation) => (
                  <div key={conversation.id} className="react-conversation-item">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <div>
                        <h6 className="mb-1">{conversation.id.slice(0, 12)}</h6>
                        <p className="mb-0 text-muted">
                          {conversation.language ?? 'unknown'} ·{' '}
                          {conversation.messages?.length ?? 0} messages
                        </p>
                      </div>
                      <span className="badge badge-soft-info">
                        {conversation.updatedAt
                          ? new Date(conversation.updatedAt).toLocaleString()
                          : 'active'}
                      </span>
                    </div>
                  </div>
                ))}
                {state.conversations.length === 0 && !loading ? (
                  <div className="react-empty-inline">
                    No conversations yet for this tenant.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
