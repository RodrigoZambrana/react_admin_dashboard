import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getWordingTemplateMeta,
  pickWordingVariant,
} from '../wording-registry.js'

test('pickWordingVariant supports structured runtime response templates', () => {
  const text = pickWordingVariant({
    key: 'customer.support.review_visit_payment',
    variationSeed: 'conv-1',
    registry: {
      'customer.support.review_visit_payment': {
        messages: [
          'Claro. Lo revisamos y coordinamos por acá. Si querés, pasame la dirección y un teléfono.',
        ],
        goal: 'Mantener una propuesta de revisión técnica simple.',
        allowHybridRewrite: true,
        mustAskQuestion: true,
        maxChars: 180,
      },
    },
  })

  assert.equal(
    text,
    'Claro. Lo revisamos y coordinamos por acá. Si querés, pasame la dirección y un teléfono.',
  )
})

test('getWordingTemplateMeta merges configured template metadata over defaults', () => {
  const meta = getWordingTemplateMeta({
    key: 'customer.product.info_offer',
    registry: {
      'customer.product.info_offer': {
        messages: ['Sí, trabajamos con {topic}.'],
        goal: 'Responder disponibilidad sin repetir wording fijo.',
        allowHybridRewrite: true,
        maxChars: 180,
      },
    },
  })

  assert.equal(meta.goal, 'Responder disponibilidad sin repetir wording fijo.')
  assert.equal(meta.allowHybridRewrite, true)
  assert.equal(meta.maxChars, 180)
})

test('pickWordingVariant resolves channel-specific profiles when available', () => {
  const text = pickWordingVariant({
    key: 'customer.support.review_visit_payment',
    variationSeed: 'email-conv-1',
    channel: 'email',
  })

  assert.match(text, /respondeme|direcci[oó]n|tel[eé]fono/i)
  assert.doesNotMatch(text, /pasame la direcci[oó]n/i)
})

test('pickWordingVariant loads closure and published-search wording from language policy', () => {
  const closureText = pickWordingVariant({
    key: 'customer.closure.continuation_open',
  })
  const fallbackText = pickWordingVariant({
    key: 'customer.search_fallback.match_found',
    variables: {
      productName: 'Roller blackout',
    },
  })

  assert.match(closureText, /retomarlo|seguimos por ac[aá]|este medio/i)
  assert.match(fallbackText, /Roller blackout/i)
  assert.match(fallbackText, /coincidencia publicada/i)
})
