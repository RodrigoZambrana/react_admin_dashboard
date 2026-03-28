import test from 'node:test'
import assert from 'node:assert/strict'
import { detectCustomerBaseIntentWithNlp } from '../nlpjs-intent-service.js'

test('detectCustomerBaseIntentWithNlp recognizes base price inquiries', async () => {
  const result = await detectCustomerBaseIntentWithNlp(
    'me comunico para solicitar un presupuesto',
  )

  assert.equal(result.intent, 'price_inquiry')
  assert.ok(result.confidence > 0.5)
})

test('detectCustomerBaseIntentWithNlp recognizes location-like business questions', async () => {
  const result = await detectCustomerBaseIntentWithNlp('donde estan ubicados')

  assert.equal(result.intent, 'location')
  assert.ok(result.confidence > 0.5)
})
