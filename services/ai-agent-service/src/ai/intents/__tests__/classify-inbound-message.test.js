import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyInboundMessage } from '../classify-inbound-message.js'

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

test('classifyInboundMessage detects scheduling availability requests tied to visits or installation', () => {
  const result = classifyInboundMessage({
    role: 'customer_public',
    input:
      'Buenas tardes. ¿Cuándo tendrán disponibilidad para hacer la instalación? Me sirve después de las 17.',
  })

  assert.equal(result.category, 'schedule_request')
  assert.equal(result.suggestedIntent, 'customer.schedule_request')
  assert.ok(result.decisionPath.includes('classifier:schedule_request'))
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
