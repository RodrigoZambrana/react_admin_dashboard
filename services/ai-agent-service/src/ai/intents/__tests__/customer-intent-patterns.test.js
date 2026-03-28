import test from 'node:test'
import assert from 'node:assert/strict'
import {
  looksLikeCommercialConditionQuestion,
  looksLikeConfiguredProductInterest,
  looksLikeGenericPriceInquiry,
  looksLikeQuoteRequirementsQuestion,
  looksLikeQuoteWaitingFollowUp,
} from '../customer-intent-patterns.js'

const TENANT_TAXONOMY = [
  {
    key: 'product_family:abertura',
    label: 'aberturas',
    kind: 'product_family',
    aliases: ['aberturas', 'abertura', 'ventana', 'ventanas'],
  },
  {
    key: 'product_variant:dvh',
    label: 'dvh',
    kind: 'product_variant',
    aliases: ['dvh', 'doble vidrio', 'doble vidrio hermetico'],
    parentLabels: ['aberturas'],
    familyLabel: 'aberturas',
  },
]

test('looksLikeGenericPriceInquiry detects broader commercial wording beyond precio/precios', () => {
  assert.equal(looksLikeGenericPriceInquiry('¿Cuánto vale?'), true)
  assert.equal(
    looksLikeGenericPriceInquiry('Me podés pasar el importe aproximado?'),
    true,
  )
  assert.equal(looksLikeGenericPriceInquiry('Necesito cotizar una opción'), true)
})

test('looksLikeGenericPriceInquiry does not confuse bare courtesy wording with pricing', () => {
  assert.equal(looksLikeGenericPriceInquiry('vale'), false)
  assert.equal(looksLikeGenericPriceInquiry('ok vale gracias'), false)
})

test('looksLikeQuoteRequirementsQuestion detects quote preparation questions without treating them as product topics', () => {
  assert.equal(
    looksLikeQuoteRequirementsQuestion('¿Qué datos necesitas para cotizar?'),
    true,
  )
  assert.equal(
    looksLikeQuoteRequirementsQuestion('quiero cotizar aberturas'),
    false,
  )
})

test('looksLikeQuoteWaitingFollowUp detects wait-for-quote acknowledgements without treating them as new quote requests', () => {
  assert.equal(looksLikeQuoteWaitingFollowUp('Espero el presupuesto'), true)
  assert.equal(
    looksLikeQuoteWaitingFollowUp('Quedo a la espera de la cotización'),
    true,
  )
  assert.equal(
    looksLikeQuoteWaitingFollowUp('Necesito cotizar roller blackout'),
    false,
  )
})

test('looksLikeConfiguredProductInterest detects configured interest with tenant topic hints', () => {
  assert.equal(
    looksLikeConfiguredProductInterest(
      'me interesa ventana doble vidrio color negro',
      TENANT_TAXONOMY,
    ),
    true,
  )
  assert.equal(
    looksLikeConfiguredProductInterest('quiero saber que es dvh', TENANT_TAXONOMY),
    false,
  )
})

test('looksLikeCommercialConditionQuestion detects side questions about installation or shipping conditions', () => {
  assert.equal(looksLikeCommercialConditionQuestion('¿Incluye instalación?'), true)
  assert.equal(
    looksLikeCommercialConditionQuestion('¿La garantía viene incluida?'),
    true,
  )
  assert.equal(
    looksLikeCommercialConditionQuestion('¿Qué medios de pago aceptan?'),
    false,
  )
})
