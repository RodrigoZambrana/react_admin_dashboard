import test from 'node:test'
import assert from 'node:assert/strict'

import { assistNextStep } from '../assist-next-step.js'

test('assistNextStep returns null when model assistance is disabled', async () => {
  const result = await assistNextStep({
    provider: null,
    allowModel: false,
    allowedActions: ['execute_flow'],
  })

  assert.equal(result, null)
})

test('assistNextStep returns a normalized assistant recommendation when provider extraction succeeds', async () => {
  let capturedPrompt = ''

  const result = await assistNextStep({
    provider: {
      async extractStructured({ systemPrompt }) {
        capturedPrompt = systemPrompt
        return {
          action: 'ask_clarification',
          missingFields: ['issue', 'unknown_field'],
          confidence: 0.88,
          reasoning: 'falta identificar el problema antes de coordinar',
        }
      },
    },
    allowModel: true,
    conversation: [
      { role: 'customer', text: 'Hola reparan cortinas?' },
      { role: 'customer', text: 'Es una persiana de pvc' },
    ],
    state: {
      intent: 'REPARACION',
      productType: 'persiana pvc',
      issue: null,
    },
    taskSummary:
      'intención=customer.support_request ; contexto_reciente=customer: Hola reparan cortinas? | customer: Es una persiana de pvc ; consulta_actual=Es una persiana de pvc',
    currentTask: {
      intentKey: 'customer.support_request',
      status: 'open',
      entities: [{ type: 'support_product_type', value: 'persiana pvc' }],
    },
    interpretation: {
      threadResolution: {
        activeThread: {
          resolvedLabel: 'service persiana pvc',
        },
      },
      conversationContext: {
        mode: 'flow',
        activeDomain: 'support',
        nextUsefulField: 'issue',
        responseStrategy: 'ask_support_field',
        knownFacts: {
          supportProduct: 'persiana pvc',
        },
      },
      supportContext: {
        productType: 'persiana pvc',
        missingFields: ['issue'],
      },
    },
    allowedActions: ['ask_clarification', 'execute_flow'],
    requiredFieldsByAction: {
      execute_flow: ['issue', 'address', 'phone'],
      ask_clarification: ['issue'],
    },
  })

  assert.equal(result?.action, 'ask_clarification')
  assert.deepEqual(result?.missingFields, ['issue'])
  assert.equal(result?.confidence, 0.88)
  assert.match(capturedPrompt, /ACTÚA COMO UN MOTOR DE DECISIÓN/i)
  assert.match(capturedPrompt, /ask_clarification, execute_flow/i)
  assert.match(capturedPrompt, /Contexto conversacional compacto:/i)
  assert.match(capturedPrompt, /Resumen operativo:/i)
  assert.match(capturedPrompt, /Datos faltantes de soporte: issue\./i)
})
