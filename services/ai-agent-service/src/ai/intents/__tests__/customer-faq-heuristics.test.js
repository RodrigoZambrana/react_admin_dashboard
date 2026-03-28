import test from 'node:test'
import assert from 'node:assert/strict'
import { detectCustomerFaqSubtype } from '../customer-faq-heuristics.js'

test('detectCustomerFaqSubtype resolves payment methods from broader payment wording', () => {
  assert.equal(
    detectCustomerFaqSubtype('¿Puedo abonar con débito o transferencia?'),
    'payment_methods',
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
