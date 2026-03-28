export const AGENT_STATES = {
  IDLE: 'IDLE',
  INTENT_DETECTED: 'INTENT_DETECTED',
  DRAFT_CREATED: 'DRAFT_CREATED',
  WAITING_CONFIRMATION: 'WAITING_CONFIRMATION',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  HANDED_OFF: 'HANDED_OFF',
}

export const AGENT_STATE_EVENTS = {
  RESET: 'RESET',
  DETECT_INTENT: 'DETECT_INTENT',
  BUILD_DRAFT: 'BUILD_DRAFT',
  REQUEST_CONFIRMATION: 'REQUEST_CONFIRMATION',
  START_EXECUTION: 'START_EXECUTION',
  EXECUTION_SUCCEEDED: 'EXECUTION_SUCCEEDED',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  COMPLETE: 'COMPLETE',
  HANDOFF_REQUESTED: 'HANDOFF_REQUESTED',
}

export const isAgentState = (value) =>
  Object.values(AGENT_STATES).includes(String(value || ''))

export const mapAgentStateToTaskStatus = (state) => {
  switch (state) {
    case AGENT_STATES.WAITING_CONFIRMATION:
      return 'waiting_confirmation'
    case AGENT_STATES.EXECUTING:
      return 'executing'
    case AGENT_STATES.COMPLETED:
      return 'completed'
    case AGENT_STATES.FAILED:
      return 'failed'
    case AGENT_STATES.HANDED_OFF:
      return 'handed_off'
    case AGENT_STATES.DRAFT_CREATED:
      return 'draft_created'
    case AGENT_STATES.INTENT_DETECTED:
      return 'intent_detected'
    default:
      return 'open'
  }
}
