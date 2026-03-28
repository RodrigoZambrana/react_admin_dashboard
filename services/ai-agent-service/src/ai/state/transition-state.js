import {
  AGENT_STATES,
  AGENT_STATE_EVENTS,
  isAgentState,
  mapAgentStateToTaskStatus,
} from './state-types.js'

const EVENT_TO_STATE = {
  [AGENT_STATE_EVENTS.RESET]: AGENT_STATES.IDLE,
  [AGENT_STATE_EVENTS.DETECT_INTENT]: AGENT_STATES.INTENT_DETECTED,
  [AGENT_STATE_EVENTS.BUILD_DRAFT]: AGENT_STATES.DRAFT_CREATED,
  [AGENT_STATE_EVENTS.REQUEST_CONFIRMATION]: AGENT_STATES.WAITING_CONFIRMATION,
  [AGENT_STATE_EVENTS.START_EXECUTION]: AGENT_STATES.EXECUTING,
  [AGENT_STATE_EVENTS.EXECUTION_SUCCEEDED]: AGENT_STATES.COMPLETED,
  [AGENT_STATE_EVENTS.EXECUTION_FAILED]: AGENT_STATES.FAILED,
  [AGENT_STATE_EVENTS.COMPLETE]: AGENT_STATES.COMPLETED,
  [AGENT_STATE_EVENTS.HANDOFF_REQUESTED]: AGENT_STATES.HANDED_OFF,
}

const normalizeStateHistory = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return [AGENT_STATES.IDLE]
  }

  const filtered = value.filter((entry) => isAgentState(entry))
  return filtered.length ? filtered : [AGENT_STATES.IDLE]
}

export const transitionAgentState = (
  taskState,
  event,
  { at = new Date().toISOString(), reset = false } = {},
) => {
  const previousState =
    !reset && isAgentState(taskState?.state) ? taskState.state : AGENT_STATES.IDLE
  const previousHistory =
    !reset && taskState?.stateHistory
      ? normalizeStateHistory(taskState.stateHistory)
      : [AGENT_STATES.IDLE]
  const targetState = EVENT_TO_STATE[event] || previousState
  const stateHistory =
    previousHistory[previousHistory.length - 1] === targetState
      ? previousHistory
      : [...previousHistory, targetState]

  return {
    state: targetState,
    stateHistory,
    lastTransitionAt: at,
    currentTaskStatus: mapAgentStateToTaskStatus(targetState),
  }
}

export const applyAgentStateEvents = (
  taskState,
  events = [],
  { at = new Date().toISOString(), reset = false } = {},
) => {
  let current = transitionAgentState(taskState, AGENT_STATE_EVENTS.RESET, {
    at,
    reset,
  })

  if (!reset) {
    current = {
      state: isAgentState(taskState?.state) ? taskState.state : AGENT_STATES.IDLE,
      stateHistory: normalizeStateHistory(taskState?.stateHistory),
      lastTransitionAt:
        typeof taskState?.lastTransitionAt === 'string' ? taskState.lastTransitionAt : at,
      currentTaskStatus: mapAgentStateToTaskStatus(
        isAgentState(taskState?.state) ? taskState.state : AGENT_STATES.IDLE,
      ),
    }
  }

  for (const event of events) {
    current = transitionAgentState(
      {
        state: current.state,
        stateHistory: current.stateHistory,
        lastTransitionAt: current.lastTransitionAt,
      },
      event,
      { at },
    )
  }

  return current
}
