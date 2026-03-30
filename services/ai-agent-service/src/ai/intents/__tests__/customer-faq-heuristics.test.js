import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectCustomerFaqSubtype,
  extractRequestedTopicLabel,
} from '../customer-faq-heuristics.js'

test('detectCustomerFaqSubtype resolves payment methods from broader payment wording', () => {
  assert.equal(
    detectCustomerFaqSubtype('¿Puedo abonar con débito o transferencia?'),
    'payment_methods',
  )
})

test('detectCustomerFaqSubtype resolves short payment follow-ups without dragging them into quote intake', () => {
  assert.equal(
    detectCustomerFaqSubtype('¿Y con transferencia?'),
    'payment_methods',
  )
})

test('detectCustomerFaqSubtype does not confuse operational payment updates with payment-method FAQs', () => {
  assert.equal(
    detectCustomerFaqSubtype('Ya te transferí recién'),
    'general',
  )
})

test('detectCustomerFaqSubtype can refine an otherwise vague faq turn from knowledge metadata', () => {
  assert.equal(
    detectCustomerFaqSubtype('¿Cómo manejan eso?', {
      retrievalItems: [
        {
          title: 'Ayuda comercial',
          summary: 'Información validada',
          snippet: 'Canales y condiciones verificadas',
          metadata: {
            documentKind: 'derived_web_fact',
            factType: 'payment_methods',
            pageKinds: ['payments_page'],
          },
          tags: ['payment_methods'],
        },
      ],
    }),
    'payment_methods',
  )
})

test('detectCustomerFaqSubtype resolves location questions from broader city wording', () => {
  assert.equal(
    detectCustomerFaqSubtype('¿En qué ciudad están?'),
    'location',
  )
})

test('detectCustomerFaqSubtype does not treat private-account changes as public location/contact FAQs', () => {
  assert.equal(
    detectCustomerFaqSubtype(
      'Ahora necesito cambiar mi dirección de entrega y actualizar mis datos de cuenta.',
    ),
    null,
  )
})

test('extractRequestedTopicLabel does not turn pure variant follow-ups into a fake topic label', () => {
  assert.equal(extractRequestedTopicLabel('dime las opciones'), null)
  assert.equal(extractRequestedTopicLabel('pasame las variantes'), null)
})

test('extractRequestedTopicLabel ignores standalone attachment artifacts and explicit reengagement markers', () => {
  assert.equal(
    extractRequestedTopicLabel('IMG-20260318-WA0007.jpg (archivo adjunto)'),
    null,
  )
  assert.equal(extractRequestedTopicLabel('Perdón, me quedó para atrás el mensaje'), null)
  assert.equal(extractRequestedTopicLabel('Hola, retomo esto.'), null)
})

test('extractRequestedTopicLabel keeps the product subject clean on transfer-style follow-ups', () => {
  assert.equal(extractRequestedTopicLabel('Tengo que pasarte un roller más'), 'roller')
})

test('extractRequestedTopicLabel does not convert quantity-only follow-ups into fake topics', () => {
  assert.equal(extractRequestedTopicLabel('2'), null)
  assert.equal(extractRequestedTopicLabel('2 unidades'), null)
  assert.equal(extractRequestedTopicLabel('necesito 2'), null)
})
