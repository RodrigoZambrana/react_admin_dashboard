import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldCallAI } from '../should-call-ai.js'

test('shouldCallAI blocks model invocation for deterministic customer categories', () => {
  const decision = shouldCallAI({
    role: 'customer_public',
    intentKey: 'customer.incomplete',
    inboundClassification: {
      category: 'incomplete',
    },
  })

  assert.equal(decision.shouldCall, false)
  assert.equal(decision.reason, 'classified:incomplete')
})

test('shouldCallAI blocks model invocation for contact and confirmation categories', () => {
  const contactDecision = shouldCallAI({
    role: 'customer_public',
    intentKey: 'customer.contact_info',
    inboundClassification: {
      category: 'contact',
    },
  })
  const confirmationDecision = shouldCallAI({
    role: 'customer_public',
    intentKey: 'customer.confirmation',
    inboundClassification: {
      category: 'confirmation',
    },
  })

  assert.equal(contactDecision.shouldCall, false)
  assert.equal(contactDecision.reason, 'classified:contact')
  assert.equal(confirmationDecision.shouldCall, false)
  assert.equal(confirmationDecision.reason, 'classified:confirmation')
})

test('shouldCallAI keeps model invocation enabled when no deterministic gate applies', () => {
  const decision = shouldCallAI({
    role: 'customer_public',
    intentKey: 'customer.other',
    inboundClassification: {
      category: 'other',
    },
  })

  assert.equal(decision.shouldCall, true)
  assert.equal(decision.reason, 'llm_value_add')
})
