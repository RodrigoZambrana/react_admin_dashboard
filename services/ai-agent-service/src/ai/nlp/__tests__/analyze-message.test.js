import test from 'node:test'
import assert from 'node:assert/strict'

import { analyzeMessage } from '../analyze-message.js'

test('analyzeMessage falls back to heuristic interpretation when provider is unavailable', async () => {
  const result = await analyzeMessage({
    provider: null,
    role: 'customer_public',
    input: 'Necesito cortinas roller blackout',
    inboundClassification: {
      category: 'faq_topic',
      confidence: 0.82,
      suggestedIntent: 'customer.product_info',
    },
    intentKey: 'customer.product_info',
    interpretation: {
      topic: {
        label: 'cortinas roller blackout',
      },
    },
  })

  assert.equal(result.intent, 'customer.product_info')
  assert.equal(result.entities.topic, 'cortinas roller blackout')
  assert.equal(result.source, 'heuristic')
})

test('analyzeMessage returns structured interpretation when provider extraction succeeds', async () => {
  const result = await analyzeMessage({
    provider: {
      async extractStructured() {
        return {
          intent: 'customer.quote',
          confidence: 0.88,
          conversation_mode: 'flow',
          entities: {
            topic: 'roller blackout',
            quantity: 2,
          },
        }
      },
    },
    role: 'customer_public',
    input: 'Quiero 2 roller blackout de 2x2',
    allowModel: true,
  })

  assert.equal(result.intent, 'customer.quote')
  assert.equal(result.confidence, 0.88)
  assert.equal(result.conversationModeHint, 'flow')
  assert.equal(result.entities.topic, 'roller blackout')
  assert.equal(result.entities.quantity, 2)
  assert.equal(result.source, 'llm')
})

test('analyzeMessage forwards configured hybrid intent hints into the prompt', async () => {
  let capturedPrompt = ''

  await analyzeMessage({
    provider: {
      async extractStructured({ systemPrompt }) {
        capturedPrompt = systemPrompt
        return {
          intent: 'customer.quote',
          confidence: 0.82,
          conversation_mode: 'flow',
          entities: {},
        }
      },
    },
    role: 'customer_public',
    input: 'me quedó medio raro el precio final',
    allowModel: true,
    intentRegistryHints: [
      {
        id: 'quote_clarification_runtime',
        intent: 'customer.quote',
        examples: ['me quedó medio raro el precio final'],
      },
    ],
  })

  assert.match(capturedPrompt, /Hints configurados relevantes:/)
  assert.match(capturedPrompt, /quote_clarification_runtime => customer\.quote/)
})
