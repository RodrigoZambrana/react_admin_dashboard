import test from 'node:test'
import assert from 'node:assert/strict'

import { decideNextStep } from '../decide-next-step.js'

test('decideNextStep routes exploration to conversational mode', () => {
  const result = decideNextStep({
    role: 'customer_public',
    conversationMode: { mode: 'exploration' },
    deterministicResponse: { text: 'draft' },
    intentKey: 'customer.product_info',
  })

  assert.equal(result.nextStep, 'conversational_mode')
  assert.equal(result.shouldUseDeterministicDraft, true)
  assert.equal(result.shouldGenerateLanguage, true)
})

test('decideNextStep routes unclear turns to clarification', () => {
  const result = decideNextStep({
    role: 'customer_public',
    conversationMode: { mode: 'unclear' },
    deterministicResponse: null,
  })

  assert.equal(result.nextStep, 'ask_clarification')
})

test('decideNextStep keeps wait-for-more turns in conversational mode instead of forcing flow', () => {
  const result = decideNextStep({
    role: 'customer_public',
    conversationMode: { mode: 'unclear' },
    deterministicResponse: { text: 'draft' },
    interpretation: {
      conversationContext: {
        waitForMore: true,
        responseStrategy: 'hold_for_more_context',
        nextUsefulField: 'issue',
      },
    },
  })

  assert.equal(result.nextStep, 'conversational_mode')
  assert.equal(result.shouldGenerateLanguage, true)
  assert.equal(result.reason, 'wait_for_more_context')
})

test('decideNextStep can use a high-confidence assistant recommendation to stay conversational instead of forcing flow', () => {
  const result = decideNextStep({
    role: 'customer_public',
    conversationMode: { mode: 'flow' },
    deterministicResponse: { text: 'draft' },
    intentKey: 'customer.quote',
    interpretation: {
      conversationContext: {
        nextUsefulField: 'measurements',
      },
    },
    assistantDecision: {
      action: 'conversational_mode',
      confidence: 0.91,
      reasoning: 'el cliente todavía está explorando',
      missingFields: ['measurements'],
    },
  })

  assert.equal(result.nextStep, 'conversational_mode')
  assert.equal(result.assistantSuggestion?.applied, true)
  assert.match(result.reason, /assistant_override/)
})

test('decideNextStep reads wait-for-more from resolutionReadiness when present', () => {
  const result = decideNextStep({
    role: 'customer_public',
    conversationMode: { mode: 'flow' },
    deterministicResponse: { text: 'draft' },
    interpretation: {
      resolutionReadiness: {
        lane: 'quote',
        turnIntent: 'customer.quote',
        waitForMore: true,
        nextUsefulField: 'color',
        answerMode: 'hold_for_more_context',
        mode: 'exploration',
      },
    },
  })

  assert.equal(result.nextStep, 'conversational_mode')
  assert.equal(result.reason, 'wait_for_more_context')
})
