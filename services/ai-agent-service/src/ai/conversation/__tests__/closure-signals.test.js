import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateConversationTopicOverlap,
  extractConversationTopicTokens,
  hasExplicitConversationReset,
  looksLikeAddressOrTimeReply,
  looksLikeClosureContinuationResponse,
  looksLikeCoordinationAskResponse,
  looksLikeCustomerFollowUp,
  looksLikeLightClosureFollowUp,
  looksLikeOperationalStatusContinuation,
  looksLikeQuoteDetailFollowUp,
  looksLikeShortContextualFollowUp,
} from '../closure-signals.js'

test('extractConversationTopicTokens removes generic stopwords from conversational topics', () => {
  const tokens = extractConversationTopicTokens(
    'Hola, necesito precio de cortinas roller blackout',
  )

  assert.ok(tokens.includes('roller'))
  assert.ok(tokens.includes('blackout'))
  assert.ok(!tokens.includes('hola'))
  assert.ok(!tokens.includes('necesito'))
})

test('closure signal patterns detect light deferrals and already-open closures', () => {
  assert.equal(looksLikeLightClosureFollowUp('Lo veo y te aviso'), true)
  assert.equal(
    looksLikeClosureContinuationResponse(
      'Perfecto. Cuando quieras retomarlo, seguimos por aca.',
    ),
    true,
  )
})

test('detail follow-up signals keep product detail but ignore courtesy-only replies', () => {
  assert.equal(looksLikeCustomerFollowUp('ese mismo'), true)
  assert.equal(looksLikeShortContextualFollowUp('y cuanto demora'), true)
  assert.equal(looksLikeQuoteDetailFollowUp('gala blanca'), true)
  assert.equal(looksLikeQuoteDetailFollowUp('gracias'), false)
})

test('operational continuation signals recognize address, timing and explicit resets', () => {
  assert.equal(
    looksLikeOperationalStatusContinuation('Mañana a las 15 te paso la direccion'),
    true,
  )
  assert.equal(looksLikeAddressOrTimeReply('Av Italia 1234'), true)
  assert.equal(
    looksLikeCoordinationAskResponse(
      'Si queres, pasame zona o direccion y dia u horario.',
    ),
    true,
  )
  assert.equal(hasExplicitConversationReset('Por otro lado tengo otra consulta'), true)
  assert.equal(
    calculateConversationTopicOverlap(['roller', 'blackout'], ['roller', 'screen']) > 0,
    true,
  )
})
