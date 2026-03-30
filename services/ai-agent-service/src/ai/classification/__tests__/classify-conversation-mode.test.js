import test from 'node:test'
import assert from 'node:assert/strict'

import { classifyConversationMode } from '../classify-conversation-mode.js'

test('classifyConversationMode treats greetings as small_talk', () => {
  const result = classifyConversationMode({
    role: 'customer_public',
    input: 'Hola',
    inboundClassification: { category: 'greeting', confidence: 0.98 },
    analysis: { confidence: 0.95 },
    intentKey: 'customer.light',
  })

  assert.equal(result.mode, 'small_talk')
})

test('classifyConversationMode keeps product exploration in exploration mode', () => {
  const result = classifyConversationMode({
    role: 'customer_public',
    input: 'Busco de las que dejan pasar luz',
    inboundClassification: { category: 'faq_topic', confidence: 0.7 },
    analysis: {
      intent: 'customer.product_info',
      confidence: 0.68,
      conversationModeHint: 'exploration',
    },
    intentKey: 'customer.product_info',
    interpretation: {
      topic: { label: 'cortinas roller' },
      followUp: { detected: true },
    },
  })

  assert.equal(result.mode, 'exploration')
})

test('classifyConversationMode keeps clear operational requests in flow mode', () => {
  const result = classifyConversationMode({
    role: 'customer_public',
    input: 'Necesito coordinar una visita mañana de tarde',
    inboundClassification: { category: 'schedule_request', confidence: 0.9 },
    analysis: {
      intent: 'customer.schedule_request',
      confidence: 0.84,
      conversationModeHint: 'flow',
    },
    intentKey: 'customer.schedule_request',
  })

  assert.equal(result.mode, 'flow')
})

test('classifyConversationMode prefers conversation context when the turn is still being completed', () => {
  const result = classifyConversationMode({
    role: 'customer_public',
    input: 'Necesito',
    inboundClassification: { category: 'incomplete', confidence: 0.91 },
    analysis: {
      intent: 'customer.incomplete',
      confidence: 0.74,
    },
    intentKey: 'customer.incomplete',
    interpretation: {
      conversationContext: {
        mode: 'exploration',
        confidence: 0.8,
        waitForMore: true,
      },
    },
  })

  assert.equal(result.mode, 'exploration')
  assert.equal(result.reason, 'conversation_context_overrides_low_signal')
})
