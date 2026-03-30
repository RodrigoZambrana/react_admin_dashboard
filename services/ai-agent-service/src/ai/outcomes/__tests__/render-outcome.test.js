import test from 'node:test'
import assert from 'node:assert/strict'
import {
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
  assert.match(renderOutcomeText({ audience: 'admin', outcome: 'blocked' }), /alcance conversacional/i)
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
