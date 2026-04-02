import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCanonicalIntermediateContract,
  enrichCanonicalIntermediateContract,
  CANONICAL_INTERMEDIATE_CONTRACT_VERSION,
} from '../canonical-intermediate-contract.js'

test('buildCanonicalIntermediateContract consolidates readiness and conversation state', () => {
  const contract = buildCanonicalIntermediateContract({
    currentTurnText: 'Necesito cortinas roller',
    resolutionReadiness: {
      lane: 'quote',
      turnIntent: 'customer.quote',
      confidence: 0.91,
      answerMode: 'ask_quote_field',
      nextUsefulField: 'measurements',
      waitForMore: false,
      waitForMoreReasons: [],
      followUpDetected: false,
      sideQuestionSubtype: null,
      quoteStage: 'data_collection',
      quoteActionReady: false,
      quoteInformationFirst: false,
      threadKey: 'quote:roller',
    },
    conversationState: {
      lane: 'quote',
      intent: {
        key: 'customer.quote',
        confidence: 0.91,
      },
      slots: {
        product: { value: 'roller blackout' },
        quantity: { value: 2 },
      },
      tenant: {
        slots: {
          color: { value: 'blanco' },
        },
      },
      lastAskedSlot: 'dimensions',
    },
    quoteContext: {
      topicLabel: 'roller blackout',
      missingFields: ['measurements'],
      measurementItems: [],
    },
  })

  assert.equal(contract.schemaVersion, CANONICAL_INTERMEDIATE_CONTRACT_VERSION)
  assert.equal(contract.turn.lane, 'quote')
  assert.equal(contract.turn.turnIntent, 'customer.quote')
  assert.equal(contract.outcome.answerMode, 'ask_quote_field')
  assert.equal(contract.quoteSeed.nextUsefulField, 'measurements')
  assert.equal(contract.renderPlan.nextUsefulField, 'measurements')
  assert.equal(contract.renderPlan.lastAskedSlot, 'dimensions')
  assert.deepEqual(contract.facts.confirmed.base, {
    product: 'roller blackout',
    quantity: 2,
  })
  assert.deepEqual(contract.facts.confirmed.tenant, {
    color: 'blanco',
  })
})

test('buildCanonicalIntermediateContract marks schedule facts as stale when switching back to quote', () => {
  const contract = buildCanonicalIntermediateContract({
    currentTurnText: 'Quiero retomar la cotizacion de roller',
    previousConversationContext: {
      activeDomain: 'schedule',
      threadKey: 'schedule:visit',
      conversationState: {
        slots: {
          address: { value: 'Av. Italia 1234' },
          date: { value: 'Mañana' },
          time: { value: '10:00' },
        },
      },
    },
    resolutionReadiness: {
      lane: 'quote',
      turnIntent: 'customer.quote',
      answerMode: 'ask_quote_field',
      nextUsefulField: 'measurements',
      threadKey: 'quote:roller',
      followUpDetected: true,
    },
    conversationState: {
      lane: 'quote',
      intent: {
        key: 'customer.quote',
        confidence: 0.88,
      },
      slots: {},
      tenant: { slots: {} },
      lastAskedSlot: null,
    },
  })

  assert.equal(contract.thread.threadAction, 'switch')
  assert.deepEqual(contract.facts.staleToInvalidate, ['address', 'date', 'time'])
})

test('enrichCanonicalIntermediateContract derives response-oriented outcome fields', () => {
  const base = buildCanonicalIntermediateContract({
    currentTurnText: 'Que medios de pago aceptan?',
    resolutionReadiness: {
      lane: 'quote',
      turnIntent: 'customer.topic_info',
      answerMode: 'guide_quote_exploration',
      nextUsefulField: 'measurements',
      sideQuestionSubtype: 'payment_methods',
      quoteStage: 'data_collection',
      threadKey: 'quote:roller',
    },
    conversationState: {
      lane: 'quote',
      intent: {
        key: 'customer.topic_info',
        confidence: 0.84,
      },
      slots: {},
      tenant: { slots: {} },
      lastAskedSlot: 'dimensions',
    },
    quoteContext: {
      topicLabel: 'roller blackout',
      measurementItems: [{ displayLabel: '1,20 x 1,50' }, { displayLabel: '1,00 x 1,00' }],
      missingFields: ['measurements'],
      completionStatus: 'needs_info',
    },
  })

  const enriched = enrichCanonicalIntermediateContract(base, {
    responseContract: 'answer_side_question',
    knowledgeDecision: {
      knowledgeNeed: 'none',
      reason: 'policy_backed_business_fact',
    },
  })

  assert.equal(enriched.outcome.responseContract, 'answer_side_question')
  assert.equal(enriched.outcome.knowledgeNeed, 'none')
  assert.equal(enriched.outcome.knowledgeReason, 'policy_backed_business_fact')
  assert.equal(enriched.outcome.replyAct, 'answer_question')
  assert.equal(enriched.outcome.answerFirst, true)
  assert.equal(enriched.renderPlan.openingStyle, 'direct')
})
