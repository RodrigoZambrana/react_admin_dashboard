import test from 'node:test'
import assert from 'node:assert/strict'

import { WebchatAdapter } from './webchat.adapter.js'

const createAdapter = ({ respond, options = {} } = {}) => {
  const aiCalls = []
  const replies = []
  const inboundMessages = []

  const adapter = new WebchatAdapter(
    {
      conversations: {
        createWebchatMessage: async (payload) => {
          inboundMessages.push(payload)
          return {
            conversation: {
              scope: 'customer_public',
              customerId: null,
            },
          }
        },
        replyAsAgent: async (conversationId, payload) => {
          replies.push({ conversationId, payload })
          return { conversationId, payload }
        },
      },
      ai: {
        respond: async (payload) => {
          aiCalls.push(payload)
          if (typeof respond === 'function') {
            return respond(payload, { aiCalls, replies, inboundMessages })
          }

          return {
            response: {
              finalUserText: 'Respuesta consolidada',
              provider: 'mock',
              model: 'mock-model',
              toolCalls: [],
              needsHuman: false,
              grounding: null,
            },
          }
        },
      },
    },
    {
      quietWindowMs: 20,
      maxWindowMs: 100,
      minReplyDelayMs: 0,
      maxReplyDelayMs: 0,
      ...options,
    },
  )

  return { adapter, aiCalls, replies, inboundMessages }
}

test('WebchatAdapter coalesces short consecutive inbound fragments before calling AI', async () => {
  const { adapter, aiCalls, replies, inboundMessages } = createAdapter()

  const firstResult = await adapter.handleInbound({
    conversationId: 'conv-webchat-1',
    userId: 'guest-1',
    text: 'Hola',
  })

  await new Promise((resolve) => setTimeout(resolve, 5))

  const secondResult = await adapter.handleInbound({
    conversationId: 'conv-webchat-1',
    userId: 'guest-1',
    text: 'necesito roller blackout',
  })

  assert.equal(firstResult.status, 'queued')
  assert.equal(secondResult.status, 'queued')
  assert.equal(firstResult.ai, null)
  assert.equal(secondResult.ai, null)
  assert.equal(aiCalls.length, 0)

  await new Promise((resolve) => setTimeout(resolve, 250))

  assert.equal(inboundMessages.length, 2)
  assert.equal(aiCalls.length, 1)
  assert.equal(aiCalls[0].text, 'Hola\nnecesito roller blackout')
  assert.equal(aiCalls[0].metadata?.coalescedInboundCount, 2)
  assert.equal(replies.length, 1)
  assert.equal(replies[0].payload.metadata?.coalescedInboundCount, 2)
  assert.equal(firstResult.coalescedInboundCount, 1)
  assert.equal(secondResult.coalescedInboundCount, 1)
})

test('WebchatAdapter cancels a pending delayed reply when the customer keeps completing the same quote turn', async () => {
  const { adapter, aiCalls, replies } = createAdapter({
    respond: async (payload) => ({
      response: {
        finalUserText:
          String(payload.text || '').includes('2x2')
            ? 'Perfecto, serían dos cortinas roller blackout de 2x2. Tomo los datos para cotizarte.'
            : 'Perfecto. Para avanzar con la cotización, decime también las medidas.',
        provider: 'mock',
        model: 'mock-model',
        toolCalls: [],
        needsHuman: false,
        grounding: null,
        memory: {
          conversationContext: {
            waitForMore: !String(payload.text || '').includes('2x2'),
          },
        },
        auditPayload: {
          turnInterpretation: {
            conversationContext: {
              waitForMore: !String(payload.text || '').includes('2x2'),
            },
          },
        },
      },
    }),
    options: {
      quietWindowMs: 15,
      maxWindowMs: 80,
      minReplyDelayMs: 30,
      maxReplyDelayMs: 30,
      waitForMoreReplyDelayMs: 90,
    },
  })

  await adapter.handleInbound({
    conversationId: 'conv-webchat-2',
    userId: 'guest-2',
    text: 'si, necesito dos',
  })

  await new Promise((resolve) => setTimeout(resolve, 110))

  await adapter.handleInbound({
    conversationId: 'conv-webchat-2',
    userId: 'guest-2',
    text: 'de 2x2',
  })

  await new Promise((resolve) => setTimeout(resolve, 320))

  assert.equal(aiCalls.length, 1)
  assert.match(aiCalls[0].text, /si, necesito dos[\s\S]*de 2x2/i)
  assert.equal(replies.length, 1)
  assert.match(replies[0].payload.body, /dos cortinas roller blackout de 2x2/i)
  assert.doesNotMatch(replies[0].payload.body, /decime tambi[eé]n las medidas/i)
  assert.equal(replies[0].payload.metadata?.semanticTurnInputCount, 2)
})
