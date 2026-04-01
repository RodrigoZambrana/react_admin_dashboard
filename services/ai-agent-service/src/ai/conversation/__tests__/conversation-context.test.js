import test from 'node:test'
import assert from 'node:assert/strict'

import { buildConversationContext } from '../conversation-context.js'

test('buildConversationContext keeps partial quote buildup in exploration before forcing the flow lane', () => {
  const context = buildConversationContext({
    role: 'customer_public',
    currentTurnText: 'Necesito 2 cortinas roller blackout',
    inboundClassification: {
      category: 'faq_topic',
    },
    intentDetection: {
      intent: 'customer.product_info',
      confidence: 0.78,
    },
    topic: {
      label: 'cortinas roller blackout',
      type: 'product_variant',
    },
    quoteContext: {
      topicLabel: 'cortinas roller blackout',
      quantity: { total: 2 },
      missingFields: ['measurements'],
    },
  })

  assert.equal(context.activeDomain, 'quote')
  assert.equal(context.mode, 'exploration')
  assert.equal(context.responseStrategy, 'guide_quote_exploration')
  assert.equal(context.nextUsefulField, 'measurements')
  assert.equal(context.resolutionReadiness?.lane, 'quote')
  assert.equal(context.resolutionReadiness?.turnIntent, 'customer.product_info')
  assert.deepEqual(context.resolutionReadiness?.missingFields, ['measurements'])
})

test('buildConversationContext marks quote-seeded product openings as information-first instead of immediate data collection', () => {
  const context = buildConversationContext({
    role: 'customer_public',
    currentTurnText: 'necesito roller blackout',
    inboundClassification: {
      category: 'price_inquiry',
    },
    intentDetection: {
      intent: 'customer.quote',
      confidence: 0.84,
    },
    topic: {
      label: 'cortinas roller blackout',
      type: 'product_variant',
    },
    quoteContext: {
      topicRecognized: true,
      topicLabel: 'cortinas roller blackout',
      familyLabel: 'cortinas',
      missingFields: ['measurements', 'quantity'],
      completionStatus: 'needs_info',
    },
  })

  assert.equal(context.activeDomain, 'quote')
  assert.equal(context.mode, 'exploration')
  assert.equal(context.responseStrategy, 'inform_then_guide_quote')
  assert.equal(context.quoteStage, 'information')
  assert.equal(context.quoteInformationFirst, true)
  assert.equal(context.resolutionReadiness?.answerMode, 'inform_then_guide_quote')
})

test('buildConversationContext holds quote slot-only follow-ups long enough to let the customer finish the data', () => {
  const context = buildConversationContext({
    role: 'customer_public',
    currentTurnText: 'si, necesito dos',
    inboundClassification: {
      category: 'price_inquiry',
    },
    intentDetection: {
      intent: 'customer.quote',
      confidence: 0.86,
    },
    topic: {
      label: 'cortinas roller blackout',
      type: 'product_variant',
    },
    quoteContext: {
      topicRecognized: true,
      topicLabel: 'cortinas roller blackout',
      familyLabel: 'cortinas',
      quantity: { total: 2 },
      missingFields: ['measurements'],
      completionStatus: 'needs_info',
    },
    followUp: {
      detected: true,
      quantityOnly: true,
    },
  })

  assert.equal(context.activeDomain, 'quote')
  assert.equal(context.waitForMore, true)
  assert.equal(context.responseStrategy, 'hold_for_more_context')
  assert.equal(context.quoteStage, 'data_collection')
  assert.deepEqual(context.resolutionReadiness?.waitForMoreReasons, [
    'quote_related_fragment',
    'quote_missing_measurements',
  ])
})

test('buildConversationContext keeps support in flow once the lane is clear and asks only the next useful thing', () => {
  const context = buildConversationContext({
    role: 'customer_public',
    currentTurnText: 'es una persiana de pvc',
    inboundClassification: {
      category: 'support_request',
    },
    intentDetection: {
      intent: 'customer.support_request',
      confidence: 0.91,
    },
    supportContext: {
      productType: 'persiana de pvc',
      missingFields: ['issue'],
      completionStatus: 'needs_context',
    },
  })

  assert.equal(context.activeDomain, 'support')
  assert.equal(context.mode, 'flow')
  assert.equal(context.responseStrategy, 'ask_support_field')
  assert.equal(context.nextUsefulField, 'issue')
  assert.equal(context.resolutionReadiness?.lane, 'support')
})

test('buildConversationContext marks clearly incomplete turns as wait-for-more instead of forcing a lane', () => {
  const context = buildConversationContext({
    role: 'customer_public',
    currentTurnText: 'necesito',
    inboundClassification: {
      category: 'incomplete',
    },
    intentDetection: {
      intent: 'customer.incomplete',
      confidence: 0.92,
    },
  })

  assert.equal(context.waitForMore, true)
  assert.equal(context.mode, 'unclear')
  assert.equal(context.responseStrategy, 'hold_for_more_context')
})

test('buildConversationContext keeps the operational quote lane but marks business-fact side questions explicitly', () => {
  const context = buildConversationContext({
    role: 'customer_public',
    currentTurnText: 'que medios de pago aceptan?',
    inboundClassification: {
      category: 'faq_topic',
    },
    intentDetection: {
      intent: 'customer.topic_info',
      confidence: 0.88,
    },
    previousConversationContext: {
      activeDomain: 'quote',
      threadKey: 'quote:roller',
    },
    topic: {
      label: 'medios de pago',
      type: 'business_fact',
    },
    quoteContext: {
      topicRecognized: true,
      topicLabel: 'cortinas roller',
      missingFields: ['measurements'],
      completionStatus: 'needs_info',
    },
    faqSubtype: 'payment_methods',
  })

  assert.equal(context.activeDomain, 'quote')
  assert.equal(context.waitForMore, false)
  assert.equal(context.responseStrategy, 'answer_side_question')
  assert.equal(context.resolutionReadiness?.lane, 'quote')
  assert.equal(context.resolutionReadiness?.turnIntent, 'customer.topic_info')
  assert.equal(context.resolutionReadiness?.sideQuestionSubtype, 'payment_methods')
})

test('buildConversationContext holds non-core quote attribute fragments through resolutionReadiness', () => {
  const context = buildConversationContext({
    role: 'customer_public',
    currentTurnText: 'blanco',
    inboundClassification: {
      category: 'price_inquiry',
    },
    intentDetection: {
      intent: 'customer.quote',
      confidence: 0.86,
    },
    quoteContext: {
      topicRecognized: true,
      topicLabel: 'aberturas de aluminio',
      familyLabel: 'aberturas',
      capturedAttributes: {
        color: {
          value: 'blanco',
          label: 'blanco',
          source: 'profile_enum',
        },
      },
      missingFields: ['series', 'glass'],
      completionStatus: 'needs_info',
    },
    followUp: {
      detected: true,
      attributeOnly: true,
      attributeKeys: ['color'],
    },
  })

  assert.equal(context.activeDomain, 'quote')
  assert.equal(context.waitForMore, true)
  assert.equal(context.responseStrategy, 'hold_for_more_context')
  assert.deepEqual(context.resolutionReadiness?.waitForMoreReasons, [
    'quote_related_fragment',
    'quote_missing_color',
  ])
})

test('buildConversationContext keeps quote progression active on generic follow-ups instead of falling back to clarification', () => {
  const context = buildConversationContext({
    role: 'customer_public',
    currentTurnText: 'perdón, estaba en una reunión',
    inboundClassification: {
      category: 'other',
    },
    intentDetection: {
      intent: 'customer.other',
      confidence: 0.71,
    },
    previousConversationContext: {
      activeDomain: 'quote',
      threadKey: 'thread:quote-product',
      resumePointer: 'measurements',
      resolutionReadiness: {
        lane: 'quote',
        turnIntent: 'customer.quote',
        answerMode: 'ask_quote_field',
        nextUsefulField: 'measurements',
      },
      conversationState: {
        slots: {},
      },
    },
    quoteContext: {
      topicRecognized: true,
      topicLabel: 'producto configurado',
      missingFields: ['measurements'],
      completionStatus: 'needs_info',
    },
    followUp: {
      detected: true,
    },
  })

  assert.equal(context.activeDomain, 'quote')
  assert.equal(context.responseStrategy, 'ask_quote_field')
  assert.equal(context.nextUsefulField, 'measurements')
  assert.equal(context.resumePointer, 'measurements')
})

test('buildConversationContext preserves resume metadata when a schedule side question interrupts the active thread', () => {
  const context = buildConversationContext({
    role: 'customer_public',
    currentTurnText: 'y aceptan transferencia?',
    inboundClassification: {
      category: 'faq_topic',
    },
    intentDetection: {
      intent: 'customer.topic_info',
      confidence: 0.84,
    },
    previousConversationContext: {
      activeDomain: 'schedule',
      threadKey: 'thread:schedule-visit',
      resumePointer: 'date',
      resolutionReadiness: {
        lane: 'schedule',
        turnIntent: 'customer.schedule_request',
        answerMode: 'ask_schedule_field',
        nextUsefulField: 'date',
      },
      conversationState: {
        slots: {
          address: { value: 'Buschental', source: 'explicit' },
          time: { value: '9am', source: 'explicit' },
        },
      },
    },
    scheduleContext: {
      address: 'Buschental',
      time: {
        timeLabel: '9am',
        exact: true,
        hour: 9,
        minute: 0,
      },
      date: null,
      missingFields: ['date'],
    },
    faqSubtype: 'payment_methods',
  })

  assert.equal(context.activeDomain, 'schedule')
  assert.equal(context.responseStrategy, 'answer_side_question')
  assert.equal(context.resumePointer, 'date')
  assert.equal(context.parentThreadKey, 'thread:schedule-visit')
})

test('buildConversationContext preserves the active quote lane for payment side questions even without rebuilding quote context on the current turn', () => {
  const context = buildConversationContext({
    role: 'customer_public',
    currentTurnText: 'me pasas cuenta bancaria?',
    inboundClassification: {
      category: 'faq_topic',
    },
    intentDetection: {
      intent: 'customer.topic_info',
      confidence: 0.86,
    },
    previousConversationContext: {
      activeDomain: 'quote',
      threadKey: 'thread:quote-roller',
      resumePointer: 'measurements',
      resolutionReadiness: {
        lane: 'quote',
        turnIntent: 'customer.quote',
        answerMode: 'ask_quote_field',
        nextUsefulField: 'measurements',
      },
      conversationState: {
        slots: {
          product: { value: 'cortina roller', source: 'explicit' },
        },
      },
    },
    topic: {
      label: 'medios de pago',
      type: 'business_fact',
    },
    faqSubtype: 'payment_methods',
  })

  assert.equal(context.activeDomain, 'quote')
  assert.equal(context.responseStrategy, 'answer_side_question')
  assert.equal(context.resolutionReadiness?.lane, 'quote')
  assert.equal(context.resolutionReadiness?.sideQuestionSubtype, 'payment_methods')
  assert.equal(context.resumePointer, 'measurements')
})

test('buildConversationContext keeps conversationState split between base slots and tenant extensions', () => {
  const context = buildConversationContext({
    role: 'customer_public',
    currentTurnText: 'Podemos coordinar una visita el lunes',
    intentDetection: {
      intent: 'customer.schedule_request',
      confidence: 0.92,
    },
    tenantRuntimePolicy: {
      conversationState: {
        slotAliases: {
          external_reference: 'case_reference',
        },
        tenantSlots: ['case_reference'],
      },
    },
    scheduleContext: {
      date: {
        dateLabel: 'lunes 06/04/2026',
      },
      time: null,
      address: null,
      missingFields: ['time', 'address', 'contact'],
    },
  })

  assert.deepEqual(Object.keys(context.conversationState?.slots || {}), [
    'address',
    'date',
    'time',
    'product',
    'dimensions',
    'quantity',
  ])
  assert.equal(context.conversationState?.normalization?.fieldToSlotKey?.day, 'date')
  assert.equal(context.conversationState?.normalization?.fieldToSlotKey?.topic, 'product')
  assert.equal(
    context.conversationState?.normalization?.fieldToSlotKey?.product_type,
    'product',
  )
  assert.equal(
    context.conversationState?.normalization?.fieldToSlotKey?.external_reference,
    'case_reference',
  )
  assert.deepEqual(context.conversationState?.normalization?.tenantSlots, [
    'case_reference',
  ])
  assert.deepEqual(context.conversationState?.slotStatus?.missing, [
    'time',
    'address',
  ])
  assert.equal(
    context.conversationState?.tenant?.slots?.case_reference?.value,
    null,
  )
})
