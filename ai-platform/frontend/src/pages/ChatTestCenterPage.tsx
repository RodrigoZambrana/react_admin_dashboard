import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  compareTraces,
  evaluateTestCenterConversation,
  getTestCenterRun,
  getTraceDetail,
  listActiveDateTimeLocales,
  listActiveKnowledgeMetadata,
  listActivePrompts,
  listActiveResponseFallbacks,
  listRecentTraceSummaries,
  listTestCenterScenarios,
  listTestCenterRuns,
  replayConversation,
} from '../api';
import { EmptyState } from '../components/shared/EmptyState';
import { JsonBlock } from '../components/shared/JsonBlock';
import { PageHeader } from '../components/shared/PageHeader';
import type {
  KnowledgeMetadataVersion,
  PromptVersion,
  ReplayResponse,
  ResponseFallbackVersion,
  TemporalLocaleVersion,
  TestCenterConversationEvaluation,
  TestCenterScenario,
  TestCenterRunDetail,
  TestCenterRunSummary,
  TraceComparison,
  TraceDetail,
  TraceSummary,
} from '../types';
import { formatDateTime } from '../utils';

type InvestigationResources = {
  prompts: PromptVersion[];
  locales: TemporalLocaleVersion[];
  fallbacks: ResponseFallbackVersion[];
  knowledgeMetadata: KnowledgeMetadataVersion[];
};

export function ChatTestCenterPage() {
  const [runs, setRuns] = useState<TestCenterRunSummary[]>([]);
  const [scenarios, setScenarios] = useState<TestCenterScenario[]>([]);
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [resources, setResources] = useState<InvestigationResources>({
    prompts: [],
    locales: [],
    fallbacks: [],
    knowledgeMetadata: [],
  });
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [selectedRun, setSelectedRun] = useState<TestCenterRunDetail | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [selectedTraceId, setSelectedTraceId] = useState<string>();
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null);
  const [leftTraceId, setLeftTraceId] = useState<string>('');
  const [rightTraceId, setRightTraceId] = useState<string>('');
  const [comparison, setComparison] = useState<TraceComparison | null>(null);
  const [replayDraft, setReplayDraft] = useState(
    'hola\nquiero una cotizacion para 2 puertas\npuertas 1,38 x 0,90',
  );
  const [replayLocale, setReplayLocale] = useState('es');
  const [lastReplay, setLastReplay] = useState<ReplayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState(false);
  const [evaluatingRun, setEvaluatingRun] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null);
      return;
    }

    void getTestCenterRun(selectedRunId)
      .then(setSelectedRun)
      .catch((requestError: Error) => setError(requestError.message));
  }, [selectedRunId]);

  useEffect(() => {
    if (!selectedTraceId) {
      setSelectedTrace(null);
      return;
    }

    void getTraceDetail(selectedTraceId)
      .then(setSelectedTrace)
      .catch((requestError: Error) => setError(requestError.message));
  }, [selectedTraceId]);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const [
        runData,
        traceData,
        prompts,
        locales,
        fallbacks,
        knowledgeMetadata,
        scenarioData,
      ] =
        await Promise.all([
          listTestCenterRuns(20),
          listRecentTraceSummaries(20),
          listActivePrompts(),
          listActiveDateTimeLocales(),
          listActiveResponseFallbacks(),
          listActiveKnowledgeMetadata(),
          listTestCenterScenarios(replayLocale),
        ]);

      setRuns(runData);
      setTraces(traceData);
      setScenarios(scenarioData);
      setResources({
        prompts,
        locales,
        fallbacks,
        knowledgeMetadata,
      });

      const nextRunId = runData.some((run) => run.id === selectedRunId)
        ? selectedRunId
        : runData[0]?.id;
      const nextTraceId = traceData.some((trace) => trace.traceId === selectedTraceId)
        ? selectedTraceId
        : traceData[0]?.traceId;
      setSelectedRunId(nextRunId);
      setSelectedTraceId(nextTraceId);
      setSelectedScenarioId((current) =>
        scenarioData.some((scenario) => scenario.id === current)
          ? current
          : (scenarioData[0]?.id ?? ''),
      );
      setLeftTraceId((current) => current || traceData[0]?.traceId || '');
      setRightTraceId((current) => current || traceData[1]?.traceId || '');
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReplay = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setReplaying(true);
      setError(null);
      setNotice(null);
      const turns = replayDraft
        .split('\n')
        .map((message) => message.trim())
        .filter(Boolean)
        .map((message) => ({
          message,
          locale: replayLocale,
        }));

      if (turns.length === 0) {
        throw new Error('Add at least one turn before running a replay.');
      }

      const result = await replayConversation({
        locale: replayLocale,
        turns,
        scenarioId: selectedScenarioId || undefined,
        autoEvaluate: true,
      });
      setLastReplay(result);
      setNotice(
        `Replay completed for ${result.turns.length} turns in conversation ${result.conversationId}.`,
      );
      await refresh();
      setSelectedRunId(result.conversationId);
      setSelectedTraceId(result.turns[result.turns.length - 1]?.traceId);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setReplaying(false);
    }
  };

  const handleScenarioSelect = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    const scenario = scenarios.find((entry) => entry.id === scenarioId);

    if (!scenario) {
      return;
    }

    setReplayLocale(scenario.locale);
    setReplayDraft(scenario.turns.map((turn) => turn.message).join('\n'));
    setNotice(`Scenario loaded: ${scenario.label}`);
  };

  const handleEvaluateSelectedRun = async () => {
    if (!selectedRunId || !selectedScenarioId) {
      return;
    }

    try {
      setEvaluatingRun(true);
      setError(null);
      const result = await evaluateTestCenterConversation({
        conversationId: selectedRunId,
        scenarioId: selectedScenarioId,
        locale: replayLocale,
      });
      setNotice(
        `Evaluation completed for ${result.scenario.label} on conversation ${selectedRunId}.`,
      );
      await refresh();
      setSelectedRunId(selectedRunId);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setEvaluatingRun(false);
    }
  };

  const handleCompare = async () => {
    if (!leftTraceId || !rightTraceId) {
      return;
    }

    try {
      setComparing(true);
      setError(null);
      setComparison(await compareTraces(leftTraceId, rightTraceId));
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setComparing(false);
    }
  };

  const traceOptions = useMemo(() => {
    const items = selectedRun?.traces ?? [];
    const all = [...items, ...traces];
    const map = new Map<string, TraceSummary>();

    all.forEach((trace) => {
      map.set(trace.traceId, trace);
    });

    return Array.from(map.values());
  }, [selectedRun?.traces, traces]);

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null,
    [scenarios, selectedScenarioId],
  );

  return (
    <>
      <PageHeader
        title="Chat Test Center"
        section="Trace Explorer And Replay"
        description="Replay scenarios through the real backend pipeline, inspect traces, compare outcomes, and correlate the active governed resources behind operator investigations."
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
                    <i className="ti ti-flask-2"></i>
                  </span>
                  <div>
                    <p>Test-center runs</p>
                    <h5>{loading ? '...' : runs.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-success">admin_test_center channel</span>
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
                    <i className="ti ti-route-2"></i>
                  </span>
                  <div>
                    <p>Recent traces</p>
                    <h5>{loading ? '...' : traces.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-dark">Grounded observability</span>
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
                    <i className="ti ti-file-search"></i>
                  </span>
                  <div>
                    <p>Active prompts</p>
                    <h5>{loading ? '...' : resources.prompts.length}</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-info">Investigation context</span>
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
                    <i className="ti ti-clock-bolt"></i>
                  </span>
                  <div>
                    <p>Wave 8 note</p>
                    <h5>async</h5>
                  </div>
                </div>
                <div className="percentage">
                  <span className="bg-purple">Typing/cancel pending later</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xxl-4 d-flex">
          <div className="card flex-fill">
            <div className="card-header">
              <h5 className="mb-0">Scenario Library</h5>
            </div>
            <div className="card-body p-0">
              {scenarios.length === 0 && !loading ? (
                <div className="p-4">
                  <EmptyState
                    title="No scenarios available"
                    body="Curated and document-derived scenarios will appear here when the active corpus can support them."
                  />
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table datanew react-resource-table mb-0">
                    <thead>
                      <tr>
                        <th>Scenario</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map((scenario) => (
                        <tr
                          key={scenario.id}
                          className={
                            selectedScenarioId === scenario.id ? 'react-row-selected' : undefined
                          }
                        >
                          <td>
                            <button
                              type="button"
                              className="btn btn-link react-row-button p-0"
                              onClick={() => handleScenarioSelect(scenario.id)}
                            >
                              <span className="d-block fw-semibold">{scenario.label}</span>
                              <span className="text-muted fs-12">
                                {scenario.description}
                              </span>
                            </button>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                scenario.sourceKind === 'derived'
                                  ? 'badge-soft-info'
                                  : 'badge-soft-dark'
                              }`}
                            >
                              {scenario.sourceKind}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-xxl-5 d-flex">
          <div className="card flex-fill">
            <div className="card-header">
              <h5 className="mb-0">Replay scenario</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleReplay}>
                <div className="mb-3">
                  <label className="form-label">Locale</label>
                  <input
                    className="form-control"
                    value={replayLocale}
                    onChange={(event) => setReplayLocale(event.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Selected scenario</label>
                  <select
                    className="form-select"
                    value={selectedScenarioId}
                    onChange={(event) => handleScenarioSelect(event.target.value)}
                  >
                    <option value="">Free replay</option>
                    {scenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.label}
                      </option>
                    ))}
                  </select>
                  {selectedScenario ? (
                    <small className="text-muted">
                      {selectedScenario.sourceKind} · {selectedScenario.category} ·{' '}
                      {selectedScenario.documentTitle ?? 'manual'}
                    </small>
                  ) : null}
                </div>
                <div className="mb-3">
                  <label className="form-label">Turns</label>
                  <textarea
                    className="form-control react-large-textarea"
                    value={replayDraft}
                    onChange={(event) => setReplayDraft(event.target.value)}
                  />
                  <small className="text-muted">One user turn per line.</small>
                </div>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <p className="text-muted mb-0">
                    Replay runs the real backend pipeline and stores a normal
                    conversation under the admin test-center channel.
                  </p>
                  <button className="btn btn-dark" type="submit" disabled={replaying}>
                    <i className="ti ti-player-play me-1"></i>
                    {replaying ? 'Running...' : 'Run replay'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="col-xxl-7 d-flex">
          <div className="card flex-fill">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">Last replay result</h5>
              <button className="btn btn-light btn-sm" onClick={() => void refresh()}>
                <i className="ti ti-refresh me-1"></i>Refresh runs
              </button>
            </div>
            <div className="card-body">
              {lastReplay ? (
                <div className="react-conversation-stack">
                  {lastReplay.evaluation ? (
                    <div className="alert alert-secondary custom-react-alert" role="alert">
                      <strong>
                        Evaluation {lastReplay.evaluation.status.toUpperCase()} ·{' '}
                        {lastReplay.evaluation.overallScore}/100
                      </strong>
                      <div className="mt-2">
                        {lastReplay.evaluation.summaryLines.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {lastReplay.turns.map((turn) => (
                    <div key={turn.traceId} className="react-conversation-item">
                      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                        <strong>{turn.input}</strong>
                        <span className="badge badge-soft-info">{turn.intent}</span>
                      </div>
                      <p className="mb-2 text-muted">{turn.response}</p>
                      <small className="text-muted">
                        Trace {turn.traceId.slice(0, 12)} · conversation{' '}
                        {turn.metadata.conversationId.slice(0, 12)}
                      </small>
                      {lastReplay.evaluation?.turns[turnsIndex(lastReplay.turns, turn.traceId)] ? (
                        <div className="mt-2">
                          {renderEvaluationBadge(
                            lastReplay.evaluation.turns[
                              turnsIndex(lastReplay.turns, turn.traceId)
                            ],
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No replay executed yet"
                  body="Run a scenario to inspect real backend outcomes and generated traces."
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xxl-5 d-flex">
          <div className="card flex-fill">
            <div className="card-header">
              <h5 className="mb-0">Test-center runs</h5>
            </div>
            <div className="card-body p-0">
              {runs.length === 0 && !loading ? (
                <div className="p-4">
                  <EmptyState
                    title="No test-center runs"
                    body="Replay a scenario to create the first admin_test_center conversation."
                  />
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table datanew react-resource-table mb-0">
                    <thead>
                      <tr>
                        <th>Conversation</th>
                        <th>Traces</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run) => (
                        <tr
                          key={run.id}
                          className={selectedRunId === run.id ? 'react-row-selected' : undefined}
                        >
                          <td>
                            <button
                              type="button"
                              className="btn btn-link react-row-button p-0"
                              onClick={() => setSelectedRunId(run.id)}
                            >
                              <span className="d-block fw-semibold">{run.id.slice(0, 12)}</span>
                              <span className="text-muted fs-12">
                                {run.latestMessage ?? 'No messages'}
                              </span>
                            </button>
                          </td>
                          <td>{run.traceCount}</td>
                          <td>{formatDateTime(run.updatedAt)}</td>
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
            <div className="card-header">
              <h5 className="mb-0">Run detail</h5>
            </div>
            <div className="card-body">
              {selectedRun ? (
                <div className="row g-3">
                  <div className="col-12">
                    <div className="row">
                      <div className="col-xl-5">
                        <div className="react-resource-summary">
                          <h6>{selectedRun.conversation.id}</h6>
                          <p className="text-muted mb-3">
                            Channel {selectedRun.conversation.channel} · updated{' '}
                            {formatDateTime(selectedRun.conversation.updatedAt)}
                          </p>
                          <div className="react-meta-list">
                            <div>
                              <span className="react-meta-label">Language</span>
                              <strong>{selectedRun.conversation.language ?? 'unknown'}</strong>
                            </div>
                            <div>
                              <span className="react-meta-label">Traces</span>
                              <strong>{selectedRun.traces.length}</strong>
                            </div>
                            <div>
                              <span className="react-meta-label">Lane</span>
                              <strong>{selectedRun.state?.lane ?? 'none'}</strong>
                            </div>
                            <div>
                              <span className="react-meta-label">Missing fields</span>
                              <strong>
                                {selectedRun.state?.missingFields?.join(', ') || 'none'}
                              </strong>
                            </div>
                            <div>
                              <span className="react-meta-label">Evaluation</span>
                              <strong>
                                {selectedRun.evaluation
                                  ? `${selectedRun.evaluation.status} · ${selectedRun.evaluation.overallScore}/100`
                                  : 'not evaluated'}
                              </strong>
                            </div>
                          </div>
                          <div className="mt-3 d-flex flex-wrap gap-2">
                            <button
                              className="btn btn-dark btn-sm"
                              onClick={() => void handleEvaluateSelectedRun()}
                              disabled={!selectedScenarioId || evaluatingRun}
                            >
                              <i className="ti ti-checkup-list me-1"></i>
                              {evaluatingRun ? 'Evaluating...' : 'Evaluate selected run'}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="col-xl-7">
                        <div className="react-chat-run">
                          {selectedRun.messages.map((message) => (
                            <div
                              key={message.id}
                              className={`react-chat-message ${
                                message.role === 'USER' ? 'user' : 'assistant'
                              }`}
                            >
                              <div className="react-chat-bubble">
                                <span className="react-chat-role">{message.role}</span>
                                <p>{message.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-xl-6">
                    <div className="react-resource-summary h-100">
                      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                        <h6 className="mb-0">Continuity state</h6>
                        <span className="badge badge-soft-secondary">
                          {selectedRun.state?.lane ?? 'core'}
                        </span>
                      </div>
                      {selectedRun.state ? (
                        <JsonBlock value={selectedRun.state} />
                      ) : (
                        <EmptyState
                          title="No active continuity state"
                          body="General turns do not force task state unless backend continuity has approved facts to carry forward."
                        />
                      )}
                    </div>
                  </div>
                  <div className="col-xl-6">
                    <div className="react-resource-summary h-100">
                      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                        <h6 className="mb-0">Evaluation</h6>
                        <span className="badge badge-soft-info">
                          {selectedRun.evaluation?.status ?? 'not evaluated'}
                        </span>
                      </div>
                      {selectedRun.evaluation ? (
                        <div className="react-meta-list">
                          <div>
                            <span className="react-meta-label">Scenario</span>
                            <strong>{selectedRun.evaluation.scenarioLabel}</strong>
                          </div>
                          <div>
                            <span className="react-meta-label">Overall</span>
                            <strong>{selectedRun.evaluation.overallScore}/100</strong>
                          </div>
                          <div>
                            <span className="react-meta-label">Correctness</span>
                            <strong>{selectedRun.evaluation.correctnessScore}/100</strong>
                          </div>
                          <div>
                            <span className="react-meta-label">Coherence</span>
                            <strong>{selectedRun.evaluation.coherenceScore}/100</strong>
                          </div>
                          <div>
                            <span className="react-meta-label">Fluency</span>
                            <strong>{selectedRun.evaluation.fluencyScore}/100</strong>
                          </div>
                          <div>
                            <span className="react-meta-label">Writing</span>
                            <strong>{selectedRun.evaluation.writingQualityScore}/100</strong>
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          title="No evaluation yet"
                          body="Select a scenario and evaluate this run to score correctness, coherence, fluency, and writing quality."
                        />
                      )}
                    </div>
                  </div>
                  <div className="col-xl-12">
                    <div className="react-resource-summary h-100">
                      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                        <h6 className="mb-0">Run logs</h6>
                        <span className="badge badge-soft-dark">
                          {selectedRun.logs.length} stages
                        </span>
                      </div>
                      <div className="table-responsive react-trace-log-table">
                        <table className="table datanew mb-0">
                          <thead>
                            <tr>
                              <th>Stage</th>
                              <th>Status</th>
                              <th>Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedRun.logs.map((log) => (
                              <tr key={log.id}>
                                <td>{log.stage}</td>
                                <td>{log.status}</td>
                                <td>{formatDateTime(log.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  {selectedRun.evaluation?.turns?.length ? (
                    <div className="col-12">
                      <div className="react-resource-summary h-100">
                        <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                          <h6 className="mb-0">Turn evaluation</h6>
                          <span className="badge badge-soft-secondary">
                            {selectedRun.evaluation.turns.length} turns
                          </span>
                        </div>
                        <div className="table-responsive">
                          <table className="table datanew react-resource-table mb-0">
                            <thead>
                              <tr>
                                <th>Turn</th>
                                <th>Status</th>
                                <th>Overall</th>
                                <th>Correctness</th>
                                <th>Coherence</th>
                                <th>Fluency</th>
                                <th>Writing</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedRun.evaluation.turns.map((turn) => (
                                <tr key={`${turn.turnIndex}-${turn.traceId ?? 'none'}`}>
                                  <td>
                                    <div className="fw-semibold">#{turn.turnIndex + 1}</div>
                                    <div className="text-muted fs-12">
                                      {turn.userMessage}
                                    </div>
                                  </td>
                                  <td>
                                    <span
                                      className={`badge ${
                                        turn.status === 'pass'
                                          ? 'badge-soft-success'
                                          : turn.status === 'warn'
                                            ? 'badge-soft-warning'
                                            : 'badge-soft-danger'
                                      }`}
                                    >
                                      {turn.status}
                                    </span>
                                  </td>
                                  <td>{turn.overallScore}</td>
                                  <td>{turn.correctnessScore}</td>
                                  <td>{turn.coherenceScore}</td>
                                  <td>{turn.fluencyScore}</td>
                                  <td>{turn.writingQualityScore}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="Select a run"
                  body="Pick a test-center conversation to inspect messages, continuity state, and trace lineage."
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
              <h5 className="mb-0">Trace Explorer</h5>
              <button className="btn btn-dark btn-sm" onClick={() => void refresh()}>
                <i className="ti ti-refresh me-1"></i>Refresh traces
              </button>
            </div>
            <div className="card-body p-0">
              {traces.length === 0 && !loading ? (
                <div className="p-4">
                  <EmptyState
                    title="No traces found"
                    body="Run a replay or use the live runtime to generate traces for inspection."
                  />
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table datanew react-resource-table mb-0">
                    <thead>
                      <tr>
                        <th>Trace</th>
                        <th>Action</th>
                        <th>Last stage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traces.map((trace) => (
                        <tr
                          key={trace.traceId}
                          className={
                            selectedTraceId === trace.traceId ? 'react-row-selected' : undefined
                          }
                        >
                          <td>
                            <button
                              type="button"
                              className="btn btn-link react-row-button p-0"
                              onClick={() => setSelectedTraceId(trace.traceId)}
                            >
                              <span className="d-block fw-semibold">
                                {trace.traceId.slice(0, 12)}
                              </span>
                              <span className="text-muted fs-12">
                                {trace.response?.text?.slice(0, 52) ?? 'No response summary'}
                              </span>
                            </button>
                          </td>
                          <td>{trace.decision?.action ?? 'n/a'}</td>
                          <td>{trace.stages[trace.stages.length - 1]?.stage ?? 'n/a'}</td>
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
            <div className="card-header">
              <h5 className="mb-0">Trace detail</h5>
            </div>
            <div className="card-body">
              {selectedTrace ? (
                <div className="row">
                  <div className="col-xl-4">
                    <div className="react-resource-summary">
                      <h6>{selectedTrace.summary.traceId}</h6>
                      <p className="text-muted mb-3">
                        Conversation {selectedTrace.summary.conversationId?.slice(0, 12) ?? 'n/a'}
                      </p>
                      <div className="react-meta-list">
                        <div>
                          <span className="react-meta-label">Intent</span>
                          <strong>{selectedTrace.summary.interpretation?.intent ?? 'n/a'}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Decision</span>
                          <strong>{selectedTrace.summary.decision?.action ?? 'n/a'}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Execution</span>
                          <strong>
                            {selectedTrace.summary.execution?.ok === undefined
                              ? 'n/a'
                              : selectedTrace.summary.execution.ok
                                ? 'completed'
                                : 'failed'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-xl-8">
                    <div className="table-responsive react-trace-log-table">
                      <table className="table datanew mb-0">
                        <thead>
                          <tr>
                            <th>Stage</th>
                            <th>Status</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTrace.logs.map((log) => (
                            <tr key={log.id}>
                              <td>{log.stage}</td>
                              <td>{log.status}</td>
                              <td>{formatDateTime(log.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3">
                      <JsonBlock value={selectedTrace.logs[0]?.payload ?? {}} />
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Select a trace"
                  body="Pick a trace to inspect stage order, response outcome, and raw stage payloads."
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xxl-7 d-flex">
          <div className="card flex-fill">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">Trace comparison</h5>
              <button className="btn btn-dark btn-sm" onClick={() => void handleCompare()}>
                <i className="ti ti-git-compare me-1"></i>
                {comparing ? 'Comparing...' : 'Compare'}
              </button>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Left trace</label>
                    <select
                      className="form-select"
                      value={leftTraceId}
                      onChange={(event) => setLeftTraceId(event.target.value)}
                    >
                      <option value="">Select trace</option>
                      {traceOptions.map((trace) => (
                        <option key={trace.traceId} value={trace.traceId}>
                          {trace.traceId.slice(0, 12)} · {trace.decision?.action ?? 'n/a'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Right trace</label>
                    <select
                      className="form-select"
                      value={rightTraceId}
                      onChange={(event) => setRightTraceId(event.target.value)}
                    >
                      <option value="">Select trace</option>
                      {traceOptions.map((trace) => (
                        <option key={trace.traceId} value={trace.traceId}>
                          {trace.traceId.slice(0, 12)} · {trace.decision?.action ?? 'n/a'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              {comparison ? (
                <div className="row">
                  <div className="col-md-6 d-flex">
                    <div className="react-ops-domain-card w-100">
                      <h6>Comparison result</h6>
                      <div className="react-meta-list">
                        <div>
                          <span className="react-meta-label">Same stage sequence</span>
                          <strong>{comparison.comparison.sameStageSequence ? 'yes' : 'no'}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Same intent</span>
                          <strong>{comparison.comparison.sameIntent ? 'yes' : 'no'}</strong>
                        </div>
                        <div>
                          <span className="react-meta-label">Same response</span>
                          <strong>{comparison.comparison.sameResponse ? 'yes' : 'no'}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 d-flex">
                    <div className="react-ops-domain-card w-100">
                      <h6>Differing stages</h6>
                      <div className="react-chip-list">
                        {comparison.comparison.differingStages.length === 0 ? (
                          <span className="badge badge-soft-success">No differences</span>
                        ) : (
                          comparison.comparison.differingStages.map((stage) => (
                            <span key={stage} className="badge badge-soft-warning">
                              {stage}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No comparison yet"
                  body="Choose two traces and compare them through the backend summary contract."
                />
              )}
            </div>
          </div>
        </div>
        <div className="col-xxl-5 d-flex">
          <div className="card flex-fill">
            <div className="card-header">
              <h5 className="mb-0">Investigation resources</h5>
            </div>
            <div className="card-body">
              <div className="react-conversation-stack">
                <div className="react-conversation-item">
                  <h6 className="mb-1">Active prompts</h6>
                  <p className="mb-0 text-muted">
                    {resources.prompts.map((prompt) => `${prompt.key} v${prompt.version}`).join(', ') ||
                      'No active prompts'}
                  </p>
                </div>
                <div className="react-conversation-item">
                  <h6 className="mb-1">Date-time locale resources</h6>
                  <p className="mb-0 text-muted">
                    {resources.locales
                      .map((locale) => `${locale.locale} v${locale.version}`)
                      .join(', ') || 'No active locales'}
                  </p>
                </div>
                <div className="react-conversation-item">
                  <h6 className="mb-1">Fallback catalogs</h6>
                  <p className="mb-0 text-muted">
                    {resources.fallbacks
                      .map((catalog) => `${catalog.locale} v${catalog.version}`)
                      .join(', ') || 'No active catalogs'}
                  </p>
                </div>
                <div className="react-conversation-item">
                  <h6 className="mb-1">Knowledge metadata</h6>
                  <p className="mb-0 text-muted">
                    {resources.knowledgeMetadata
                      .map((resource) => `${resource.key} v${resource.version}`)
                      .join(', ') || 'No active knowledge metadata'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function turnsIndex(turns: ReplayResponse['turns'], traceId: string) {
  return turns.findIndex((turn) => turn.traceId === traceId);
}

function renderEvaluationBadge(
  evaluation: TestCenterConversationEvaluation['turns'][number],
) {
  return (
    <span
      className={`badge ${
        evaluation.status === 'pass'
          ? 'badge-soft-success'
          : evaluation.status === 'warn'
            ? 'badge-soft-warning'
            : 'badge-soft-danger'
      }`}
    >
      {evaluation.status} · {evaluation.overallScore}/100
    </span>
  );
}
