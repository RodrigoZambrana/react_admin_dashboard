import test from 'node:test'
import assert from 'node:assert/strict'
import { recognizeCustomerEntities } from '../recognizers-service.js'

test('recognizeCustomerEntities extracts dimension pairs from customer measurement messages', () => {
  const entities = recognizeCustomerEntities('necesito de 120x120')

  assert.equal(entities.dimensionPairs.length, 1)
  assert.equal(entities.dimensionPairs[0].widthMm, 1200)
  assert.equal(entities.dimensionPairs[0].heightMm, 1200)
  assert.equal(entities.hasStructuredEntities, true)
})

test('recognizeCustomerEntities extracts generic structured entities', () => {
  const entities = recognizeCustomerEntities(
    'mañana a las 10 te llamo al 099123456 por una seña de 1200 pesos',
  )

  assert.ok(entities.dateTimes.length >= 1)
  assert.ok(entities.phones.length >= 1)
  assert.ok(entities.currencies.length >= 1)
})
