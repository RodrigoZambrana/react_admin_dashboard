import test from 'node:test'
import assert from 'node:assert/strict'
import {
  looksLikeCustomerScheduleAvailabilityRequest,
  looksLikeCustomerSupportComponentReplacementRequest,
  looksLikeCustomerSupportServiceRequest,
} from '../customer-operational-heuristics.js'

const TEST_TENANT_RUNTIME_POLICY = {
  vocabulary: {
    supportComponentTerms: ['cinta', 'enrollador', 'lama', 'motor', 'guia'],
    productContextTerms: [
      'cortina',
      'cortinas',
      'persiana',
      'persianas',
      'ventana',
      'ventanas',
      'roller',
      'pvc',
    ],
  },
  businessRules: {
    installationTerms: ['instalacion', 'instalación', 'colocacion', 'colocación'],
  },
}

test('looksLikeCustomerSupportServiceRequest detects service needs on installed products', () => {
  assert.equal(
    looksLikeCustomerSupportServiceRequest(
      'Tengo instaladas unas cortinas con motor que necesitan service. Una dejó de funcionar y otra hay que acortarla.',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
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
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    true,
  )
})

test('looksLikeCustomerSupportServiceRequest uses recent product context for component-only service follow-ups', () => {
  assert.equal(
    looksLikeCustomerSupportServiceRequest(
      'y solo cambio de enrollador/cinta cuanto saldria?',
      {
        tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY,
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
      tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY,
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

test('looksLikeCustomerSupportServiceRequest detects installed-product photo references before opening quote intake', () => {
  assert.equal(
    looksLikeCustomerSupportServiceRequest(
      'Esa es la foto de las cortinas que colocaron.',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    true,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest detects installation availability questions', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Cuándo tendrán disponibilidad para hacer la instalación? Me sirve después de las 17.',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    true,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest detects coordination requests without exact agendar wording', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Podemos coordinar visita y ver el trabajo? Me queda mejor en la mañana.',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    true,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest detects implicit scheduling proposals with day and availability phrasing', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Miércoles de mañana puede ser?',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    true,
  )
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Miércoles de mañana pude ser?',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    true,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest detects direct hour-range follow-ups', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      '¿A qué hora podrían pasar?',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    true,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest detects visit availability questions phrased as going to the customer address', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Este viernes en la mañana pueden ir a mi domicilio?',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    true,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest detects implicit confirmations like los espero el jueves', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Bueno los espero el jueves entre las 9 y las 10',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    true,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest does not confuse light-filter wording with scheduling', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Busco de las que dejan pasar luz.',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    false,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest does not confuse product configuration follow-ups with scheduling', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      '¿Ese mismo modelo puede venir en negro?',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    false,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest does not confuse greeting time wording or installation conditions with scheduling', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Buenas tardes. Era para ver un presupuesto para sustituir esta ventana de hierro por una de PVC. Ustedes la colocan?',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    false,
  )
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'La idea es hacerlo sin instalación porque la hacemos nosotros.',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    false,
  )
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Le agradezco entonces cotizar la instalación de una cortina de enrollar exterior para esa ventana.',
      { tenantRuntimePolicy: TEST_TENANT_RUNTIME_POLICY },
    ),
    false,
  )
})

test('looksLikeCustomerScheduleAvailabilityRequest does not infer installation scheduling when the tenant has no installation terms', () => {
  assert.equal(
    looksLikeCustomerScheduleAvailabilityRequest(
      'Cuándo tendrán disponibilidad para hacer la instalación? Me sirve después de las 17.',
      {
        tenantRuntimePolicy: {
          vocabulary: TEST_TENANT_RUNTIME_POLICY.vocabulary,
          businessRules: { installationTerms: [] },
        },
      },
    ),
    false,
  )
})
