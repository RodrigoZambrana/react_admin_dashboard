import test from 'node:test'
import assert from 'node:assert/strict'
import { detectCustomerFaqSubtype } from '../customer-faq-heuristics.js'
import { buildTenantRuntimePolicy } from '../../tenant-policy/runtime-tenant-policy.js'

test('detectCustomerFaqSubtype resolves payment methods from broader payment wording', () => {
  assert.equal(
    detectCustomerFaqSubtype('¿Puedo abonar con débito o transferencia?'),
    'payment_methods',
  )
})

test('detectCustomerFaqSubtype resolves tenant-configured bank-account requests as payment methods', () => {
  const tenantRuntimePolicy = buildTenantRuntimePolicy({
    tenantKey: 'urucortinas',
  })

  assert.equal(detectCustomerFaqSubtype('Me pasas cuenta bancaria?'), 'general')
  assert.equal(
    detectCustomerFaqSubtype('Me pasas cuenta bancaria?', {
      tenantRuntimePolicy,
    }),
    'payment_methods',
  )
  assert.equal(
    detectCustomerFaqSubtype('Pásame cuenta en pesos', {
      tenantRuntimePolicy,
    }),
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

test('detectCustomerFaqSubtype resolves delivery-time wording as availability', () => {
  assert.equal(
    detectCustomerFaqSubtype('Hola, ok, qeu tiempo de entrega tiene?'),
    'availability',
  )
  assert.equal(
    detectCustomerFaqSubtype('¿Cuánto demora?'),
    'availability',
  )
})

test('detectCustomerFaqSubtype ignores the web lead intro when the turn is really a quote opening', () => {
  assert.equal(
    detectCustomerFaqSubtype(
      'Hola, te contacto desde la web de urucortinas: Buenas tardes, quisiera solicitar presupuesto para puerta ventana de aluminio de 1.20 x 2.34 con doble vidrio',
    ),
    'general',
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
