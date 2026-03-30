import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCustomerSupportContext } from '../customer-support-context.js'

test('buildCustomerSupportContext keeps product identification and then asks for the actual issue', () => {
  const firstTurn = buildCustomerSupportContext({
    currentTurnText: 'es una persiana de pvc',
    currentTopic: {
      label: 'persiana de pvc',
      type: 'product_topic',
    },
  })

  const secondTurn = buildCustomerSupportContext({
    currentTurnText: 'quiero reparar una existente porque se tranca al subir',
    previousSupportContext: firstTurn,
    currentTopic: {
      label: 'persiana de pvc',
      type: 'product_topic',
    },
  })

  assert.equal(firstTurn.productType, 'persiana de pvc')
  assert.deepEqual(firstTurn.missingFields, ['issue'])
  assert.equal(firstTurn.stage, 'product_identified')

  assert.equal(secondTurn.productType, 'persiana de pvc')
  assert.match(secondTurn.issueSummary, /se tranca al subir/i)
  assert.equal(secondTurn.completionStatus, 'issue_defined')
  assert.deepEqual(secondTurn.missingFields, [])
})

test('buildCustomerSupportContext reuses schedule capture when support pivots to visit coordination', () => {
  const context = buildCustomerSupportContext({
    currentTurnText: 'si, 091285304 es ne fraga 2137',
    previousSupportContext: {
      productType: 'persiana de pvc',
      issueSummary: 'quiero reparar una existente porque se tranca al subir',
      wantsVisit: true,
    },
    currentScheduleContext: {
      address: 'ne fraga 2137',
      contactPhone: '091285304',
      missingFields: ['day', 'time'],
      date: null,
      time: null,
    },
  })

  assert.equal(context.address, 'ne fraga 2137')
  assert.equal(context.contactPhone, '091285304')
  assert.equal(context.wantsVisit, true)
  assert.deepEqual(context.missingFields, ['day', 'time'])
  assert.equal(context.stage, 'visit_intake')
})
