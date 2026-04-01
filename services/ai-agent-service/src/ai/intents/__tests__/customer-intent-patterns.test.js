import test from 'node:test'
import assert from 'node:assert/strict'
import {
  looksLikeCommercialConditionQuestion,
  looksLikeConfiguredProductInterest,
  looksLikeCustomerOrderStatusQuestion,
  looksLikeGenericPriceInquiry,
  looksLikeLightFilterPreferenceRequest,
  looksLikePaymentOperationalUpdate,
  looksLikePaymentProofArtifact,
  looksLikeQuoteClarificationRequest,
  looksLikeQuoteExpansionFollowUp,
  looksLikeQuoteRequirementsQuestion,
  looksLikeStructuredQuoteSeed,
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
  {
    key: 'product_family:cortina',
    label: 'cortinas',
    kind: 'product_family',
    aliases: ['cortinas', 'cortina'],
  },
  {
    key: 'product_topic:cortinas-roller',
    label: 'cortinas roller',
    kind: 'product_topic',
    aliases: ['cortinas roller', 'roller'],
    parentLabels: ['cortinas'],
    familyLabel: 'cortinas',
  },
  {
    key: 'product_variant:blackout',
    label: 'blackout',
    kind: 'product_variant',
    aliases: ['blackout'],
    parentLabels: ['cortinas roller', 'cortinas'],
    familyLabel: 'cortinas',
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

test('looksLikeQuoteClarificationRequest detects requests to clarify an already sent budget', () => {
  assert.equal(
    looksLikeQuoteClarificationRequest(
      'Sobre el presupuesto enviado no me quedó claro el total final. ¿Me lo pueden aclarar?',
    ),
    true,
  )
  assert.equal(
    looksLikeQuoteClarificationRequest('Necesito cotizar roller blackout'),
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

test('looksLikeStructuredQuoteSeed detects quote openings that already include quantity or measurements', () => {
  assert.equal(
    looksLikeStructuredQuoteSeed(
      'Necesito 2 cortinas roller blackout',
      TENANT_TAXONOMY,
    ),
    true,
  )
  assert.equal(
    looksLikeStructuredQuoteSeed(
      'Quiero una ventana de 1,20x1,20 con DVH',
      TENANT_TAXONOMY,
    ),
    true,
  )
  assert.equal(
    looksLikeStructuredQuoteSeed('Necesito cortinas roller', TENANT_TAXONOMY),
    false,
  )
})

test('looksLikeCommercialConditionQuestion detects side questions about installation or shipping conditions', () => {
  assert.equal(looksLikeCommercialConditionQuestion('¿Incluye instalación?'), true)
  assert.equal(
    looksLikeCommercialConditionQuestion(
      'Yo necesito sin instalación, la hacemos nosotros. ¿El precio es el mismo?',
    ),
    true,
  )
  assert.equal(
    looksLikeCommercialConditionQuestion('¿La garantía viene incluida?'),
    true,
  )
  assert.equal(
    looksLikeCommercialConditionQuestion('¿Qué medios de pago aceptan?'),
    false,
  )
  assert.equal(
    looksLikeCommercialConditionQuestion(
      'Quería presupuesto de cortinas venecianas de aluminio sin instalación',
    ),
    false,
  )
})

test('looksLikeLightFilterPreferenceRequest detects light-filter needs without treating bare pasar as enough', () => {
  assert.equal(
    looksLikeLightFilterPreferenceRequest('si busco de las que dejan pasar luz'),
    true,
  )
  assert.equal(
    looksLikeLightFilterPreferenceRequest('quiero algo donde entre luz'),
    true,
  )
  assert.equal(
    looksLikeLightFilterPreferenceRequest('cuando pueden pasar'),
    false,
  )
})

test('looksLikeCustomerOrderStatusQuestion separates order tracking from delivery-time FAQs', () => {
  assert.equal(
    looksLikeCustomerOrderStatusQuestion('¿Cómo viene mi pedido?'),
    true,
  )
  assert.equal(
    looksLikeCustomerOrderStatusQuestion('Hola, ok, qeu tiempo de entrega tiene?'),
    false,
  )
})

test('looksLikeQuoteClarificationRequest does not confuse structured quote submissions with total item counts', () => {
  assert.equal(
    looksLikeQuoteClarificationRequest(
      'Agradezco si me pueden enviar presupuesto por las siguientes aberturas 220 x 180, 120 x 180 y total: 6 aberturas',
    ),
    false,
  )
})

test('looksLikePaymentOperationalUpdate detects payment completion and proof follow-ups as operational continuity', () => {
  assert.equal(looksLikePaymentOperationalUpdate('Hola, ya hice el pago'), true)
  assert.equal(looksLikePaymentOperationalUpdate('Te transferí recién'), true)
  assert.equal(
    looksLikePaymentOperationalUpdate('Perfecto, te mando comprobante'),
    true,
  )
  assert.equal(
    looksLikePaymentOperationalUpdate('¿Qué medios de pago aceptan?'),
    false,
  )
  assert.equal(
    looksLikePaymentOperationalUpdate('¿Puedo abonar con débito o transferencia?'),
    false,
  )
})

test('looksLikePaymentProofArtifact detects standalone proof filenames as operational continuity', () => {
  assert.equal(
    looksLikePaymentProofArtifact(
      'Comprobante_TransferenciaTercerosEnElBanco_16_02_2026_12_43.pdf',
    ),
    true,
  )
  assert.equal(looksLikePaymentProofArtifact('catalogo_roller_blackout.pdf'), false)
})

test('looksLikeQuoteExpansionFollowUp detects add-one-more turns inside quote conversations', () => {
  assert.equal(
    looksLikeQuoteExpansionFollowUp(
      'Tengo que pasarte un roller más',
      TENANT_TAXONOMY,
    ),
    true,
  )
  assert.equal(
    looksLikeQuoteExpansionFollowUp('Quiero saber si trabajan con roller', TENANT_TAXONOMY),
    false,
  )
})
