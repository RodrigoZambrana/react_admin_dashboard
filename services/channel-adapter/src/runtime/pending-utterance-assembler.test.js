import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PendingUtteranceAssembler,
  estimatePendingUtteranceDelay,
} from './pending-utterance-assembler.js'

test('estimatePendingUtteranceDelay closes faster once multiple fragments form a richer utterance', () => {
  const firstDelay = estimatePendingUtteranceDelay({
    items: [
      {
        normalized: {
          text: 'si, necesito dos',
        },
      },
    ],
    defaultDelayMs: 20,
  })
  const combinedDelay = estimatePendingUtteranceDelay({
    items: [
      {
        normalized: {
          text: 'si, necesito dos',
        },
      },
      {
        normalized: {
          text: 'de 2x2',
        },
      },
    ],
    defaultDelayMs: 20,
  })

  assert.ok(firstDelay > combinedDelay)
})

test('PendingUtteranceAssembler emits one semantic turn for related consecutive inputs', async () => {
  const assembler = new PendingUtteranceAssembler({
    defaultDelayMs: 20,
    maxWindowMs: 2000,
  })
  const turns = []

  const first = assembler.enqueue(
    'conversation-1',
    {
      normalized: {
        text: 'Hola',
      },
      receivedAt: '2026-03-30T00:00:00.000Z',
    },
    async (items, context) => {
      turns.push({
        items,
        context,
      })
      return {
        count: items.length,
        semanticTurnId: context.semanticTurn.id,
      }
    },
    { stabilizationDelayMs: 20 },
  )

  await new Promise((resolve) => setTimeout(resolve, 5))

  const second = assembler.enqueue(
    'conversation-1',
    {
      normalized: {
        text: 'necesito roller blackout',
      },
      receivedAt: '2026-03-30T00:00:01.000Z',
    },
    async (items, context) => {
      turns.push({
        items,
        context,
      })
      return {
        count: items.length,
        semanticTurnId: context.semanticTurn.id,
      }
    },
    { stabilizationDelayMs: 20 },
  )

  const [firstResult, secondResult] = await Promise.all([first, second])

  assert.equal(turns.length, 1)
  assert.equal(turns[0].items.length, 2)
  assert.equal(turns[0].context.semanticTurn.inputCount, 2)
  assert.equal(turns[0].context.semanticTurn.inputs[0].text, 'Hola')
  assert.equal(turns[0].context.semanticTurn.inputs[1].text, 'necesito roller blackout')
  assert.deepEqual(firstResult, secondResult)
})
