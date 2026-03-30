import test from 'node:test'
import assert from 'node:assert/strict'

import { WebchatAdapter } from './webchat.adapter.js'

const createAdapter = () => {
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
    },
  )

  return { adapter, aiCalls, replies, inboundMessages }
}

test('WebchatAdapter coalesces short consecutive inbound fragments before calling AI', async () => {
  const { adapter, aiCalls, replies, inboundMessages } = createAdapter()

  const firstPromise = adapter.handleInbound({
    conversationId: 'conv-webchat-1',
    userId: 'guest-1',
    text: 'Hola',
  })

  await new Promise((resolve) => setTimeout(resolve, 5))

  const secondPromise = adapter.handleInbound({
    conversationId: 'conv-webchat-1',
    userId: 'guest-1',
    text: 'necesito roller blackout',
  })

  const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise])

  assert.equal(inboundMessages.length, 2)
  assert.equal(aiCalls.length, 1)
  assert.equal(aiCalls[0].text, 'Hola\nnecesito roller blackout')
  assert.equal(aiCalls[0].metadata?.coalescedInboundCount, 2)
  assert.equal(replies.length, 1)
  assert.equal(replies[0].payload.metadata?.coalescedInboundCount, 2)
  assert.equal(firstResult.coalescedInboundCount, 2)
  assert.equal(secondResult.coalescedInboundCount, 2)
})
