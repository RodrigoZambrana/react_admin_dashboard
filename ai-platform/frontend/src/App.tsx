import { FormEvent, useEffect, useMemo, useState } from 'react';

import { apiRequest } from './api';

type ConversationSummary = {
  id: string;
  language: string | null;
  updatedAt?: string;
  messages?: Array<{
    id: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    content: string;
  }>;
};

type ConversationMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
};

type ChatResponse = {
  conversationId: string;
  traceId: string;
  message: string;
  debug: Record<string, unknown>;
};

type ChatLog = {
  id: string;
  traceId: string;
  stage: string;
  status: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

type PromptVersion = {
  id: string;
  key: string;
  version: number;
  status: string;
  template: string;
  createdAt: string;
};

const promptKeys = ['interpretation', 'response'];

export function App() {
  const [draft, setDraft] = useState(
    'Necesito una cotización para 4 personas mañana.',
  );
  const [locale, setLocale] = useState('es');
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [traceLogs, setTraceLogs] = useState<ChatLog[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string>();
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [latestResponse, setLatestResponse] = useState<ChatResponse | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptKey, setPromptKey] = useState('response');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [activatePrompt, setActivatePrompt] = useState(true);

  useEffect(() => {
    void refreshDashboard();
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    void apiRequest<ConversationMessage[]>(
      `/conversations/${activeConversationId}/messages`,
    )
      .then(setMessages)
      .catch((requestError: Error) => setError(requestError.message));
  }, [activeConversationId]);

  useEffect(() => {
    if (!selectedTraceId) {
      setTraceLogs([]);
      return;
    }

    void apiRequest<ChatLog[]>(`/logs/${selectedTraceId}`)
      .then(setTraceLogs)
      .catch((requestError: Error) => setError(requestError.message));
  }, [selectedTraceId]);

  const totalMessageCount = useMemo(
    () => conversations.reduce((total, item) => total + (item.messages?.length ?? 0), 0),
    [conversations],
  );

  const refreshDashboard = async () => {
    try {
      setError(null);
      const [conversationData, logData, promptData] = await Promise.all([
        apiRequest<ConversationSummary[]>('/conversations?limit=12'),
        apiRequest<ChatLog[]>('/logs?limit=40'),
        apiRequest<PromptVersion[]>('/prompts'),
      ]);

      setConversations(conversationData);
      setLogs(logData);
      setPrompts(promptData);

      if (!activeConversationId && conversationData[0]) {
        setActiveConversationId(conversationData[0].id);
      }

      if (!selectedTraceId && logData[0]) {
        setSelectedTraceId(logData[0].traceId);
      }

      const activePrompt = promptData.find(
        (prompt) => prompt.key === promptKey && prompt.status === 'ACTIVE',
      );

      if (!promptTemplate && activePrompt) {
        setPromptTemplate(activePrompt.template);
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  const handleSendMessage = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setLoadingChat(true);
      setError(null);

      const response = await apiRequest<ChatResponse>('/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          message: draft,
          locale,
          conversationId: activeConversationId,
        }),
      });

      setLatestResponse(response);
      setActiveConversationId(response.conversationId);
      setSelectedTraceId(response.traceId);
      setDraft('');

      await refreshDashboard();
      const nextMessages = await apiRequest<ConversationMessage[]>(
        `/conversations/${response.conversationId}/messages`,
      );
      setMessages(nextMessages);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoadingChat(false);
    }
  };

  const handlePromptSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setError(null);
      await apiRequest<PromptVersion>('/prompts', {
        method: 'POST',
        body: JSON.stringify({
          key: promptKey,
          template: promptTemplate,
          activate: activatePrompt,
          createdBy: 'admin-ui',
        }),
      });
      await refreshDashboard();
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  return (
    <div className="main-wrapper admin-platform-shell">
      <div className="header">
        <div className="header-left active">
          <a href="/" className="logo logo-normal">
            <img
              src="/dreamschat-admin/assets/img/full-logo.svg"
              alt="DreamsChat"
            />
          </a>
          <a href="/" className="logo-small">
            <img
              src="/dreamschat-admin/assets/img/logo-small.svg"
              alt="DreamsChat"
            />
          </a>
        </div>

        <div className="header-user">
          <div className="nav user-menu">
            <div className="nav-item nav-search-inputs me-auto">
              <div className="top-nav-search">
                <div className="d-flex align-items-center">
                  <form action="javascript:void(0);" className="dropdown">
                    <div className="searchinputs">
                      <input
                        type="text"
                        value={selectedTraceId ?? ''}
                        readOnly
                        placeholder="Latest trace"
                      />
                      <div className="search-addon">
                        <span>
                          <i className="ti ti-scan"></i>
                        </span>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center">
              <div className="provider-head-links me-2">
                <button
                  className="btn btn-dark btn-sm"
                  onClick={() => void refreshDashboard()}
                >
                  <i className="ti ti-refresh me-1"></i>Refresh
                </button>
              </div>
              <div className="dropdown">
                <a href="javascript:void(0);">
                  <div className="booking-user d-flex align-items-center">
                    <span className="user-img me-2">
                      <img
                        src="/dreamschat-admin/assets/img/users/user-08.jpg"
                        alt="user"
                      />
                    </span>
                    <div>
                      <h6 className="fs-14 fw-medium">Demo Tenant</h6>
                      <span className="text-primary fs-12">AI Platform</span>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sidebar" id="sidebar">
        <div className="sidebar-inner slimscroll">
          <div id="sidebar-menu" className="sidebar-menu d-flex flex-column">
            <ul className="menu-top">
              <li className="active">
                <a href="#dashboard">
                  <i className="ti ti-layout-dashboard"></i>
                  <span>Dashboard</span>
                </a>
              </li>
              <li>
                <a href="#conversation-console">
                  <i className="ti ti-message-circle"></i>
                  <span>Conversation Console</span>
                </a>
              </li>
              <li>
                <a href="#trace-center">
                  <i className="ti ti-route-2"></i>
                  <span>Trace Center</span>
                </a>
              </li>
              <li>
                <a href="#prompt-center">
                  <i className="ti ti-file-text-ai"></i>
                  <span>Prompt Center</span>
                </a>
              </li>
              <li>
                <a href="#latest-debug">
                  <i className="ti ti-bug"></i>
                  <span>Debug Viewer</span>
                </a>
              </li>
            </ul>
            <ul className="menu-bottom">
              <li>
                <a href="#dashboard">
                  <i className="ti ti-building-store"></i>
                  <span>Tenant: demo-tenant</span>
                </a>
              </li>
              <li>
                <a href="#trace-center">
                  <i className="ti ti-database-search"></i>
                  <span>Flow Logs</span>
                  <span className="version">{logs.length}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="page-wrapper">
        <div className="content container-fluid">
          <div
            id="dashboard"
            className="d-md-flex d-block align-items-center justify-content-between mb-4 section-anchor"
          >
            <div className="my-auto">
              <h4 className="page-title mb-1">AI Platform Dashboard</h4>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <a href="#dashboard">
                      <i className="ti ti-home text-primary"></i>
                    </a>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Conversational Operations
                  </li>
                </ol>
              </nav>
            </div>
          </div>

          {error ? (
            <div className="alert alert-danger custom-react-alert" role="alert">
              {error}
            </div>
          ) : null}

          <div className="row justify-content-center">
            <div className="col-md-6 col-xl-3 d-flex">
              <div className="card total-users flex-fill">
                <div className="card-body">
                  <div className="total-counts">
                    <div className="d-flex align-items-center">
                      <span className="total-count-icons">
                        <i className="ti ti-message-circle"></i>
                      </span>
                      <div>
                        <p>Conversations</p>
                        <h5>{conversations.length}</h5>
                      </div>
                    </div>
                    <div className="percentage">
                      <span className="bg-success">active</span>
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
                        <i className="ti ti-messages"></i>
                      </span>
                      <div>
                        <p>Visible Messages</p>
                        <h5>{messages.length}</h5>
                      </div>
                    </div>
                    <div className="percentage">
                      <span className="bg-dark">{totalMessageCount}</span>
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
                        <i className="ti ti-route-2"></i>
                      </span>
                      <div>
                        <p>Stage Logs</p>
                        <h5>{logs.length}</h5>
                      </div>
                    </div>
                    <div className="percentage">
                      <span className="bg-success">
                        {selectedTraceId ? traceLogs.length : 0} trace events
                      </span>
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
                        <i className="ti ti-file-text-ai"></i>
                      </span>
                      <div>
                        <p>Prompt Versions</p>
                        <h5>{prompts.length}</h5>
                      </div>
                    </div>
                    <div className="percentage">
                      <span className="bg-success">
                        {prompts.filter((prompt) => prompt.status === 'ACTIVE').length}{' '}
                        active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12 d-flex">
              <div className="card user-details flex-fill">
                <div className="card-header">
                  <h5 className="mb-0">DreamsChat Visual Families</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6 d-flex">
                      <div className="react-theme-pack w-100">
                        <img
                          src="/dreamschat-admin/assets/img/full-logo.svg"
                          alt="Admin theme"
                          className="react-theme-logo"
                        />
                        <h6>Admin Dashboard Pack</h6>
                        <p>
                          Loaded from <code>html/template/admin</code> and applied to
                          the current operations UI.
                        </p>
                      </div>
                    </div>
                    <div className="col-md-6 d-flex">
                      <div className="react-theme-pack w-100">
                        <img
                          src="/dreamschat-chat/assets/img/logo.svg"
                          alt="Public chat theme"
                          className="react-theme-logo"
                        />
                        <h6>Public Chat Pack</h6>
                        <p>
                          Vendored from <code>html/template</code> so the user-facing
                          chat shell can be built natively without another asset import.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div
              id="conversation-console"
              className="col-xxl-8 d-flex section-anchor"
            >
              <div className="card user-details flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-0">Conversation Console</h5>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <select
                      className="form-select"
                      value={activeConversationId ?? ''}
                      onChange={(event) =>
                        setActiveConversationId(event.target.value || undefined)
                      }
                    >
                      <option value="">New conversation</option>
                      {conversations.map((conversation) => (
                        <option key={conversation.id} value={conversation.id}>
                          {conversation.id.slice(0, 8)} ·{' '}
                          {conversation.language ?? 'n/a'}
                        </option>
                      ))}
                    </select>
                    <input
                      className="form-control"
                      value={locale}
                      onChange={(event) => setLocale(event.target.value)}
                      placeholder="Locale"
                    />
                  </div>
                </div>
                <div className="card-body">
                  <div className="react-chat-stream">
                    {messages.length === 0 ? (
                      <div className="empty-conversation-state">
                        Send a message to start the tenant-scoped flow.
                      </div>
                    ) : (
                      messages.map((message, index) => (
                        <div
                          key={message.id}
                          className={`react-chat-message ${
                            message.role === 'USER' ? 'user' : 'assistant'
                          }`}
                        >
                          <div className="avatar avatar-md">
                            <img
                              src={
                                message.role === 'USER'
                                  ? `/dreamschat-admin/assets/img/users/user-${
                                      ((index % 8) + 1).toString().padStart(2, '0')
                                    }.jpg`
                                  : '/dreamschat-admin/assets/img/profiles/avatar-52.jpg'
                              }
                              alt={message.role}
                              className="img-fluid rounded-circle"
                            />
                          </div>
                          <div className="react-chat-bubble">
                            <span className="react-chat-role">{message.role}</span>
                            <p>{message.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form className="mt-4" onSubmit={handleSendMessage}>
                    <div className="mb-3">
                      <textarea
                        className="form-control react-large-textarea"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Write a message for the standalone orchestration backend"
                      />
                    </div>
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <span className="badge badge-soft-primary">
                        POST /chat/message
                      </span>
                      <button
                        className="btn btn-dark"
                        disabled={loadingChat || !draft.trim()}
                      >
                        {loadingChat ? 'Sending...' : 'Send Message'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <div id="latest-debug" className="col-xxl-4 d-flex section-anchor">
              <div className="card user-details flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-0">Latest Debug</h5>
                  {latestResponse ? (
                    <span className="badge bg-dark">
                      {latestResponse.traceId.slice(0, 8)}
                    </span>
                  ) : null}
                </div>
                <div className="card-body">
                  <pre className="react-code-view">
                    {latestResponse
                      ? JSON.stringify(latestResponse, null, 2)
                      : 'No response yet.'}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div id="trace-center" className="col-xl-7 d-flex section-anchor">
              <div className="card user-details flex-fill">
                <div className="card-header">
                  <h5 className="mb-0">Stored Trace Events</h5>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table mb-0">
                      <thead className="thead-light">
                        <tr>
                          <th>Stage</th>
                          <th>Status</th>
                          <th>Trace</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id}>
                            <td>{log.stage}</td>
                            <td>
                              <span className="badge bg-outline-light text-dark">
                                {log.status}
                              </span>
                            </td>
                            <td>{log.traceId.slice(0, 8)}</td>
                            <td>
                              <button
                                className="btn btn-light btn-sm"
                                onClick={() => setSelectedTraceId(log.traceId)}
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-5 d-flex">
              <div className="card user-details flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-0">Trace Detail</h5>
                  {selectedTraceId ? (
                    <span className="badge bg-primary">
                      {selectedTraceId.slice(0, 8)}
                    </span>
                  ) : null}
                </div>
                <div className="card-body">
                  <pre className="react-code-view trace-view">
                    {traceLogs.length > 0
                      ? JSON.stringify(traceLogs, null, 2)
                      : 'Select a trace to inspect persisted flow logs.'}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div id="prompt-center" className="col-xl-5 d-flex section-anchor">
              <div className="card user-details flex-fill">
                <div className="card-header">
                  <h5 className="mb-0">Prompt Editor</h5>
                </div>
                <div className="card-body">
                  <form onSubmit={handlePromptSubmit}>
                    <div className="mb-3">
                      <label className="form-label">Prompt Key</label>
                      <select
                        className="form-select"
                        value={promptKey}
                        onChange={(event) => {
                          const nextKey = event.target.value;
                          setPromptKey(nextKey);
                          const nextPrompt = prompts.find(
                            (prompt) =>
                              prompt.key === nextKey && prompt.status === 'ACTIVE',
                          );
                          setPromptTemplate(nextPrompt?.template ?? '');
                        }}
                      >
                        {promptKeys.map((key) => (
                          <option key={key} value={key}>
                            {key}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Template</label>
                      <textarea
                        className="form-control react-large-textarea"
                        value={promptTemplate}
                        onChange={(event) => setPromptTemplate(event.target.value)}
                      />
                    </div>
                    <div className="form-check form-switch mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={activatePrompt}
                        onChange={(event) => setActivatePrompt(event.target.checked)}
                        id="activatePrompt"
                      />
                      <label className="form-check-label" htmlFor="activatePrompt">
                        Activate immediately
                      </label>
                    </div>
                    <button className="btn btn-primary" disabled={!promptTemplate.trim()}>
                      Save Prompt Version
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="col-xl-7 d-flex">
              <div className="card user-details flex-fill">
                <div className="card-header">
                  <h5 className="mb-0">Stored Prompt Versions</h5>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table mb-0">
                      <thead className="thead-light">
                        <tr>
                          <th>Key</th>
                          <th>Version</th>
                          <th>Status</th>
                          <th>Template</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prompts.map((prompt) => (
                          <tr key={prompt.id}>
                            <td>{prompt.key}</td>
                            <td>v{prompt.version}</td>
                            <td>
                              <span
                                className={`badge ${
                                  prompt.status === 'ACTIVE'
                                    ? 'bg-success'
                                    : 'bg-outline-light text-dark'
                                }`}
                              >
                                {prompt.status}
                              </span>
                            </td>
                            <td className="react-template-cell">{prompt.template}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
