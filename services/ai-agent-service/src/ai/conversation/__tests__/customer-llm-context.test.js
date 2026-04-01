import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCustomerLlmContextBlock,
  formatRecentTurnsForLlm,
} from '../customer-llm-context.js'

test('formatRecentTurnsForLlm keeps a wider recent window with compacted turns', () => {
  const block = formatRecentTurnsForLlm(
    [
      { role: 'customer', text: 'hola' },
      { role: 'agent', text: 'Hola. ¿En qué podemos ayudarte hoy?' },
      { role: 'customer', text: 'Necesito roller blackout de 2x2 para dormitorio.' },
      { role: 'agent', text: 'Perfecto. Tomo 2x2. Decime cuántas unidades necesitás.' },
      { role: 'customer', text: '2 unidades.' },
      { role: 'agent', text: 'Bien. ¿Preferís blackout total o una opción que deje pasar algo de luz?' },
    ],
    { limit: 6, maxCharsPerTurn: 80 },
  )

  assert.match(block, /customer: hola/i)
  assert.match(block, /agent: Hola\./i)
  assert.match(block, /customer: Necesito roller blackout/i)
  assert.match(block, /agent: Bien\. ¿Preferís blackout total/i)
})

test('buildCustomerLlmContextBlock includes summary, active thread, known facts and last system turn', () => {
  const block = buildCustomerLlmContextBlock({
    recentTurns: [
      { role: 'customer', text: 'Necesito roller blackout de 2x2' },
      { role: 'agent', text: 'Perfecto. Decime cuántas unidades necesitás.' },
      { role: 'customer', text: '2 unidades' },
    ],
    taskSummary:
      'intención=customer.quote ; contexto_reciente=customer: Necesito roller blackout de 2x2 ; cantidad=2 ; consulta_actual=2 unidades',
    currentTask: {
      intentKey: 'customer.quote',
      status: 'open',
      entities: [
        { type: 'topic', value: 'cortinas roller blackout' },
        { type: 'quote_quantity', value: '2' },
      ],
    },
    interpretation: {
      threadResolution: {
        activeThread: {
          resolvedLabel: 'cortinas roller blackout',
        },
      },
      conversationContext: {
        mode: 'flow',
        activeDomain: 'quote',
        nextUsefulField: 'measurements',
        responseStrategy: 'ask_quote_field',
        waitForMore: true,
        userGoal: 'cotizar 2 roller blackout',
        knownFacts: {
          topic: 'cortinas roller blackout',
          quantity: 2,
        },
        resolutionReadiness: {
          lane: 'quote',
          turnIntent: 'customer.quote',
          waitForMore: true,
          missingFields: ['measurements'],
          nextUsefulField: 'measurements',
          answerMode: 'ask_quote_field',
          mode: 'flow',
          sideQuestionSubtype: null,
          threadKey: 'quote:roller-blackout',
          quoteStage: 'data_collection',
          knownFacts: {
            topic: 'cortinas roller blackout',
            quantity: 2,
          },
          userGoal: 'cotizar 2 roller blackout',
        },
      },
      quoteContext: {
        missingFields: ['measurements'],
      },
    },
  })

  assert.match(block, /Resumen operativo:/i)
  assert.match(block, /Tarea vigente: intent=customer\.quote/i)
  assert.match(block, /Modo conversacional: flow\./i)
  assert.match(block, /Lane activo: quote\./i)
  assert.match(block, /Intent del turno: customer\.quote\./i)
  assert.match(block, /Hilo activo: cortinas roller blackout\./i)
  assert.match(block, /Objetivo del usuario: cotizar 2 roller blackout\./i)
  assert.match(block, /Modo de respuesta: ask_quote_field\./i)
  assert.match(block, /El cliente parece seguir completando la idea/i)
  assert.match(block, /Datos faltantes de cotización: measurements\./i)
  assert.match(block, /Hechos conocidos: topic=cortinas roller blackout ; quantity=2\./i)
  assert.match(
    block,
    /Última guía o pregunta del sistema: Perfecto\. Decime cuántas unidades necesitás\./i,
  )
  assert.match(block, /Historial reciente ampliado:/i)
})
