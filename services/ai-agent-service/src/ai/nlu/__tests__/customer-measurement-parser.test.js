import test from 'node:test'
import assert from 'node:assert/strict'

import {
  extractCustomerQuoteLeadText,
  extractCustomerQuotedMeasurementItems,
  extractCustomerQuotedMeasurements,
} from '../customer-measurement-parser.js'

const toMeasurementShape = (measurement) => ({
  widthMm: measurement?.widthMm,
  heightMm: measurement?.heightMm,
  displayUnit: measurement?.displayUnit,
  displayLabel: measurement?.displayLabel,
})

test('extractCustomerQuotedMeasurements parses metric decimals as meters', () => {
  const result = extractCustomerQuotedMeasurements('roller de 1,20x1,20')

  assert.equal(result?.widthMm, 1200)
  assert.equal(result?.heightMm, 1200)
  assert.equal(result?.displayUnit, 'm')
  assert.equal(result?.displayLabel, '1,20 x 1,20 m')
})

test('extractCustomerQuotedMeasurements normalizes mixed metric pairs like 1,20x120 to a reasonable window size', () => {
  const result = extractCustomerQuotedMeasurements('roller de 1,20x120')

  assert.equal(result?.widthMm, 1200)
  assert.equal(result?.heightMm, 1200)
  assert.equal(result?.displayUnit, 'm')
  assert.equal(result?.displayLabel, '1,20 x 1,20 m')
})

test('extractCustomerQuotedMeasurements parses plain 1200x1200 as millimeters', () => {
  const result = extractCustomerQuotedMeasurements('abertura 1200x1200 color negro')

  assert.equal(result?.widthMm, 1200)
  assert.equal(result?.heightMm, 1200)
  assert.equal(result?.displayUnit, 'mm')
  assert.equal(result?.displayLabel, '1200 x 1200 mm')
})

test('extractCustomerQuotedMeasurements converges x, × and por formats into the same structural dimensions', () => {
  const [withAsciiX, withUnicodeX, withPor] = [
    'roller blackout de 2x2',
    'roller blackout de 2×2',
    'roller blackout de 2 por 2',
  ].map((value) => extractCustomerQuotedMeasurements(value))

  assert.deepEqual(toMeasurementShape(withAsciiX), toMeasurementShape(withUnicodeX))
  assert.deepEqual(toMeasurementShape(withAsciiX), toMeasurementShape(withPor))
  assert.equal(withPor?.displayLabel, '2,00 x 2,00 m')
})

test('extractCustomerQuotedMeasurementItems parses quote line items with quantities', () => {
  const items = extractCustomerQuotedMeasurementItems(`
    - 1 ventana de 2.80 x 1.90
    - 6 ventanas de 1.50 x 1.50
  `)

  assert.equal(items.length, 2)
  assert.equal(items[0]?.quantity, 1)
  assert.equal(items[0]?.widthMm, 2800)
  assert.equal(items[1]?.quantity, 6)
  assert.equal(items[1]?.widthMm, 1500)
})

test('extractCustomerQuotedMeasurementItems parses inline multi-item measurements with plain meter suffixes', () => {
  const items = extractCustomerQuotedMeasurementItems(
    'son 2 unidades de 1,50m x 2m y 2 unidades de 2m x 2m',
  )

  assert.equal(items.length, 2)
  assert.equal(items[0]?.quantity, 2)
  assert.equal(items[0]?.widthMm, 1500)
  assert.equal(items[0]?.heightMm, 2000)
  assert.equal(items[1]?.quantity, 2)
  assert.equal(items[1]?.widthMm, 2000)
  assert.equal(items[1]?.heightMm, 2000)
})

test('extractCustomerQuoteLeadText stops before measurement section introducers', () => {
  const leadText = extractCustomerQuoteLeadText(`
    Buenos días. Solicito presupuesto por un total de 14 cortinas roller blancas.
    A continuación, detallo las medidas de ventanas:
    - 1 ventana de 2.80 x 1.90
  `)

  assert.doesNotMatch(leadText, /ventanas/i)
  assert.match(leadText, /14 cortinas roller blancas/i)
})
