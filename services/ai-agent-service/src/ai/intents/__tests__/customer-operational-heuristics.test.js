import test from 'node:test'
import assert from 'node:assert/strict'
import {
  looksLikeCustomerScheduleAvailabilityRequest,
  looksLikeCustomerSupportComponentReplacementRequest,
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

test('looksLikeCustomerSupportComponentReplacementRequest detects service pivots around cinta and enrollador', () => {
  assert.equal(
    looksLikeCustomerSupportComponentReplacementRequest(
      'y solo cambio de enrollador/cinta cuanto saldria?',
    ),
    true,
  )
})

test('looksLikeCustomerSupportServiceRequest uses recent product context for component-only service follow-ups', () => {
  assert.equal(
    looksLikeCustomerSupportServiceRequest(
      'y solo cambio de enrollador/cinta cuanto saldria?',
      {
        recentTurns: [
          { role: 'customer', text: 'Quiero presupuesto para persianas en un apto' },
          {
            role: 'agent',
            text: 'Claro. Para prepararte un presupuesto de persianas, decime las medidas aproximadas.',
          },
        ],
      },
    ),
    true,
  )
})

test('looksLikeCustomerSupportServiceRequest keeps short installed-product identification inside a support thread', () => {
  assert.equal(
    looksLikeCustomerSupportServiceRequest('es una persiana de pvc', {
      recentTurns: [
        { role: 'customer', text: 'Hola reparan cortinas de enrollar?' },
        {
          role: 'agent',
          text: 'Claro. Si necesitás una revisión o ajuste, contame qué producto es y qué habría que revisar, y coordinamos cómo seguir.',
        },
      ],
    }),
    true,
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

test('looksLikeCustomerScheduleAvailabilityRequest detects implicit scheduling proposals with day and availability phrasing', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Miércoles de mañana puede ser?',
    ),
    true,
  )
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Miércoles de mañana pude ser?',
    ),
    true,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest detects direct hour-range follow-ups', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      '¿A qué hora podrían pasar?',
    ),
    true,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest detects implicit confirmations like los espero el jueves', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Bueno los espero el jueves entre las 9 y las 10',
    ),
    true,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest does not confuse light-filter wording with scheduling', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Busco de las que dejan pasar luz.',
    ),
    false,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest does not confuse greeting time wording or installation conditions with scheduling', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Buenas tardes. Era para ver un presupuesto para sustituir esta ventana de hierro por una de PVC. Ustedes la colocan?',
    ),
    false,
  )
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'La idea es hacerlo sin instalación porque la hacemos nosotros.',
    ),
    false,
  )
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Le agradezco entonces cotizar la instalación de una cortina de enrollar exterior para esa ventana.',
    ),
    false,
  )
})
