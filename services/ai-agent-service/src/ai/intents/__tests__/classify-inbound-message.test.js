import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyInboundMessage } from '../classify-inbound-message.js'

const TENANT_TOPIC_TAXONOMY = [
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
    familyLabel: 'cortinas',
  },
  {
    key: 'product_variant:blackout',
    label: 'blackout',
    kind: 'product_variant',
    aliases: ['blackout'],
    familyLabel: 'cortinas',
    parentLabels: ['cortinas roller', 'cortinas'],
  },
]

const TENANT_RUNTIME_POLICY = {
  vocabulary: {
    supportComponentTerms: ['cinta', 'enrollador', 'lama', 'motor', 'guia', 'guía'],
    productContextTerms: [
      'cortina',
      'cortinas',
      'persiana',
      'persianas',
      'roller',
      'pvc',
      'ventana',
      'ventanas',
      'abertura',
      'aberturas',
    ],
    catalogCarrierTerms: [
      'ventana',
      'ventanas',
      'abertura',
      'aberturas',
      'marco',
      'marcos',
      'guia',
      'guía',
      'guias',
      'guías',
      'hoja',
      'hojas',
      'paño',
      'pano',
    ],
    catalogStructuralTerms: [
      'corrediza',
      'corredizas',
      'fija',
      'fijas',
      'pvc',
      'hierro',
      'vidrio',
      'hoja',
      'hojas',
      'paño',
      'pano',
    ],
    catalogStructuralPhrases: ['hojas corredizas', 'paño fijo', 'pano fijo'],
  },
  businessRules: {
    installationTerms: ['instalacion', 'instalación', 'colocacion', 'colocación'],
  },
}

test('classifyInboundMessage detects incomplete customer requests', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'quiero',
  })

  assert.equal(result.category, 'incomplete')
  assert.equal(result.suggestedIntent, 'customer.incomplete')
})

test('classifyInboundMessage detects multi-intent customer requests', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Hola, quiero agendar una visita y también saber precios',
  })

  assert.equal(result.category, 'multi_intent')
  assert.equal(result.suggestedIntent, 'customer.multi_intent')
  assert.deepEqual(
    result.focusAreas.map((entry) => entry.key),
    ['appointment', 'pricing'],
  )
})

test('classifyInboundMessage detects sensitive customer complaints', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Estoy muy molesto, nadie me responde',
  })

  assert.equal(result.category, 'sensitive')
  assert.equal(result.suggestedIntent, 'customer.sensitive')
})

test('classifyInboundMessage detects out-of-scope customer messages', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: '¿Quién ganó el clásico?',
  })

  assert.equal(result.category, 'out_of_scope')
  assert.equal(result.suggestedIntent, 'customer.out_of_scope')
})

test('classifyInboundMessage detects direct contact requests', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: '¿Tienen teléfono?',
  })

  assert.equal(result.category, 'contact')
  assert.equal(result.suggestedIntent, 'customer.contact_info')
})

test('classifyInboundMessage does not confuse lead-intro phrasing with contact faq', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input:
      'Hola, te contacto desde la web de urucortinas: Buen día. Necesito saber por favor si hacen trabajos a medida con colocación. Gracias',
  })

  assert.notEqual(result.category, 'contact')
  assert.notEqual(result.suggestedIntent, 'customer.contact_info')
})

test('classifyInboundMessage upgrades made-to-measure plus installation lead intros to service capability info instead of generic clarification', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input:
      'Hola, te contacto desde la web de urucortinas: Buen día. Necesito saber por favor si hacen trabajos a medida con colocación. Gracias',
  })

  assert.equal(result.category, 'faq_topic')
  assert.equal(result.suggestedIntent, 'customer.topic_info')
  assert.ok(result.decisionPath.includes('classifier:service_capability_question'))
})

test('classifyInboundMessage treats a bare web lead intro as a clarification seed instead of contact info', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Hola, te contacto desde la web de urucortinas:',
  })

  assert.equal(result.category, 'generic_help_request')
  assert.equal(result.suggestedIntent, 'customer.clarify_request')
})

test('classifyInboundMessage does not treat a lead intro plus operational content as a bare clarification seed', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input:
      'Hola, te contacto desde la web de urucortinas: Preciso vengan a mi domicilio para una cotización. Preciso cambiar o reparar la ventana del baño. ¿Cuándo podrían venir?',
  })

  assert.notEqual(result.category, 'generic_help_request')
  assert.notEqual(result.suggestedIntent, 'customer.clarify_request')
})

test('classifyInboundMessage upgrades replacement budgeting requests to quote intent', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Quisiera cambiar las persianas de mi casa, que datos necesitan para presupuestar?',
    tenantRuntimePolicy: TENANT_RUNTIME_POLICY,
  })

  assert.equal(result.category, 'price_inquiry')
  assert.equal(result.suggestedIntent, 'customer.quote')
  assert.ok(result.decisionPath.includes('classifier:replacement_quote_request'))
})

test('classifyInboundMessage upgrades structured product-interest turns with quantity into quote intake', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Necesito 2 cortinas roller blackout',
    tenantTopicTaxonomy: TENANT_TOPIC_TAXONOMY,
  })

  assert.equal(result.category, 'price_inquiry')
  assert.equal(result.suggestedIntent, 'customer.quote')
  assert.ok(result.decisionPath.includes('classifier:structured_quote_seed'))
})

test('classifyInboundMessage treats address and phone payload as schedule follow-up when recent context is operational', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Es en avenida italia 1428. A las 14 estoy en casa. Mi teléfono es 099123456.',
    recentTurns: [
      {
        role: 'customer',
        text: 'Necesito saber si hacen trabajos a medida con colocación.',
      },
    ],
  })

  assert.equal(result.category, 'schedule_request')
  assert.equal(result.suggestedIntent, 'customer.schedule_request')
  assert.ok(
    result.decisionPath.includes('classifier:schedule_request_contextual_followup'),
  )
})

test('classifyInboundMessage keeps short product identification turns inside a recent support thread', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'es una persiana de pvc',
    tenantRuntimePolicy: TENANT_RUNTIME_POLICY,
    recentTurns: [
      { role: 'customer', text: 'Hola reparan cortinas de enrollar?' },
      {
        role: 'agent',
        text: 'Claro. Si necesitás una revisión o ajuste, contame qué producto es y qué habría que revisar, y coordinamos cómo seguir.',
      },
    ],
  })

  assert.equal(result.category, 'support_request')
  assert.equal(result.suggestedIntent, 'customer.support_request')
  assert.ok(result.decisionPath.includes('classifier:support_request'))
})

test('classifyInboundMessage requires authentication for protected customer documents in public scope', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Necesito saber el estado de mi pedido ORD-000154',
  })

  assert.equal(result.category, 'auth_required')
  assert.equal(result.suggestedIntent, 'customer.auth_required')
  assert.equal(result.documentType, 'ORDER')
  assert.equal(result.identifier, '154')
})

test('classifyInboundMessage detects owned document requests for authenticated customers', () => {
  const result = classifyInboundMessage({
    role: 'customer_authenticated',
    input: 'Necesito saber el estado de mi pedido ORD-000154',
  })

  assert.equal(result.category, 'owned_document_request')
  assert.equal(result.suggestedIntent, 'customer.owned_document_request')
  assert.equal(result.documentType, 'ORDER')
  assert.equal(result.identifier, '154')
})

test('classifyInboundMessage does not confuse generic quote requests with protected owned documents', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input:
      'Quiero cotización para una corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120.',
  })

  assert.notEqual(result.category, 'auth_required')
  assert.notEqual(result.suggestedIntent, 'customer.auth_required')
})

test('classifyInboundMessage keeps invoices and addresses inside private account flows', () => {
  const result = classifyInboundMessage({
    role: 'customer_authenticated',
    input: 'Quiero ver mi dirección de entrega y mis facturas',
  })

  assert.equal(result.category, 'private_account_data')
  assert.equal(result.suggestedIntent, 'customer.private_account_data')
})

test('classifyInboundMessage detects combined greetings before the model path', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Hola buenos días',
  })

  assert.equal(result.category, 'greeting')
  assert.equal(result.suggestedIntent, 'customer.light')
})

test('classifyInboundMessage detects generic price inquiries', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'buenas nesecito saver precios',
  })

  assert.equal(result.category, 'price_inquiry')
  assert.equal(result.suggestedIntent, 'customer.price_inquiry')
})

test('classifyInboundMessage detects broader price idioms such as importe aproximado', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'me podés pasar el importe aproximado?',
  })

  assert.equal(result.category, 'price_inquiry')
  assert.equal(result.suggestedIntent, 'customer.price_inquiry')
})

test('classifyInboundMessage recognizes typoed aberturas topic inquiries as faq_topic instead of generic help', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'quiero saber sobre abertruas en aluminio',
  })

  assert.equal(result.category, 'faq_topic')
  assert.equal(result.suggestedIntent, 'customer.topic_info')
})

test('classifyInboundMessage treats punctuation-only customer input as noise before the provider path', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: '!!!???###',
  })

  assert.equal(result.category, 'noise')
  assert.equal(result.suggestedIntent, 'customer.unintelligible')
  assert.ok(result.decisionPath.includes('classifier:noise'))
})

test('classifyInboundMessage keeps empty customer input as incomplete rather than noise', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: '',
  })

  assert.equal(result.category, 'incomplete')
  assert.equal(result.suggestedIntent, 'customer.incomplete')
  assert.ok(result.decisionPath.includes('classifier:empty_input'))
})

test('classifyInboundMessage treats standalone attachment artifact labels as incomplete context rather than product content', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'PTT-20260306-WA0007.opus (archivo adjunto)',
  })

  assert.equal(result.category, 'incomplete')
  assert.equal(result.suggestedIntent, 'customer.incomplete')
  assert.ok(result.decisionPath.includes('classifier:attachment_artifact_only'))
})

test('classifyInboundMessage detects courtesy and acknowledgements without pending confirmation', () => {
  const thanks = classifyInboundMessage({
    role: 'customer_public',
    input: 'gracias',
  })
  const ack = classifyInboundMessage({
    role: 'customer_public',
    input: 'ok',
  })

  assert.equal(thanks.category, 'courtesy')
  assert.equal(thanks.suggestedIntent, 'customer.light')
  assert.equal(ack.category, 'courtesy')
  assert.equal(ack.suggestedIntent, 'customer.light')
})

test('classifyInboundMessage treats polite declines as courtesy instead of reopening another operational flow', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'no es necesario gracias',
  })

  assert.equal(result.category, 'courtesy')
  assert.equal(result.suggestedIntent, 'customer.light')
})

test('classifyInboundMessage keeps broad family price questions in deterministic price guidance', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'precios cortnas',
  })

  assert.equal(result.category, 'price_inquiry')
  assert.equal(result.suggestedIntent, 'customer.price_inquiry')
})

test('classifyInboundMessage keeps quote requirement questions in price guidance without inventing a product topic', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'que datos necesitas para cotizar',
  })

  assert.equal(result.category, 'price_inquiry')
  assert.equal(result.suggestedIntent, 'customer.price_inquiry')
})

test('classifyInboundMessage detects post-sale service requests without treating them as generic frustration', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input:
      'Tengo instaladas unas cortinas con motor que necesitan service. Una dejó de funcionar y otra queremos moverla a otra ventana.',
  })

  assert.equal(result.category, 'support_request')
  assert.equal(result.suggestedIntent, 'customer.support_request')
  assert.ok(result.decisionPath.includes('classifier:support_request'))
})

test('classifyInboundMessage treats payment proof follow-ups as operational support instead of sales', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Te adjunto comprobante de pago para que lo revisen',
  })

  assert.equal(result.category, 'support_request')
  assert.equal(result.suggestedIntent, 'customer.support_request')
  assert.ok(
    result.decisionPath.includes('classifier:payment_followup_support_request'),
  )
})

test('classifyInboundMessage treats initial payment completion updates as operational support instead of product or faq flow', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Hola, ya hice el pago',
  })

  assert.equal(result.category, 'support_request')
  assert.equal(result.suggestedIntent, 'customer.support_request')
  assert.ok(result.decisionPath.includes('classifier:payment_operational_update'))
})

test('classifyInboundMessage treats standalone payment proof filenames as operational support continuity', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Comprobante_TransferenciaTercerosEnElBanco_16_02_2026_12_43.pdf',
  })

  assert.equal(result.category, 'support_request')
  assert.equal(result.suggestedIntent, 'customer.support_request')
  assert.ok(result.decisionPath.includes('classifier:payment_proof_artifact'))
})

test('classifyInboundMessage switches to support when a quote thread pivots to component replacement service', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'y solo cambio de enrollador/cinta cuanto saldria?',
    tenantRuntimePolicy: TENANT_RUNTIME_POLICY,
    recentTurns: [
      { role: 'customer', text: 'Quiero presupuesto para persianas en un apto' },
      {
        role: 'agent',
        text: 'Claro. Para prepararte un presupuesto de persianas, decime las medidas aproximadas (ancho por alto) y cuántas unidades necesitás.',
      },
      { role: 'customer', text: 'Y para cambiar enrollador y cinta de otra persiana también' },
    ],
  })

  assert.equal(result.category, 'support_request')
  assert.equal(result.suggestedIntent, 'customer.support_request')
  assert.ok(result.decisionPath.includes('classifier:support_request'))
})

test('classifyInboundMessage detects scheduling availability requests tied to visits or installation', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input:
      'Buenas tardes. ¿Cuándo tendrán disponibilidad para hacer la instalación? Me sirve después de las 17.',
    tenantRuntimePolicy: TENANT_RUNTIME_POLICY,
  })

  assert.equal(result.category, 'schedule_request')
  assert.equal(result.suggestedIntent, 'customer.schedule_request')
  assert.ok(result.decisionPath.includes('classifier:schedule_request'))
})

test('classifyInboundMessage does not route light-filter product wording to scheduling just because it includes pasar', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'si busco de las que dejan pasar luz',
  })

  assert.notEqual(result.category, 'schedule_request')
  assert.notEqual(result.suggestedIntent, 'customer.schedule_request')
})

test('classifyInboundMessage treats quote-expansion follow-ups as quote continuity instead of generic product info', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Tengo que pasarte un roller más',
    tenantTopicTaxonomy: [
      {
        key: 'product_topic:cortinas-roller',
        label: 'cortinas roller',
        kind: 'product_topic',
        aliases: ['cortinas roller', 'roller'],
        familyLabel: 'cortinas',
      },
    ],
  })

  assert.equal(result.category, 'price_inquiry')
  assert.equal(result.suggestedIntent, 'customer.quote')
  assert.ok(result.decisionPath.includes('classifier:quote_expansion_followup'))
})

test('classifyInboundMessage treats structural opening descriptions with measurements as quote requests', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input:
      'Son 2,90 x 2,60 total. Las hojas corredizas son de 1,45 x 2,00 y las fijas de arriba 1,45 x 0,60 aprox.',
    tenantRuntimePolicy: TENANT_RUNTIME_POLICY,
  })

  assert.equal(result.category, 'price_inquiry')
  assert.equal(result.suggestedIntent, 'customer.quote')
  assert.ok(result.decisionPath.includes('classifier:catalog_structure_quote'))
})

test('classifyInboundMessage does not mistake good-afternoon greetings plus installation conditions for scheduling', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input:
      'Buenas tardes. Era para ver un presupuesto para sustituir esta ventana de hierro por una de PVC. Ustedes la colocan?',
  })

  assert.notEqual(result.category, 'schedule_request')
  assert.notEqual(result.suggestedIntent, 'customer.schedule_request')
})

test('classifyInboundMessage treats installation preparation on an opening as quote context instead of support', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input:
      'El motivo es porque queremos colocar una cortina exterior y necesitamos que quede lisa y uniforme la superficie del marco donde apoyan sus guías.',
    tenantRuntimePolicy: TENANT_RUNTIME_POLICY,
  })

  assert.equal(result.category, 'price_inquiry')
  assert.equal(result.suggestedIntent, 'customer.quote')
  assert.ok(
    result.decisionPath.includes('classifier:catalog_installation_assessment_quote'),
  )
})

test('classifyInboundMessage keeps installed-product photo references inside support instead of quote exploration', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'Esa es la foto de las cortinas que colocaron.',
    tenantRuntimePolicy: TENANT_RUNTIME_POLICY,
  })

  assert.equal(result.category, 'support_request')
  assert.equal(result.suggestedIntent, 'customer.support_request')
  assert.ok(result.decisionPath.includes('classifier:support_request'))
})

test('classifyInboundMessage keeps short administrative follow-ups inside an active schedule thread', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'a que hora podrian?',
    recentTurns: [
      { role: 'customer', text: 'Prefiero agendar una visita para poder asesorarme mejor' },
      {
        role: 'agent',
        text: 'Perfecto. Ya tengo el día. ¿Querés decirme un horario concreto o preferís que te proponga uno?',
      },
    ],
  })

  assert.equal(result.category, 'schedule_request')
  assert.equal(result.suggestedIntent, 'customer.schedule_request')
  assert.ok(result.decisionPath.includes('classifier:schedule_request_contextual_followup'))
})

test('classifyInboundMessage keeps status-check follow-ups inside an active schedule thread', () => {
  const recentTurns = [
    { role: 'customer', text: 'A las 18hs' },
    {
      role: 'agent',
      text: 'Perfecto. Hablamos con los técnicos y te avisamos apenas confirmen la disponibilidad.',
    },
  ]

  const noveltyFollowUp = classifyInboundMessage({
    role: 'customer_public',
    input: 'Tenés alguna novedad?',
    recentTurns,
  })
  const dayConfirmationFollowUp = classifyInboundMessage({
    role: 'customer_public',
    input: 'Jueves?',
    recentTurns,
  })

  assert.equal(noveltyFollowUp.category, 'schedule_request')
  assert.equal(noveltyFollowUp.suggestedIntent, 'customer.schedule_request')
  assert.ok(
    noveltyFollowUp.decisionPath.includes(
      'classifier:schedule_request_contextual_followup',
    ),
  )
  assert.equal(dayConfirmationFollowUp.category, 'schedule_request')
  assert.equal(dayConfirmationFollowUp.suggestedIntent, 'customer.schedule_request')
  assert.ok(
    dayConfirmationFollowUp.decisionPath.includes(
      'classifier:schedule_request_contextual_followup',
    ),
  )
})

test('classifyInboundMessage recognizes payment method phrasings with pluralized pago wording', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'que medios de pagos aceptan',
  })

  assert.equal(result.category, 'faq_topic')
  assert.equal(result.suggestedIntent, 'customer.topic_info')
  assert.ok(result.decisionPath.includes('classifier:faq_topic'))
})

test('classifyInboundMessage recognizes broader payment concept wording without exact faq phrasing', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'puedo abonar con debito o transferencia',
  })

  assert.equal(result.category, 'faq_topic')
  assert.equal(result.suggestedIntent, 'customer.topic_info')
  assert.ok(result.decisionPath.includes('classifier:faq_topic'))
})

test('classifyInboundMessage detects customer frustration before calling the model', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'esto no funciona nunca',
  })

  assert.equal(result.category, 'frustration')
  assert.equal(result.suggestedIntent, 'customer.frustration')
})

test('classifyInboundMessage detects customer rephrase requests', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'no entiendo',
  })

  assert.equal(result.category, 'clarification_request')
  assert.equal(result.suggestedIntent, 'customer.rephrase_request')
})

test('classifyInboundMessage detects repeated customer turns', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'necesito info',
    recentTurns: [
      { role: 'customer', text: 'Necesito info' },
      { role: 'agent', text: 'Claro, ¿sobre qué te gustaría información?' },
      { role: 'customer', text: 'Necesito info' },
    ],
  })

  assert.equal(result.category, 'repetition')
  assert.equal(result.suggestedIntent, 'customer.repetition')
})

test('classifyInboundMessage only treats yes/no as confirmation or cancellation when confirmation is pending', () => {
  const confirmation = classifyInboundMessage({
    role: 'customer_public',
    input: 'sí dale',
    pendingState: { state: 'WAITING_CONFIRMATION' },
  })
  const cancellation = classifyInboundMessage({
    role: 'customer_public',
    input: 'no, eso no',
    pendingState: { state: 'WAITING_CONFIRMATION' },
  })
  const withoutPending = classifyInboundMessage({
    role: 'customer_public',
    input: 'sí dale',
  })

  assert.equal(confirmation.category, 'confirmation')
  assert.equal(confirmation.suggestedIntent, 'customer.confirmation')
  assert.equal(cancellation.category, 'cancellation')
  assert.equal(cancellation.suggestedIntent, 'customer.cancellation')
  assert.notEqual(withoutPending.category, 'confirmation')
})

test('classifyInboundMessage detects schedule cancellation language without needing a pending confirmation state', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input: 'No puede esperar el chico, les voy a cancelar la ida. Gracias igual.',
  })

  assert.equal(result.category, 'cancellation')
  assert.equal(result.suggestedIntent, 'customer.cancellation')
  assert.match(result.decisionPath.join(' '), /schedule_cancellation/i)
})
