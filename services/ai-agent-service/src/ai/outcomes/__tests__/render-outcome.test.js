import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCustomerQuoteRequestText,
  buildCustomerSupportRequestText,
  buildCustomerScheduleCreatedText,
  renderCustomerDeterministicText,
  renderExecutionOutcome,
  renderLightConversationText,
  renderOperationDraftOutcome,
  renderOutcomeText,
} from '../render-outcome.js'

test('renderOutcomeText keeps customer and admin wording separated on the same semantic base', () => {
  assert.match(renderOutcomeText({ audience: 'customer', outcome: 'blocked' }), /asesor/i)
  assert.match(
    renderOutcomeText({ audience: 'admin', outcome: 'blocked' }),
    /alcance conversacional|rol conversacional actual|rol actual/i,
  )
})

test('renderOperationDraftOutcome builds confirmation wording for ready drafts', () => {
  const response = renderOperationDraftOutcome({
    audience: 'admin',
    actionIntent: {
      key: 'appointments.create',
      confirmationPrompt: '¿Deseas confirmarla?',
    },
    draft: {
      intro: 'He preparado la cita.',
      sections: [{ title: 'Datos', items: ['Título: showroom'] }],
      ready: true,
    },
    buildDraftToolCall: () => ({ name: '__operation_draft__', status: 'draft' }),
  })

  assert.match(response.text, /He preparado la cita/i)
  assert.match(response.text, /¿Deseas confirmarla\?/i)
})

test('renderExecutionOutcome reports batch failures and successes coherently', () => {
  const response = renderExecutionOutcome({
    audience: 'admin',
    draft: {
      execute: { type: 'batch' },
    },
    executions: [
      {
        status: 'executed',
        successLabel: 'Producto A',
        verifyEntity: 'product',
        result: { id: 5 },
      },
      {
        status: 'failed',
        successLabel: 'Producto B',
        errorMessage: 'validation_error',
      },
    ],
    buildVerificationLink: (entity, result) =>
      entity === 'product' ? `/app/products/edit/${result.id}` : null,
  })

  assert.match(response.text, /Producto A/i)
  assert.match(response.text, /\/app\/products\/edit\/5/i)
  assert.match(response.text, /Producto B: validation_error/i)
  assert.equal(response.needsHuman, true)
})

test('renderLightConversationText keeps shared human semantics', () => {
  assert.match(renderLightConversationText({ audience: 'customer', kind: 'greeting' }), /¿En qué podemos ayudarte hoy/i)
  assert.match(renderLightConversationText({ audience: 'admin', kind: 'greeting' }), /¿En qué te ayudo hoy/i)
})

test('renderLightConversationText varies customer greetings according to the user input', () => {
  assert.equal(
    renderLightConversationText({
      audience: 'customer',
      kind: 'greeting',
      input: 'Buenos días',
    }),
    'Buenos días. ¿En qué podemos ayudarte?',
  )

  assert.equal(
    renderLightConversationText({
      audience: 'customer',
      kind: 'greeting',
      input: 'Buenas, tengo una consulta',
    }),
    'Hola. Claro, cuéntanos tu consulta.',
  )

  assert.equal(
    renderLightConversationText({
      audience: 'customer',
      kind: 'greeting',
      input: 'Hola, necesito ayuda',
    }),
    'Hola. Claro, ¿con qué te ayudamos?',
  )
})

test('renderLightConversationText honors runtime-configured greeting templates', () => {
  assert.equal(
    renderLightConversationText({
      audience: 'customer',
      kind: 'greeting',
      input: 'Hola',
      config: {
        customerGreetingDefault: 'Hola. Cuéntanos qué necesitas.',
      },
    }),
    'Hola. Cuéntanos qué necesitas.',
  )

  assert.equal(
    renderLightConversationText({
      audience: 'admin',
      kind: 'greeting',
      config: {
        adminGreetingDefault: 'Hola. Decime qué gestión quieres resolver.',
      },
    }),
    'Hola. Decime qué gestión quieres resolver.',
  )
})

test('buildCustomerScheduleCreatedText hides internal appointment wording and trims address punctuation', () => {
  const text = buildCustomerScheduleCreatedText({
    scheduleContext: {
      date: { dateLabel: 'mañana' },
      time: { timeLabel: '15:00' },
      address: 'Av Italia 1234,',
    },
    appointment: { id: 77 },
  })

  assert.equal(
    text,
    'Perfecto. Ya dejé agendada la visita técnica para mañana a las 15:00 · Av Italia 1234.',
  )
  assert.doesNotMatch(text, /actividad/i)
})

test('buildCustomerScheduleCreatedText omits narrative payloads from the schedule address summary', () => {
  const text = buildCustomerScheduleCreatedText({
    scheduleContext: {
      date: { dateLabel: 'mañana' },
      time: { timeLabel: '14:45' },
      address:
        'Buenas tardes, realizamos todas las cortinas con ustedes, esta es la 4 y vamos a realizar un cambio de guías.',
    },
    appointment: { id: 77 },
  })

  assert.equal(text, 'Perfecto. Ya dejé agendada la visita técnica para mañana a las 14:45.')
  assert.doesNotMatch(text, /realizamos todas las cortinas|cambio de gu[ií]as/i)
})

test('buildCustomerScheduleCreatedText honors runtime wording overrides', () => {
  const text = buildCustomerScheduleCreatedText(
    {
      scheduleContext: {
        date: { dateLabel: 'mañana' },
        time: { timeLabel: '15:00' },
        address: 'Av Italia 1234',
      },
    },
    {
      wordingOverrides: {
        'customer.schedule.created': [
          'Listo. La visita quedó confirmada para {timeText}.',
        ],
      },
    },
  )

  assert.equal(
    text,
    'Listo. La visita quedó confirmada para mañana a las 15:00 · Av Italia 1234.',
  )
})

test('renderCustomerDeterministicText keeps customer deterministic follow-up wording in the shared renderer', () => {
  assert.equal(
    renderCustomerDeterministicText({
      intentKey: 'customer.clarify_request',
      input: 'Buenos días, mi nombre es Rodrigo y necesito información',
    }),
    'Buenos días, Rodrigo. Claro, ¿sobre qué te gustaría información?',
  )

  assert.match(
    renderCustomerDeterministicText({
      intentKey: 'customer.multi_intent',
      inboundClassification: {
        focusAreas: [
          { key: 'appointment', label: 'la visita' },
          { key: 'pricing', label: 'los precios' },
        ],
      },
    }),
    /empecemos por la visita/i,
  )
})

test('buildCustomerSupportRequestText asks only for the missing support issue once the product is known', () => {
  const text = buildCustomerSupportRequestText('es una persiana de pvc', {
    interpretation: {
      supportContext: {
        productType: 'persiana de pvc',
        missingFields: ['issue'],
      },
      conversationContext: {
        mode: 'flow',
      },
    },
  })

  assert.match(text, /persiana de pvc/i)
  assert.match(text, /problema|revisar/i)
})

test('buildCustomerQuoteRequestText closes ready quote threads on polite deferral without reopening intake', () => {
  const text = buildCustomerQuoteRequestText('Lo vemos más adelante. Muchas gracias', {
    interpretation: {
      quoteContext: {
        topicLabel: 'cortinas roller blackout',
        familyLabel: 'cortinas',
        quantity: { total: 2 },
        measurements: {
          confirmationLabel: '2,00 x 2,00 m',
        },
      },
    },
  })

  assert.match(text, /cuando quieras retomarlo|seguimos por ac[aá]/i)
  assert.doesNotMatch(text, /qu[eé] quer[eé]s cotizar|producto te interesa/i)
})

test('buildCustomerQuoteRequestText alternates closure wording when the previous bot message already closed the thread', () => {
  const text = buildCustomerQuoteRequestText('Gracias', {
    interpretation: {
      conversationState: {
        context: {
          lastBotMessage: 'Perfecto. Cuando quieras retomarlo, seguimos por acá.',
        },
      },
      quoteContext: {
        topicLabel: 'cortinas roller blackout',
        familyLabel: 'cortinas',
        quantity: { total: 2 },
        measurements: {
          confirmationLabel: '2,00 x 2,00 m',
        },
      },
    },
  })

  assert.match(text, /cualquier cosa me escrib[ií]s/i)
  assert.doesNotMatch(text, /cuando quieras retomarlo, seguimos por ac[aá]/i)
})

test('buildCustomerQuoteRequestText turns quote visit follow-ups into coordination guidance', () => {
  const text = buildCustomerQuoteRequestText('Prefiero que la midan ustedes, mañana no puedo', {
    interpretation: {
      quoteContext: {
        topicLabel: 'cortinas roller blackout',
        familyLabel: 'cortinas',
        quantity: { total: 2 },
        measurements: {
          confirmationLabel: '2,00 x 2,00 m',
        },
      },
    },
  })

  assert.match(text, /zona|direcci[oó]n/i)
  assert.match(text, /d[ií]a|horario|visita/i)
  assert.doesNotMatch(text, /qu[eé] quer[eé]s cotizar|producto te interesa/i)
})

test('buildCustomerQuoteRequestText drops garbage quote subjects that come from free-form descriptors', () => {
  const text = buildCustomerQuoteRequestText('Hola acá encontré necesito para el dormitorio de mi hija', {
    interpretation: {
      quoteContext: {
        topicRecognized: true,
        profileResolved: true,
        topicLabel: 'para el dormitorio de mi hija',
        missingFields: ['measurements', 'quantity'],
      },
    },
  })

  assert.doesNotMatch(text, /presupuesto de para/i)
  assert.doesNotMatch(text, /\bde para\b/i)
})

test('buildCustomerQuoteRequestText drops numeric placeholder subjects before asking quote details', () => {
  const text = buildCustomerQuoteRequestText('Qué valor tiene? Son 250 km', {
    interpretation: {
      quoteContext: {
        topicRecognized: true,
        profileResolved: true,
        topicLabel: 'dos',
        missingFields: ['measurements'],
      },
    },
  })

  assert.doesNotMatch(text, /presupuesto de dos/i)
  assert.match(text, /medidas aproximadas|cotizaci[oó]n|presupuesto/i)
})

test('buildCustomerSupportRequestText differentiates announced payment proof from received proof', () => {
  const planned = buildCustomerSupportRequestText('Ya te envío el comprobante de la seña')
  const received = buildCustomerSupportRequestText(
    'Comprobante_TransferenciaTercerosEnElBanco_16_02_2026_12_43.pdf',
  )

  assert.match(planned, /cuando lo env[ií]es por ac[aá]/i)
  assert.match(received, /recib[ií] el comprobante/i)
  assert.notEqual(planned, received)
})
