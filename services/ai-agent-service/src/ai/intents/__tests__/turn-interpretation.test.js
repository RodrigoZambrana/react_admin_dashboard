import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTurnInterpretation } from '../turn-interpretation.js'

test('buildTurnInterpretation marks non-core quote attribute follow-ups and keeps quote readiness waiting', () => {
  const interpretation = buildTurnInterpretation({
    role: 'customer_public',
    originalInput: 'blanco',
    effectiveInput: 'blanco',
    normalizedInput: 'blanco',
    reasoningInput: 'blanco',
    inboundClassification: {
      category: 'price_inquiry',
    },
    intentDetection: {
      intent: 'customer.quote',
      confidence: 0.85,
      source: 'rule',
    },
    tenantRuntimePolicy: {
      vocabulary: {
        quoteAttributeFollowUpHints: {
          color: ['blanco', 'negro'],
        },
      },
    },
    previousTaskState: {
      intentKey: 'customer.quote',
      canonicalTopic: {
        label: 'aberturas de aluminio',
        type: 'product_topic',
        confidence: 0.92,
        source: 'conversation_memory',
      },
      quoteContext: {
        topicRecognized: true,
        topicLabel: 'aberturas de aluminio',
        familyLabel: 'aberturas',
        requiredAttributes: [
          {
            key: 'series',
            captureKind: 'taxonomy_tag',
            taxonomyTag: 'quote_slot_series',
          },
          {
            key: 'glass',
            captureKind: 'taxonomy_tag',
            taxonomyTag: 'quote_slot_glass',
          },
          {
            key: 'color',
            captureKind: 'taxonomy_tag',
            taxonomyTag: 'color',
          },
        ],
        missingFields: ['series', 'glass', 'color'],
        completionStatus: 'needs_info',
      },
      conversationContext: {
        activeDomain: 'quote',
        responseStrategy: 'quote_ready',
      },
    },
  })

  assert.equal(interpretation.followUp?.attributeOnly, true)
  assert.deepEqual(interpretation.followUp?.attributeKeys, ['color'])
  assert.equal(interpretation.resolutionReadiness?.lane, 'quote')
  assert.equal(interpretation.resolutionReadiness?.waitForMore, true)
  assert.ok(
    (interpretation.resolutionReadiness?.waitForMoreReasons || []).length > 0,
  )
})

test('buildTurnInterpretation keeps multi-intent openings out of the contact lane even when contact faq cues exist', () => {
  const interpretation = buildTurnInterpretation({
    role: 'customer_public',
    originalInput: 'hola, necesito info y hablar con alguien',
    effectiveInput: 'hola, necesito info y hablar con alguien',
    normalizedInput: 'hola, necesito info y hablar con alguien',
    reasoningInput: 'hola, necesito info y hablar con alguien',
    inboundClassification: {
      category: 'multi_intent',
    },
    intentDetection: {
      intent: 'customer.multi_intent',
      confidence: 0.91,
      source: 'rule',
    },
  })

  assert.equal(interpretation.faqSubtype, 'contact')
  assert.equal(interpretation.resolutionReadiness?.turnIntent, 'customer.multi_intent')
  assert.equal(interpretation.resolutionReadiness?.lane, 'general')
  assert.equal(interpretation.resolutionReadiness?.sideQuestionSubtype, null)
})

test('buildTurnInterpretation marks quote confirmation follow-ups once a quote is already ready for handoff', () => {
  const interpretation = buildTurnInterpretation({
    role: 'customer_public',
    originalInput: 'ok',
    effectiveInput: 'ok',
    normalizedInput: 'ok',
    reasoningInput: 'ok',
    inboundClassification: {
      category: 'other',
    },
    intentDetection: {
      intent: 'customer.product_info',
      confidence: 0.61,
      source: 'rule',
    },
    previousTaskState: {
      intentKey: 'customer.quote',
      canonicalTopic: {
        label: 'cortinas roller blackout',
        type: 'product_variant',
        confidence: 0.92,
        source: 'conversation_memory',
      },
      quoteContext: {
        topicRecognized: true,
        topicLabel: 'cortinas roller blackout',
        familyLabel: 'cortinas',
        measurements: {
          widthMm: 2000,
          heightMm: 2000,
          confirmationLabel: '2,00 x 2,00 m',
        },
        quantity: { total: 2 },
        missingFields: [],
        completionStatus: 'ready_for_pricing_or_handoff',
      },
      conversationContext: {
        activeDomain: 'quote',
      },
    },
  })

  assert.equal(interpretation.followUp?.detected, true)
  assert.equal(interpretation.followUp?.quoteConfirmation, true)
  assert.equal(interpretation.followUp?.quoteWaiting, false)
})

test('buildTurnInterpretation carries schedule context on explicit cancellation inside an active schedule thread', () => {
  const interpretation = buildTurnInterpretation({
    role: 'customer_public',
    originalInput: 'No puede esperar el chico, les voy a cancelar la ida. Gracias igual.',
    effectiveInput: 'No puede esperar el chico, les voy a cancelar la ida. Gracias igual.',
    normalizedInput: 'No puede esperar el chico, les voy a cancelar la ida. Gracias igual.',
    reasoningInput: 'No puede esperar el chico, les voy a cancelar la ida. Gracias igual.',
    inboundClassification: {
      category: 'other',
    },
    intentDetection: {
      intent: 'customer.cancellation',
      confidence: 0.93,
      source: 'rule',
    },
    previousTaskState: {
      intentKey: 'customer.schedule_request',
      scheduleContext: {
        purpose: 'visita técnica',
        reason: 'la visita técnica',
        address: 'Buschental 1234',
        date: { dateLabel: 'mañana' },
        time: { timeLabel: '09:00' },
        missingFields: [],
        completionStatus: 'ready_to_schedule',
      },
      conversationContext: {
        activeDomain: 'schedule',
      },
    },
  })

  assert.equal(interpretation.intent?.key, 'customer.cancellation')
  assert.equal(interpretation.resolutionReadiness?.lane, 'schedule')
  assert.equal(interpretation.scheduleContext?.address, 'Buschental 1234')
  assert.equal(interpretation.scheduleContext?.date?.dateLabel, 'mañana')
  assert.equal(interpretation.scheduleContext?.time?.timeLabel, '09:00')
})

test('buildTurnInterpretation carries quote memory on price follow-ups even when the previous canonical topic is missing', () => {
  const interpretation = buildTurnInterpretation({
    role: 'customer_public',
    originalInput: 'Y cuál sería el precio?',
    effectiveInput: 'Y cuál sería el precio?',
    normalizedInput: 'y cual seria el precio',
    reasoningInput: 'Y cuál sería el precio?',
    inboundClassification: {
      category: 'price_inquiry',
    },
    intentDetection: {
      intent: 'customer.price_inquiry',
      confidence: 0.82,
      source: 'rule',
    },
    previousTaskState: {
      intentKey: 'customer.quote',
      quoteContext: {
        topicRecognized: true,
        topicLabel: 'aberturas de aluminio',
        familyLabel: 'aberturas',
        measurements: {
          widthMm: 1200,
          heightMm: 2340,
          displayLabel: '1,20 x 2,34 m',
        },
        quantity: { total: 1 },
        missingFields: [],
        completionStatus: 'ready_for_pricing_or_handoff',
      },
      conversationContext: {
        activeDomain: 'quote',
        threadKey: 'thread:aberturas-aluminio',
        resolutionReadiness: {
          lane: 'quote',
          turnIntent: 'customer.quote',
          answerMode: 'quote_ready',
          nextUsefulField: null,
        },
      },
    },
  })

  assert.equal(interpretation.resolutionReadiness?.lane, 'quote')
  assert.equal(interpretation.quoteContext?.topicLabel, 'aberturas de aluminio')
  assert.equal(interpretation.quoteContext?.measurements?.displayLabel, '1,20 x 2,34 m')
  assert.equal(interpretation.quoteContext?.quantity?.total, 1)
})

test('buildTurnInterpretation does not canonize generic quote verbs into synthetic product threads', () => {
  const firstTurn = buildTurnInterpretation({
    role: 'customer_public',
    originalInput: 'quiero cotizar',
    effectiveInput: 'quiero cotizar',
    normalizedInput: 'quiero cotizar',
    reasoningInput: 'quiero cotizar',
    inboundClassification: {
      category: 'price_inquiry',
    },
    intentDetection: {
      intent: 'customer.quote',
      confidence: 0.9,
      source: 'rule',
    },
  })

  const followUp = buildTurnInterpretation({
    role: 'customer_public',
    originalInput: 'es de 120x120',
    effectiveInput: 'es de 120x120',
    normalizedInput: 'es de 120x120',
    reasoningInput: 'es de 120x120',
    inboundClassification: {
      category: 'price_inquiry',
    },
    intentDetection: {
      intent: 'customer.quote',
      confidence: 0.9,
      source: 'rule',
    },
    previousTaskState: {
      intentKey: firstTurn.intent?.key,
      canonicalTopic: firstTurn.topic,
      quoteContext: firstTurn.quoteContext,
      scheduleContext: firstTurn.scheduleContext,
      supportContext: firstTurn.supportContext,
      conversationContext: firstTurn.conversationContext,
    },
  })

  assert.equal(firstTurn.topic, null)
  assert.equal(firstTurn.threadResolution?.activeThread, null)
  assert.equal(followUp.topic, null)
  assert.equal(followUp.threadResolution?.activeThread, null)
  assert.equal(followUp.quoteContext?.topicLabel, null)
  assert.equal(followUp.quoteContext?.topicRecognized, false)
  assert.equal(followUp.quoteContext?.measurements?.displayLabel, '120 x 120 cm')
})
