import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCustomerScheduleContext } from '../customer-schedule-context.js'

test('buildCustomerScheduleContext captures date, time, address and contact from conversation turns', () => {
  const firstTurn = buildCustomerScheduleContext({
    currentTurnText: 'Quiero coordinar una visita técnica para cotizar roller blackout',
    previousScheduleContext: null,
    previousQuoteContext: {
      topicLabel: 'cortinas roller blackout',
    },
    currentTopic: {
      label: 'cortinas roller blackout',
      type: 'product_variant',
    },
    now: new Date('2026-03-28T10:00:00.000Z'),
  })

  const secondTurn = buildCustomerScheduleContext({
    currentTurnText:
      'mañana a las 10 en avenida italia 1234. Mi teléfono es 099123456',
    previousScheduleContext: firstTurn,
    previousQuoteContext: {
      topicLabel: 'cortinas roller blackout',
    },
    currentTopic: {
      label: 'cortinas roller blackout',
      type: 'product_variant',
    },
    nluAnalysis: {
      entities: {
        phones: [{ text: '099123456', resolution: [{ value: '099123456' }] }],
      },
    },
    now: new Date('2026-03-28T10:00:00.000Z'),
  })

  assert.equal(secondTurn.reason, 'visita técnica')
  assert.equal(secondTurn.purpose, 'cotizar cortinas roller blackout')
  assert.equal(secondTurn.date?.dateLabel, 'mañana')
  assert.equal(secondTurn.time?.timeLabel, '10:00')
  assert.equal(secondTurn.address, 'avenida italia 1234')
  assert.equal(secondTurn.contactPhone, '099123456')
  assert.equal(secondTurn.completionStatus, 'ready_to_schedule')
})

test('buildCustomerScheduleContext captures a complete visit request from one freeform turn', () => {
  const context = buildCustomerScheduleContext({
    currentTurnText:
      'norberto ortiz 4086 esquina santa ana 091284204 puedo el lunes a las 14',
    previousScheduleContext: {
      reason: 'visita técnica',
      purpose: 'cotizar aberturas de aluminio',
    },
    previousQuoteContext: {
      topicLabel: 'aberturas de aluminio',
    },
    currentTopic: {
      label: 'aberturas de aluminio',
      type: 'product_topic',
    },
    now: new Date('2026-03-28T10:00:00.000Z'),
  })

  assert.equal(context.title, 'Visita técnica')
  assert.equal(context.date?.dateLabel, 'lunes 30/03/2026')
  assert.equal(context.time?.timeLabel, '14:00')
  assert.equal(context.address, 'norberto ortiz 4086 esquina santa ana')
  assert.equal(context.contactPhone, '091284204')
  assert.equal(context.completionStatus, 'ready_to_schedule')
})

test('buildCustomerScheduleContext preserves schedule intake across multiple short turns', () => {
  const firstTurn = buildCustomerScheduleContext({
    currentTurnText: 'Prefiero agendar una visita para poder asesorarme mejor',
    previousScheduleContext: null,
    previousQuoteContext: {
      topicLabel: 'cortinas roller',
    },
    currentTopic: {
      label: 'cortinas roller',
      type: 'product_topic',
    },
    now: new Date('2026-03-28T10:00:00.000Z'),
  })

  const secondTurn = buildCustomerScheduleContext({
    currentTurnText: 'puedo el lunes',
    previousScheduleContext: firstTurn,
    previousQuoteContext: {
      topicLabel: 'cortinas roller',
    },
    currentTopic: {
      label: 'cortinas roller',
      type: 'product_topic',
    },
    now: new Date('2026-03-28T10:00:00.000Z'),
  })

  const thirdTurn = buildCustomerScheduleContext({
    currentTurnText: 'a que hora podrian?',
    previousScheduleContext: secondTurn,
    previousQuoteContext: {
      topicLabel: 'cortinas roller',
    },
    currentTopic: {
      label: 'cortinas roller',
      type: 'product_topic',
    },
    now: new Date('2026-03-28T10:00:00.000Z'),
  })

  const fourthTurn = buildCustomerScheduleContext({
    currentTurnText: 'es en avenida italia 1428. A las 14 estoy en casa. Mi teléfono es 099123456',
    previousScheduleContext: thirdTurn,
    previousQuoteContext: {
      topicLabel: 'cortinas roller',
    },
    currentTopic: {
      label: 'cortinas roller',
      type: 'product_topic',
    },
    now: new Date('2026-03-28T10:00:00.000Z'),
  })

  assert.equal(secondTurn.date?.dateLabel, 'lunes 30/03/2026')
  assert.equal(secondTurn.completionStatus, 'needs_info')
  assert.deepEqual(secondTurn.missingFields, ['time', 'address', 'contact'])
  assert.equal(thirdTurn.date?.dateLabel, 'lunes 30/03/2026')
  assert.equal(thirdTurn.time, null)
  assert.equal(fourthTurn.time?.timeLabel, '14:00')
  assert.equal(fourthTurn.address, 'avenida italia 1428')
  assert.equal(fourthTurn.contactPhone, '099123456')
  assert.equal(fourthTurn.completionStatus, 'ready_to_schedule')
})

test('buildCustomerScheduleContext strips conversational lead-ins from mixed phone and address payloads', () => {
  const context = buildCustomerScheduleContext({
    currentTurnText: 'si, 091285304 es ne fraga 2137',
    previousScheduleContext: {
      reason: 'revisión técnica',
      purpose: 'coordinar una revisión técnica',
    },
    now: new Date('2026-03-28T10:00:00.000Z'),
  })

  assert.equal(context.address, 'ne fraga 2137')
  assert.equal(context.contactPhone, '091285304')
  assert.equal(context.completionStatus, 'needs_info')
  assert.deepEqual(context.missingFields, ['date', 'time'])
})

test('buildCustomerScheduleContext does not infer a fake address from quote narrative text', () => {
  const context = buildCustomerScheduleContext({
    currentTurnText:
      'Le agradezco entonces cotizar la instalación de una cortina de enrollar exterior para esa ventana. La abertura es como dijimos 1.45 x 2.70 aprox.',
    previousScheduleContext: {
      reason: 'instalación',
      purpose: 'revisar aberturas',
    },
    now: new Date('2026-03-28T10:00:00.000Z'),
  })

  assert.equal(context.address, null)
  assert.deepEqual(context.missingFields, ['date', 'time', 'address', 'contact'])
})

test('buildCustomerScheduleContext keeps the previous address when the current turn only adds a time option', () => {
  const previous = buildCustomerScheduleContext({
    currentTurnText:
      'Buschental M37 S22, Esq, Juan Zorrilla de San Martin San José de Carrasco ubicación: https://maps.google.com/?q=-34.84792,-55.9874733',
    previousScheduleContext: {
      reason: 'visita técnica',
      purpose: 'cotizar ubicación',
    },
    now: new Date('2026-03-28T10:00:00.000Z'),
  })

  const next = buildCustomerScheduleContext({
    currentTurnText: 'Pueden sobre las 9 am?',
    previousScheduleContext: previous,
    now: new Date('2026-03-28T10:00:00.000Z'),
  })

  assert.equal(next.address, 'https://maps.google.com/?q=-34.84792,-55.9874733')
  assert.equal(next.time?.timeLabel, '09:00')
  assert.deepEqual(next.missingFields, ['date', 'contact'])
})
