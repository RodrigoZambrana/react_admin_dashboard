import test from 'node:test'
import assert from 'node:assert/strict'
import { applyAgentStateEvents } from '../transition-state.js'

test('applyAgentStateEvents initializes a reset task and transitions to waiting confirmation', () => {
  const next = applyAgentStateEvents(
    null,
    ['DETECT_INTENT', 'BUILD_DRAFT', 'REQUEST_CONFIRMATION'],
    {
      at: '2026-03-26T21:00:00.000Z',
      reset: true,
    },
  )

  assert.equal(next.state, 'WAITING_CONFIRMATION')
  assert.deepEqual(next.stateHistory, [
    'IDLE',
    'INTENT_DETECTED',
    'DRAFT_CREATED',
    'WAITING_CONFIRMATION',
  ])
  assert.equal(next.currentTaskStatus, 'waiting_confirmation')
})

test('applyAgentStateEvents advances an existing task through execution to completed', () => {
  const next = applyAgentStateEvents(
    {
      state: 'WAITING_CONFIRMATION',
      stateHistory: ['IDLE', 'INTENT_DETECTED', 'DRAFT_CREATED', 'WAITING_CONFIRMATION'],
      lastTransitionAt: '2026-03-26T20:59:00.000Z',
    },
    ['START_EXECUTION', 'EXECUTION_SUCCEEDED'],
    {
      at: '2026-03-26T21:01:00.000Z',
    },
  )

  assert.equal(next.state, 'COMPLETED')
  assert.deepEqual(next.stateHistory, [
    'IDLE',
    'INTENT_DETECTED',
    'DRAFT_CREATED',
    'WAITING_CONFIRMATION',
    'EXECUTING',
    'COMPLETED',
  ])
  assert.equal(next.currentTaskStatus, 'completed')
})
