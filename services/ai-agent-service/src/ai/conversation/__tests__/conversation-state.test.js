import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildConversationState,
  isConversationFieldResolved,
  resolveNextConversationField,
} from '../conversation-state.js'

test('tenant slot values count as resolved when resuming the next useful field', () => {
  const conversationState = {
    slots: {
      product: { value: 'cortinas roller' },
      quantity: { value: 1 },
    },
    tenant: {
      slots: {
        measurements: { value: '2,00 x 2,00 m de ancho por alto' },
      },
    },
    normalization: {
      fieldToSlotKey: {
        address: 'address',
        day: 'date',
        date: 'date',
        time: 'time',
        topic: 'product',
        product: 'product',
        product_type: 'product',
        measurements: 'measurements',
        quantity: 'quantity',
      },
    },
  }

  assert.equal(isConversationFieldResolved('measurements', conversationState), true)
  assert.equal(
    resolveNextConversationField({
      requestedField: 'measurements',
      missingFields: [],
      conversationState,
    }),
    null,
  )
})

test('buildConversationState clears quote slot carryover when the product subject changes without new quote data', () => {
  const conversationState = buildConversationState({
    previousConversationState: {
      slots: {
        product: { value: 'cortinas roller' },
        dimensions: { value: '2,00 x 2,00 m de ancho por alto' },
        quantity: { value: 1 },
      },
      tenant: {
        slots: {
          measurements: {
            value: '2,00 x 2,00 m de ancho por alto',
            source: 'message_dimensions',
          },
          quantity: {
            value: '1',
            source: 'implicit_single_item',
          },
        },
      },
      normalization: {
        fieldToSlotKey: {
          address: 'address',
          day: 'date',
          date: 'date',
          time: 'time',
          topic: 'product',
          product: 'product',
          product_type: 'product',
          measurements: 'measurements',
          quantity: 'quantity',
          series: 'series',
        },
        slotKeys: ['address', 'date', 'time', 'product', 'dimensions', 'quantity'],
        tenantSlots: ['measurements', 'quantity', 'series'],
      },
      lastAskedSlot: 'measurements',
    },
    readiness: {
      lane: 'quote',
      turnIntent: 'customer.topic_info',
      answerMode: 'guide_quote_exploration',
      nextUsefulField: null,
    },
    intentKey: 'customer.topic_info',
    topic: {
      label: 'aberturas de aluminio',
      type: 'product_topic',
    },
    contextTopic: {
      label: 'cortinas roller',
      type: 'product_topic',
    },
    quoteContext: {
      topicLabel: 'aberturas de aluminio',
      familyLabel: 'aberturas',
      missingFields: ['series'],
      capturedAttributes: {},
      measurements: null,
      measurementItems: [],
      quantity: null,
      requiredAttributes: [{ key: 'series' }],
    },
    currentTurnText: 'Y aberturas en aluminio tienen?',
  })

  assert.equal(conversationState.slots.product.value, 'aberturas de aluminio')
  assert.equal(conversationState.slots.dimensions.value, null)
  assert.equal(conversationState.slots.quantity.value, null)
  assert.deepEqual(Object.keys(conversationState.tenant.slots), ['series'])
  assert.equal(conversationState.lastAskedSlot, null)
})
