import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildClosureContinuationReply,
  buildCustomerSearchFallbackText,
  resolveClosureContinuationShape,
  resolveCustomerSearchFallbackShape,
} from '../response-shaping.js'

test('resolveClosureContinuationShape selects a wording key before rendering text', () => {
  const shape = resolveClosureContinuationShape({
    previousAgentText: 'Perfecto. Cuando quieras retomarlo, seguimos por aca.',
  })

  assert.equal(shape.wordingKey, 'customer.closure.continuation_ack')
  assert.equal(shape.contract.responseKind, 'closure_continuation')
  assert.equal(buildClosureContinuationReply({ previousAgentText: 'Perfecto. Cuando quieras retomarlo, seguimos por aca.' }).text, shape.text)
})

test('resolveCustomerSearchFallbackShape builds a quote-aware fallback from wording keys and variables', () => {
  const shape = resolveCustomerSearchFallbackShape({
    firstMatch: {
      name: 'Roller blackout',
      currency: 'usd',
      amount: 123,
    },
    intentKey: 'customer.quote',
    quoteContext: {
      missingFields: ['measurements', 'quantity'],
    },
  })

  assert.equal(shape.wordingKey, 'customer.search_fallback.match_found')
  assert.equal(shape.contract.nextStep, 'quote_progress')
  assert.equal(shape.referenceTitle, 'Roller blackout')
  assert.match(shape.text, /Roller blackout/i)
  assert.match(shape.text, /USD 123/i)
  assert.match(shape.text, /medidas aproximadas|cantidad|disponibilidad/i)
  assert.equal(
    buildCustomerSearchFallbackText({
      firstMatch: {
        name: 'Roller blackout',
        currency: 'usd',
        amount: 123,
      },
      intentKey: 'customer.quote',
      quoteContext: {
        missingFields: ['measurements', 'quantity'],
      },
    }).text,
    shape.text,
  )
})

test('resolveCustomerSearchFallbackShape keeps no-match text owned by wording keys, not by agent.js', () => {
  const shape = resolveCustomerSearchFallbackShape({
    firstMatch: null,
    intentKey: 'customer.product_info',
  })

  assert.equal(shape.wordingKey, 'customer.search_fallback.no_match')
  assert.equal(shape.needsHuman, true)
  assert.equal(shape.referenceTitle, null)
  assert.match(shape.text, /No encontré|No veo una coincidencia/i)
  assert.match(shape.text, /asesor|medidas|disponibilidad/i)
})
