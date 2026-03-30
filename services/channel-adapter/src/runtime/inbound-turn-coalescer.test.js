import test from 'node:test'
import assert from 'node:assert/strict'

import {
  estimateInboundCompletionDelay,
  InboundTurnCoalescer,
} from './inbound-turn-coalescer.js'

test('estimateInboundCompletionDelay waits longer on short unfinished fragments', () => {
  const shortDelay = estimateInboundCompletionDelay({ text: 'hola' })
  const completeDelay = estimateInboundCompletionDelay({
    text: 'Hola, necesito coordinar una visita técnica.',
  })

  assert.ok(shortDelay > completeDelay)
})

test('InboundTurnCoalescer merges rapid consecutive items into a single flush', async () => {
  const coalescer = new InboundTurnCoalescer({
    quietWindowMs: 20,
    maxWindowMs: 100,
  })
  const batches = []

  const first = coalescer.enqueue(
    'conversation-1',
    { text: 'hola' },
    async (items) => {
      batches.push(items)
      return { count: items.length }
    },
    { flushDelayMs: 20 },
  )

  await new Promise((resolve) => setTimeout(resolve, 5))

  const second = coalescer.enqueue(
    'conversation-1',
    { text: 'necesito roller' },
    async (items) => {
      batches.push(items)
      return { count: items.length }
    },
    { flushDelayMs: 20 },
  )

  const [firstResult, secondResult] = await Promise.all([first, second])

  assert.equal(batches.length, 1)
  assert.equal(batches[0].length, 2)
  assert.deepEqual(firstResult, { count: 2 })
  assert.deepEqual(secondResult, { count: 2 })
})
