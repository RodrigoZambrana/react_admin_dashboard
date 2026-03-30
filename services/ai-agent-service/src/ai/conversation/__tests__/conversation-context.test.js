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
