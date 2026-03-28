import test from 'node:test'
import assert from 'node:assert/strict'
import {
  looksLikeCustomerScheduleAvailabilityRequest,
  looksLikeCustomerSupportServiceRequest,
} from '../customer-operational-heuristics.js'

test('looksLikeCustomerSupportServiceRequest detects service needs on installed products', () => {
  assert.equal(
    looksLikeCustomerSupportServiceRequest(
      'Tengo instaladas unas cortinas con motor que necesitan service. Una dejó de funcionar y otra hay que acortarla.',
    ),
    true,
  )
})

test('looksLikeCustomerSupportServiceRequest does not confuse generic frustration with post-sale support', () => {
  assert.equal(
    looksLikeCustomerSupportServiceRequest('Esto no funciona nunca'),
    false,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest detects installation availability questions', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Cuándo tendrán disponibilidad para hacer la instalación? Me sirve después de las 17.',
    ),
    true,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest detects coordination requests without exact agendar wording', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Podemos coordinar visita y ver el trabajo? Me queda mejor en la mañana.',
    ),
    true,
  )
})
